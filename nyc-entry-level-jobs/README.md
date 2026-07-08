# NYC Entry-Level Job Finder

A small client-side web app for finding entry-level jobs in New York City. No backend, no build step, no API keys — just static HTML/CSS/JS.

## Features

- **Job board search generator** — pick a category and borough and get one-click, pre-filtered search links to Indeed, LinkedIn, Glassdoor, ZipRecruiter, Google Jobs, NYC.gov Jobs, NYC Workforce1, and USAJobs.
- **NYC workforce resources** — curated list of free NYC-specific programs (Workforce1 Career Centers, Per Scholas, Year Up, JobsFirstNYC, CUNY Career Launch, and more).
- **Application checklist** — a step-by-step prep checklist with progress saved in your browser (`localStorage`).
- **Application tracker** — add companies/roles you've applied to, update their status (Saved/Applied/Interview/Offer/Rejected), and everything persists locally.

All data stays in your browser — nothing is sent to a server.

## Run it

No install required. From this directory:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. Or just open `index.html` directly in a browser.
