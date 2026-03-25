"""
Syncs local log files to a dedicated branch on GitHub after each bot run.
Never raises — sync failures must never crash the bot.
"""

import base64
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_API = "https://api.github.com"


def _get_file_sha(token: str, repo: str, path: str, branch: str) -> Optional[str]:
    """Return the blob SHA of a file on the branch, or None if it doesn't exist."""
    url = f"{_API}/repos/{repo}/contents/{path}"
    resp = requests.get(
        url,
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        params={"ref": branch},
        timeout=15,
    )
    if resp.status_code == 200:
        return resp.json().get("sha")
    return None


def _ensure_branch(token: str, repo: str, branch: str) -> None:
    """Create the branch off the default branch if it doesn't exist."""
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}

    # Check if branch already exists
    resp = requests.get(f"{_API}/repos/{repo}/git/ref/heads/{branch}", headers=headers, timeout=15)
    if resp.status_code == 200:
        return

    # Get default branch SHA
    repo_resp = requests.get(f"{_API}/repos/{repo}", headers=headers, timeout=15)
    repo_resp.raise_for_status()
    default_branch = repo_resp.json()["default_branch"]

    sha_resp = requests.get(f"{_API}/repos/{repo}/git/ref/heads/{default_branch}", headers=headers, timeout=15)
    sha_resp.raise_for_status()
    sha = sha_resp.json()["object"]["sha"]

    requests.post(
        f"{_API}/repos/{repo}/git/refs",
        headers=headers,
        json={"ref": f"refs/heads/{branch}", "sha": sha},
        timeout=15,
    ).raise_for_status()
    logger.info(f"[github_sync] Created branch '{branch}'")


def _push_file(token: str, repo: str, branch: str, path: str, local_path: str) -> None:
    """Create or update a single file on the branch."""
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()

    sha = _get_file_sha(token, repo, path, branch)

    payload = {
        "message": f"sync: update {path}",
        "content": content,
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha

    resp = requests.put(
        f"{_API}/repos/{repo}/contents/{path}",
        headers={"Authorization": f"token {token}", "Accept": "application/vnd.github+json"},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()


def sync_logs(cfg) -> None:
    """
    Push all log files to GitHub. Call this after each bot run.
    Silently skips files that don't exist yet.
    """
    gh = getattr(cfg, "github", None)
    if not gh or not gh.token or not gh.repo:
        logger.debug("[github_sync] No GitHub config — skipping sync.")
        return

    log_dir = cfg.logging.log_dir.rstrip("/")

    try:
        _ensure_branch(gh.token, gh.repo, gh.branch)

        synced = 0
        for filename in os.listdir(log_dir):
            if not filename.endswith((".log", ".json", ".csv")):
                continue
            local_path = os.path.join(log_dir, filename)
            if not os.path.isfile(local_path) or os.path.getsize(local_path) == 0:
                continue
            remote_path = f"{log_dir}/{filename}"
            _push_file(gh.token, gh.repo, gh.branch, remote_path, local_path)
            synced += 1

        logger.info(f"[github_sync] Synced {synced} log file(s) to '{gh.repo}' branch '{gh.branch}'")

    except Exception as e:
        logger.warning(f"[github_sync] Sync failed (non-fatal): {e}")
