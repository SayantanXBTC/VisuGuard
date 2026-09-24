# VisuGuard demo sites

Two tiny websites for demonstrating VisuGuard without a real website. No install is needed, only Node.js.

| Site | URL | Use it as |
|---|---|---|
| baseline | http://localhost:4100 | the **Baseline URL** (the approved version) |
| changed | http://localhost:4101 | the **Current URL** (the new deployment) |

## Start

```bash
cd demo-sites
node server.js
```

This starts both sites. `node server.js baseline` or `node server.js changed` starts one. Stop with Ctrl+C.

## What VisuGuard should find

The baseline has 6 pages: `/`, `/about`, `/services`, `/contact`, `/team`, `/careers`. The changed site is a different version of the same pages (real HTML and CSS differences, nothing is edited in the screenshots):

| Page | Change | Result measured on the development machine |
|---|---|---|
| `/` | New heading ("Command Center" instead of "Dashboard"), new hero text, taller hero, orange colours, bigger rounded button | changed, about 48% (the biggest difference) |
| `/about` | One sentence is longer | changed, about 2% (small, text only) |
| `/services` | Four orange cards in a two-column layout instead of three cards in a row | changed, about 20% (large layout change) |
| `/contact` | Same text, but the button is bigger and orange | changed, about 1.6% (small) |
| `/team` | Identical | unchanged, 0% |
| `/careers` | Not served by the changed site (404) | unavailable (missing page) |

The exact percentages can differ a little on another machine (fonts).

## Demo steps

1. Start VisuGuard (backend `npm run dev` in `backend/`, frontend `npm run dev` in `frontend/`) and start the demo sites.
2. Sign in, click **Start New Test**, enter `http://localhost:4100`, click **Create Baseline**, then **Capture Baseline**.
3. Enter `http://localhost:4101` as the current URL and click **Capture Current**, then **Analyze Changes**.
4. Open the report, click a screenshot to enlarge it, click **Export PDF**.
5. Click **Compare Another URL** and enter `http://localhost:4100` again (an identical site, so nothing changes) to see a second report and the Comparison History.
