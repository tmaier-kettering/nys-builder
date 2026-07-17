# NYS Builder Explorer

This repository contains a static website that displays policy recommendations and related tools from Airtable data.

## Files

- `index.html` – policies page UI shell.
- `tools.html` – tools page UI shell.
- `app.js` – shared frontend logic for both pages, including filters, grouping, selection, sharing, and policy PDF export.
- `theme.css` – design tokens and color palette variables for easy visual customization.
- `styles.css` – main visual styles, layout, and UI animations.
- `scripts/sync-airtable-data.mjs` – pulls data from Airtable and writes browser-ready data.
- `data.js` – generated data payload consumed by the frontend (`window.NYS_BUILDER_DATA`).

## Run locally

Preferred (serves static files over HTTP):

```bash
cd nys-builder
python3 -m http.server 8000
```

Then open:

- `http://127.0.0.1:8000/index.html`
- `http://127.0.0.1:8000/tools.html`

## Sync data from Airtable

Set these environment variables before running the sync script:

- `AIRTABLE_TOKEN` – Airtable personal access token (read scopes for records + schema)
- `AIRTABLE_BASE_ID` – Airtable base id

Then run:

```bash
cd nys-builder
node ./scripts/sync-airtable-data.mjs
```

The sync script reads Airtable schema metadata, captures the exact field lists from the `policies` and `tools` tables, and writes both datasets to `data.js`. The UI renders those columns directly on cards and resolves linked policies/tools by their display titles.

Direct file open is also supported:

- `file:///path/to/your/nys-builder/index.html`

When loaded from `file://`, the app still reads from `data.js`.

## Features

- View modes: **Skim**, **Peruse**, **Deep Dive**
- Grouping: by **Scope** or **Topic**
- Filtering: by **Scope** and **Topic/Subtopic**
- Card selection with per-card and select-all-visible checkboxes
- Shareable selected-view link
- Client-side PDF download of selected policy cards in the active view mode
