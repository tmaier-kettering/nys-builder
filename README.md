# NYS Builder Policy Explorer

This repository contains a static single-page website that displays policy recommendations and related actions from CSV files.

## Files

- `/home/runner/work/nys-builder/nys-builder/index.html` – UI, rendering logic, filters, grouping, selection, sharing, and PDF export.
- `/home/runner/work/nys-builder/nys-builder/actions.csv` – source action dataset.
- `/home/runner/work/nys-builder/nys-builder/policies.csv` – source policy dataset.
- `/home/runner/work/nys-builder/nys-builder/data.js` – embedded CSV fallback used when browser fetch is unavailable (for example, opening `index.html` directly via `file://`).

## Run locally

Preferred (serves CSV files over HTTP):

```bash
cd /home/runner/work/nys-builder/nys-builder
python3 -m http.server 8000
```

Then open:

- `http://127.0.0.1:8000/index.html`

Direct file open is also supported:

- `file:///home/runner/work/nys-builder/nys-builder/index.html`

When loaded from `file://`, the app uses fallback data from `data.js` if `fetch('./actions.csv')` or `fetch('./policies.csv')` is blocked.

## Features

- View modes: **Skim**, **Peruse**, **Deep Dive**
- Grouping: by **Scope**, **Type**, or **Issue Areas**
- Filtering: by **Scope**, **Type**, and **Issue Area**
- Card selection with per-card and select-all-visible checkboxes
- Shareable selected-view link
- Print-to-PDF export of selected cards in the active view mode
