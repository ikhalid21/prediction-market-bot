"""
Kalshi API client with RSA-PSS authentication.
Demo version — credentials removed.
"""

import base64
import time
import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


class KalshiClient:
    """Production-grade API client for Kalshi prediction markets."""

    BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"

    def __init__(self, api_key_id: str, private_key_path: str):
        self.api_key_id = api_key_id
        self.session = requests.Session()

        with open(private_key_path, "r") as f:
            pem_data = f.read()
        self.private_key = serialization.load_pem_private_key(
            pem_data.encode(), password=None
        )

    def _sign(self, method: str, path: str) -> tuple:
        """RSA-PSS signature with SHA-256 for API authentication."""
        timestamp_ms = str(int(time.time() * 1000))
        message = timestamp_ms + method.upper() + path
        signature = self.private_key.sign(
            message.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=hashes.SHA256.digest_size,
            ),
            hashes.SHA256(),
        )
        return timestamp_ms, base64.b64encode(signature).decode()

    def _request(self, method: str, path: str, params=None, json_body=None):
        """Authenticated API request with automatic signing."""
        url = self.BASE_URL + path
        full_path = "/trade-api/v2" + path
        ts, sig = self._sign(method, full_path)

        headers = {
            "KALSHI-ACCESS-KEY": self.api_key_id,
            "KALSHI-ACCESS-TIMESTAMP": ts,
            "KALSHI-ACCESS-SIGNATURE": sig,
            "Content-Type": "application/json",
        }

        resp = self.session.request(
            method, url, headers=headers, params=params, json=json_body, timeout=30
        )
        resp.raise_for_status()
        return resp.json()

    # --- Account ---
    def get_balance(self):
        return self._request("GET", "/portfolio/balance")

    def get_positions(self, limit=100):
        return self._request("GET", "/portfolio/positions", params={"limit": limit})

    # --- Markets ---
    def get_markets(self, **kwargs):
        return self._request("GET", "/markets", params=kwargs)

    def get_market(self, ticker: str):
        return self._request("GET", f"/markets/{ticker}")

    def get_orderbook(self, ticker: str, depth: int = 5):
        return self._request("GET", f"/markets/{ticker}/orderbook", params={"depth": depth})

    # --- Orders ---
    def place_order(self, ticker: str, action: str, side: str,
                    count: int, price_cents: int, **kwargs):
        body = {
            "ticker": ticker,
            "action": action,
            "side": side,
            "count": count,
            "type": "limit",
            "yes_price" if side == "yes" else "no_price": price_cents,
            **kwargs,
        }
        return self._request("POST", "/portfolio/orders", json_body=body)

    def cancel_order(self, order_id: str):
        return self._request("DELETE", f"/portfolio/orders/{order_id}")
