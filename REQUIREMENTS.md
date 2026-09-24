# VisuGuard: Requirements and Build Plan

Status: Stage 5 done (current capture). Written 2026-09-24.

"VisuGuard" is a placeholder name. The UI reads it from one constant (`frontend/src/config.js`), so renaming is a one-line change.

## 1. What we are building

VisuGuard is an automated **visual regression testing** tool.

1. The developer captures the approved version of a site as a **baseline** (a screenshot of every page).
2. Later they give VisuGuard the **current** URL (a new deploy, a staging site, or the same URL after redeploying).
3. VisuGuard screenshots the current site and compares it page by page with the stored baseline.
4. A report shows what changed: baseline image, current image, diff image and a mismatch percentage per page.

**The baseline is a stored snapshot, not a live URL.** The old site can go offline and the baseline still works.

Out of scope for the MVP: functional testing, CI/CD, GitHub integration, AI explanations, threshold settings, browser/device matrix, email alerts.

## 2. Ground rules

Priority order: **WORKING > SIMPLE > UNDERSTANDABLE > POLISHED.**
The author must be able to explain every line to hackathon judges.

- JavaScript only. React with JavaScript (not TypeScript). Plain CSS in one `styles.css`.
- Simple functions. No design patterns, no generic utilities, no state libraries, few files and folders.
- Descriptive names. Short comments only where the logic is not obvious.
- Build nothing outside the MVP scope. Do not swap or add technologies.
- Work in small stages. Stop after each stage and wait for the next instruction.

## 3. Tech stack (locked)

| Layer | Technology | Used for |
|---|---|---|
| Frontend | React (JavaScript), plain CSS | All screens |
| Backend | Node.js + Express | REST API; runs Playwright and Resemble.js |
| Browser automation | Playwright (Chromium) | Open pages, find links, screenshots, PDF export |
| Image comparison | Resemble.js | Mismatch % and diff images |
| Auth | Supabase Auth | Email/password, Google, forgot password |
| Database | Supabase Database | Test history and results |

**Not allowed:** TypeScript, Next.js, Tailwind, Python/FastAPI, MongoDB, a separate PostgreSQL, Prisma, Firebase, Redux, Zustand, Material UI, shadcn, any other framework or library.

**Tooling the locked stack itself needs (not extra technologies):**
- Vite: dev server and bundler for React (the JavaScript `react` template, not `react-ts`).
- Node built-ins instead of extra packages: `node --env-file=.env` (no dotenv), `node --watch` (no nodemon), `fetch`, `fs`.
- No `react-router`: screens switch with one `view` state variable.
- No `cors` package: Vite proxies `/api` and `/files` to Express in development.

**Dependencies** (latest when written: express 5.2.1, playwright 1.63.0, @supabase/supabase-js 2.117.1, resemblejs 5.0.0)
- backend: `express`, `playwright`, `resemblejs`, `@supabase/supabase-js`
- frontend: `react`, `react-dom`, `vite` (+ its React plugin), `@supabase/supabase-js`

**Verified on this machine (Node v26.8.1, 2026-09-24):** a plain `npm i resemblejs` finished without `canvas` in `node_modules`, so Resemble.js cannot run. Adding `"overrides": { "canvas": "^3.0.0" }` to `backend/package.json` fixes it. With the override, a test comparison of two images with different heights returned a mismatch percentage, a diff PNG from `getBuffer()`, and `isSameDimensions: false`, as expected.

## 4. User flow (from the hand-drawn sketch)

The sketch is one linear flow. The scribbled-out box at the top is an early draft of the landing page and is ignored.

```
Landing -> Auth -> Dashboard
                      |
   1. Enter baseline URL -> [Capturing baseline...] -> Baseline captured
   2. Enter current URL  -> [Capturing current...]  -> Current captured
   3. Analyze Changes    -> [Analyzing...]          -> Report
   4. Report: Export PDF  |  Compare Another URL
```

## 5. Screens

**Landing.** Product name, one-line explanation, feature bullets, the 4-step "how to use", Sign In and Sign Up buttons. If a session already exists, show "Go to Dashboard".

**Auth.** One form that toggles between Sign In and Sign Up. Email + password, "Continue with Google", "Forgot password?". After success, go to the Dashboard. A small "set new password" form appears when the user arrives from a password-reset email.

**Dashboard (main workspace).**
- Sidebar: avatar (Google photo if present, otherwise a CSS circle with the first letter), name/email, Logout, "New test" button, test history list (URL, status, date, delete button).
- Main panel: a step-by-step flow driven by the selected test's `status`:

| `status` | Main panel shows |
|---|---|
| (no test selected) | "New test" form: baseline URL input + **Create Baseline** (saves the row with status `created`) |
| `created` | Baseline Capture card with a **Capture Baseline** button |
| `capturing_baseline` | "Capturing baseline..." spinner + live progress text; the page polls every 1.5 s |
| `baseline_captured` | "Baseline Captured ✓", page count, failed pages (if any), **View Baseline** grid, plus the "Compare with a new deployment" card: **Current URL** input + **Capture Current** |
| `capturing_current` | "Capturing current deployment..." spinner + live progress text (`Visiting /about (page 3 of 9)`); the baseline card stays visible; polls every 1.5 s |
| `current_captured` | "Current Deployment Captured ✓", counts (`Baseline: 9 pages · Current: 5 of 9 pages`), failed pages with reasons, **View Current Pages** grid. Stage 6 adds **Analyze Changes** |
| `analyzing` | Spinner: comparing pages |
| `completed` | **Report** |
| `failed` | Baseline never captured: "Baseline capture failed." + **Try Again**. Baseline captured but current failed: "Current capture failed." + **Try Again** in the current card |

`failed` is used for both captures. If `baseline_pages` has screenshots, the baseline was fine and the current capture failed; otherwise the baseline failed. **Try Again** re-runs only that capture. How the analysis fails is decided in its stage.

**Report.** Baseline URL, current URL, date. Summary cards: pages tested, changed, unchanged, average mismatch. Verdict: PASS (no changed pages) or FAIL. One card per page: path, title, badge (same / changed / missing), mismatch %, and three images side by side: baseline, current, diff (diff only for changed pages). Buttons: **Export PDF** and **Compare Another URL**. Long screenshots sit in fixed-height scroll boxes; a click opens the full image.

## 6. Architecture

```
                 REACT FRONTEND  (Vite, port 5173)
                   |            \
        Supabase Auth             \  fetch /api/... with the user's access token
        (sign in / sign up)        \
                                EXPRESS BACKEND  (port 3001)
                                   |          |
                              PLAYWRIGHT   RESEMBLE.JS
                              screenshots  compare images
                                   |          |
                                   +-- backend/storage/  (PNG files on disk)
                                   |
                              SUPABASE DATABASE  (`tests` table: status + results)
```

- **React:** screens, Supabase login, polling the API, showing images.
- **Express:** checks the user's token, runs the jobs, saves files, reads and writes the `tests` table.
- **Playwright:** crawls and screenshots. Also renders the PDF.
- **Resemble.js:** compares two PNGs, returns mismatch % and a diff PNG.
- **Supabase:** who the user is (Auth) and which tests they ran (DB). It does not store screenshots in the MVP.

### Folder structure

```
Meetmux/
├── REQUIREMENTS.md
├── backend/
│   ├── package.json          "type": "module", canvas override
│   ├── .env.example
│   ├── server.js             Express setup, /files static, error handler
│   ├── auth.js               middleware: verify token, set req.user and req.db
│   ├── supabase.js           creates the per-user Supabase client
│   ├── screenshotter.js      Playwright: captureBaseline (crawl) and captureCurrent (baseline paths only), shared helpers
│   ├── routes/tests.js       /api/tests routes, background capture jobs, in-memory progress
│   ├── comparer.js           (stage 6) Resemble.js: compare page by page
│   ├── report.js             (stage 8) builds the report HTML and renders the PDF
│   └── storage/              screenshots on disk (git-ignored)
└── frontend/
    ├── package.json, index.html, vite.config.js, .env.example
    └── src/
        ├── main.jsx, App.jsx (picks the view), styles.css
        ├── config.js         APP_NAME
        ├── supabaseClient.js
        ├── api.js            fetch wrapper that adds the token, plus the tests calls
        ├── auth.js           Supabase Auth wrappers
        ├── helpers.js        status labels, dates, URL check, page counts
        ├── pages/            Landing, Auth, ResetPassword, Dashboard, TestDetail
        └── components/       AuthCard, Sidebar, ProfileMenu, TestForm, TestHistory, TestCard,
                              DeleteDialog, BaselineCapture, CurrentCapture, ScreenshotGrid
                              (Report comes in stage 7)
```

Routes live in `routes/tests.js`; `server.js` only sets up Express.

## 7. Data flow

Every API call sends `Authorization: Bearer <supabase access token>`.

**Auth.** React talks to Supabase Auth directly (`signUp`, `signInWithPassword`, `signInWithOAuth`, `resetPasswordForEmail`, `signOut`). `App.jsx` keeps the session and switches the view. Express never sees passwords.

**Every API request.** `auth.js` calls `supabase.auth.getUser(token)`. If valid it sets `req.user` and `req.db`, a Supabase client that carries the user's token, so Row Level Security limits every query to the user's own rows. No service-role key is needed.

**Capture baseline.**
1. React: `POST /api/tests { baselineUrl }` saves the test (`status: created`). Nothing is captured yet.
2. React: `POST /api/tests/:id/capture-baseline`. Express checks ownership, claims the test (`capturing_baseline`; the update is atomic, so two clicks cannot start two captures), replies `202 { testId, status }` at once and runs the capture in the background.
3. `screenshotter.js` crawls and screenshots (section 8), writes PNGs to `storage/<id>/baseline/`, and updates an in-memory `progress` object.
4. On success Express saves `baseline_pages` and sets `baseline_captured`. If no page could be captured it sets `failed` and `error_message`. A failed page stays in `baseline_pages` with its `error`.
5. React polls `GET /api/tests/:id` every 1.5 s. The reply is the row plus `progress`. When `status` changes, the screen changes.

**Capture current.** `POST /api/tests/:id/capture-current { currentUrl }`. Same pattern as the baseline (ownership check, atomic claim, `202`, background run, polling). Express saves `current_url`, sets `capturing_current` and clears `current_pages`. `captureCurrent` then visits the baseline's page paths on the current host (section 8) and writes PNGs to `storage/<id>/current/`, a folder that is emptied first. On success Express saves `current_pages` and sets `current_captured`. If not one page could be captured it sets `failed` and `error_message`.

**Analyze.** `POST /api/tests/:id/analyze`. `comparer.js` compares each `baseline/page-<index>.png` with `current/page-<index>.png` through Resemble.js, writes diff PNGs to `storage/<id>/diff/`, saves `results`, `pages_tested`, `pages_changed`, `avg_mismatch`, and sets `completed`.

**Report.** React reads the same `GET /api/tests/:id` and shows images from `/files/<id>/{baseline|current|diff}/page-<index>.png`.

**Export PDF.** `GET /api/tests/:id/report.pdf`. `report.js` builds one HTML page (summary + images as base64), opens it in Playwright and calls `page.pdf()`. React downloads the blob. Fallback if time runs out: `window.print()` with a print stylesheet.

**Compare Another URL.** `POST /api/tests/:id/clone` creates a new `tests` row with the same baseline (pages + copied PNGs) and status `baseline_captured`. The user then enters a new current URL.

**Delete.** `DELETE /api/tests/:id` removes the row and the folder `storage/<id>/`.

## 8. Capture and compare rules

**Browser settings** (identical for baseline and current so screenshots are comparable): headless Chromium, viewport 1280x800, device scale factor 1, page timeout 30 s.

**Baseline crawl.** Breadth-first search from the start URL.
- Follow only links on the same origin (protocol + host + port).
- Ignore `#hash`, `mailto:`, `tel:`, `javascript:`, and file links (.pdf .zip .png .jpg .jpeg .gif .svg .webp .mp4 .css .js .xml .ico).
- De-duplicate by full URL: `#fragments` are dropped and a trailing slash is ignored. Query strings are kept (`?id=1` and `?id=2` can be different pages).
- Stop at `MAX_PAGES` (default 10, set in `.env`). The first page counts as page 1, and failed pages count toward the limit.
- If one page fails (timeout, HTTP 400 or more, redirect to another website), record it with its `error` and continue. The test still completes if at least one page was captured.
- A page that redirects to an already known URL is skipped, not stored twice. If the first page redirects (for example to `www.`), the crawl continues on the address it landed on.

**Each page.** `goto` (wait for `domcontentloaded`, 30 s timeout) -> best-effort wait for `load` and for network idle -> scroll down and back (loads lazy images) -> wait for fonts -> full-page screenshot with animations disabled. Save the page `<title>` (empty text if it cannot be read).

**File names.** `page-<index>.png` with a 3-digit index, for example `page-001.png`. The index is the page's order in the baseline crawl. The current capture reuses the baseline's index, so `baseline/page-002.png` and `current/page-002.png` are the pair for the same path.

**Baseline page metadata** (`baseline_pages`, one entry per page tried):
```json
{ "index": 2, "url": "https://example.com/about", "path": "/about", "title": "About Us", "screenshot": "baseline/page-002.png" }
{ "index": 5, "url": "https://example.com/slow", "path": "/slow", "title": "", "screenshot": null, "error": "The page took too long to load (over 30 seconds)." }
```
`path` (pathname + query) is what the current capture reuses against the current host.

**Current capture does not crawl.** The baseline's page map decides what is visited. `captureCurrent` reuses the same browser, viewport, waits, scrolling, font wait and full-page screenshot code as the baseline (shared helper functions), so both sides are comparable.
- URL: `new URL(baselinePath, origin of the current URL)`. Only the host of the current URL is used. The path and query string come from the baseline (`/search?q=1` stays `/search?q=1`). The current site can live on another host (staging).
- Only baseline pages that have a screenshot are visited (a page with no baseline image cannot be compared later).
- No link discovery, no breadth-first search, and `MAX_PAGES` does not apply. 9 baseline pages mean 9 attempts, even if the current site has 15 pages or only 7. Pages that exist only on the new site are not detected in the MVP.
- Files use the baseline's index: `current/page-002.png` is the partner of `baseline/page-002.png`. `current_pages` has one entry per attempted page, in baseline order, same shape as `baseline_pages` (the `url` is the URL that was requested).
- A page fails, and stays in `current_pages` with an `error` and `screenshot: null`, when: HTTP status 400 or more; a timeout; a redirect to another origin (`The page redirected to another website (<origin>).`); or a redirect to another path (`Expected /about but the page redirected to /login.`). A different trailing slash or #fragment is fine. The other pages continue.
- A redirect from http to https counts as another origin. Enter the https URL as the current URL.
- Retry: `current/` is emptied and `current_pages` is reset before every attempt, so old screenshots are never mixed with new ones. The baseline is immutable: current capture never writes to `baseline/`, `baseline_pages` or `baseline_url`, and `capture-baseline` is refused once a baseline exists, even when the test status is `failed`.

**Compare.** For each baseline page, `compareImages(baselineBuffer, currentBuffer, options)` from `resemblejs/compareImages.js`:
- `output.largeImageThreshold: 0`. Without it Resemble skips pixels on images larger than 1200 px, which is not accurate for full-page shots.
- `ignore: 'antialiasing'` reduces false positives on text edges.
- Different image heights are fine: Resemble pads to the larger size and reports `isSameDimensions: false`.
- A page is `changed` when `misMatchPercentage` is above `CHANGE_THRESHOLD` (constant, 0.1 %). A page is `missing` when the current screenshot does not exist (counts as 100 %).
- For `changed` pages, write the diff PNG (`data.getBuffer()`) to `diff/page-<index>.png`.

**Storage layout (local disk).**

```
backend/storage/<testId>/baseline/page-001.png ...
                       /current/page-001.png ...
                       /diff/page-002.png ...     (changed pages only)
```

Express serves it at `/files/<testId>/...`. Each test folder is self-contained (clone copies the baseline PNGs), so deleting one test never breaks another.

**`results` column (JSON).**

```json
[
  { "index": 1, "path": "/",      "title": "Home",  "status": "same",    "mismatchPercent": 0.02 },
  { "index": 2, "path": "/about", "title": "About", "status": "changed", "mismatchPercent": 12.4, "sameSize": false },
  { "index": 3, "path": "/shop",                    "status": "missing", "mismatchPercent": 100 }
]
```

Summary: `pages_tested` = number of baseline pages, `pages_changed` = changed + missing, `avg_mismatch` = average of `mismatchPercent`.

## 9. Supabase

**Manual setup (once):**
1. Create a Supabase project.
2. Auth: enable Email. Turn OFF "Confirm email" for the hackathon so sign-up is instant.
3. Auth URL settings: Site URL `http://localhost:5173`, redirect URL `http://localhost:5173/**`.
4. Google sign-in (last, optional): create an OAuth client in Google Cloud, paste its client ID and secret into Supabase's Google provider, add Supabase's callback URL in Google. The code is one call; the setup is the slow part.
5. SQL editor: run the SQL below.
6. Copy the Project URL and anon key into the two `.env` files.

**Tables.** One table of our own. Users live in Supabase's built-in `auth.users`. The profile photo comes from `user.user_metadata.avatar_url` (Google), so no profile table is needed.

```sql
create table tests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  baseline_url   text not null,
  current_url    text,
  status         text not null default 'created',
  error_message  text,
  baseline_pages jsonb,   -- [{ index, url, path, title, screenshot }] (failed page: screenshot null + error)
  current_pages  jsonb,   -- same shape, one entry per baseline page; index matches baseline_pages
  results        jsonb,   -- per-page results, see section 8
  pages_tested   int,
  pages_changed  int,
  avg_mismatch   numeric,
  created_at     timestamptz not null default now()
);

alter table tests enable row level security;

create policy "users manage their own tests"
  on tests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

One row = one whole test (baseline + current + result). Per-page data sits in JSON columns to keep the MVP simple. If time allows, `results` can become a `test_pages` table.

**Status values:** `created`, `capturing_baseline`, `baseline_captured`, `capturing_current`, `current_captured`, `analyzing`, `completed`, `failed`.

The live table was created with the old default (`capturing_baseline`). The backend always sets `status` itself, so it works either way. Optional clean-up: `alter table tests alter column status set default 'created';`

## 10. API (Express)

All routes except `/api/health` need the bearer token. A route returns 409 if the test is already running a job. URLs must be `http` or `https`.

| Method and path | Body | What it does |
|---|---|---|
| GET `/api/health` | | Check the server is up |
| GET `/api/tests` | | History: my tests, newest first (summary columns only) |
| POST `/api/tests` | `{ baselineUrl }` | Create the test (status `created`), return `{ test }` |
| POST `/api/tests/:id/capture-baseline` | | Start the baseline capture in the background, return `202 { testId, status }`. 409 if it is running or already captured. Allowed from `created` and `failed` |
| GET `/api/tests/:id` | | Full row + `progress` (polling and report) |
| POST `/api/tests/:id/capture-current` | `{ currentUrl }` | Start the current capture (baseline paths only) in the background, return `202 { testId, status }`. 400 invalid URL. 409 if it is running, the baseline is missing, or it was already captured. Allowed from `baseline_captured` and from `failed` (when a baseline exists) |
| POST `/api/tests/:id/analyze` | | Start the comparison |
| POST `/api/tests/:id/clone` | | New test with the same baseline (Compare Another URL) |
| GET `/api/tests/:id/report.pdf` | | PDF download |
| DELETE `/api/tests/:id` | | Delete row and files |
| GET `/files/...` | | Screenshot PNGs (static) |

`progress` is `{ step, message }`, kept in memory only for the life of the job. `step` is an index into the fixed loading-step list in the UI.

## 11. Environment and setup commands

`backend/.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORT=3001`, `MAX_PAGES=10`
`frontend/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

The anon key is public by design. No secret keys are used.

```bash
# backend
cd backend && npm init -y && npm i express playwright resemblejs @supabase/supabase-js
#   then add  "type": "module"  and  "overrides": { "canvas": "^3.0.0" }  to package.json
npx playwright install chromium
node --env-file=.env --watch server.js

# frontend (scaffolded by hand, no template; vite.config.js proxies /api and /files to http://localhost:3001)
cd frontend && npm i react react-dom @supabase/supabase-js && npm i -D vite @vitejs/plugin-react
npm run dev
```

Stage 1 installed only what it needs: `express` and `@supabase/supabase-js` (backend), `react`, `react-dom`, `@supabase/supabase-js`, `vite`, `@vitejs/plugin-react` (frontend). `playwright` was added in stage 4 (run `npx playwright install chromium` once); `resemblejs` is added in the stage that uses it; the `canvas` override is already in `backend/package.json`.

## 12. MVP checklist

- [ ] React app with Landing, Auth, Dashboard
- [ ] Supabase auth: email/password, Google, forgot password, logout
- [ ] Dashboard: user info, avatar (default if none), history
- [ ] Baseline URL input + Capture Baseline
- [ ] Playwright screenshots + same-domain multi-page crawl (max pages)
- [ ] Baseline screenshots stored on disk, shown after capture
- [ ] Loading screen with steps
- [ ] Current URL input + Capture Current
- [ ] Resemble.js comparison: mismatch % + diff images
- [ ] Report: summary + page-by-page baseline / current / diff
- [ ] Test history saved in Supabase
- [ ] Delete a test
- [ ] Compare Another URL
- [ ] Export PDF

## 13. Build stages (estimates, 12 h total)

| Stage | Goal | Time |
|---|---|---|
| 0 | Analysis + this file | done |
| 1 | Scaffold both apps, own git repo, env files, `/api/health`, Vite proxy, Supabase client stubs. (Supabase project + table are created by hand, before stage 2.) | done |
| 2 | Landing, Auth (email, forgot password, Google), session handling, dashboard shell, logout, avatar | done |
| 3 | Test management: create, list, open, delete tests; protected API (`auth.js`) + RLS | done |
| 4 | Baseline capture: `screenshotter.js` (Playwright crawl), screenshots on disk, polling, screenshot grid | done |
| 5 | Current capture: reuses the baseline paths, no crawling, `capture-current`, current screenshot grid | done |
| 6 | Comparison: `comparer.js` (Resemble.js), analyze endpoint, diff images | 2 h |
| 7 | Report UI, Compare Another URL | 2 h |
| 8 | PDF export, error handling, demo sites, polish | 1.5 h |
| - | Buffer | 2 h |

**Demo plan (stage 6):** two tiny static demo sites (v1 and v2 with small visible changes such as a colour, a moved button and a removed page), served on two local ports by a small Express script, so the demo does not depend on a third-party site.

## 14. Known limits and later ideas

Limits of the MVP:
- Dynamic content (ads, carousels, dates) causes false positives. There is no ignore-region feature.
- Public pages only. No login-protected pages.
- The crawler follows `<a href>` links only.
- Screenshots live on local disk and are lost if the host resets. Fine for a local demo. Later: Supabase Storage.
- Screenshot URLs (`/files/<uuid>/...`) are public but unguessable. Later: signed URLs.
- The backend opens any http/https URL a signed-in user gives it, including localhost (needed to demo local sites). Before a public deploy, block private and internal addresses (SSRF).
- Jobs run inside the Express process (no queue). If the server restarts during a capture, the row stays `capturing_baseline` until the next `GET /api/tests/:id`, which marks it `failed` ("interrupted") so the user can retry.
- A capture saves its result with the signed-in user's token, so a capture running longer than the token lifetime (about 1 hour) could not save. Captures take seconds to minutes.
- Deleting a test while its capture runs is refused (409).
- Baseline and current URLs should both point to the site root. Only the host of the current URL is used; its own path is ignored.
- Once the current capture succeeded, it cannot be re-run with another URL. That is what Compare Another URL (stage 7) is for. A failed current capture can be retried.

Later, if time permits: AI explanation of differences, CI/CD and GitHub integration, better crawling, visual threshold settings, browser/device matrix, email notifications.

## 15. Open decisions (defaults chosen; change any of them)

1. **Git.** Decided: this project has its own git repository, separate from any other project in the parent folder.
2. **Current capture** visits the baseline's paths (default) instead of crawling again.
3. **Screenshots** on local disk (default) instead of Supabase Storage.
4. **Google sign-in** is built last because it needs Google Cloud setup.
5. **No react-router**; screens switch with state.
6. **Product name** stays VisuGuard until decided.

## 16. The 30-second explanation

1. The user signs in through Supabase.
2. They give a URL. Playwright crawls the same-domain pages and saves full-page screenshots as the **baseline**.
3. After a change, they give the current URL. Playwright screenshots the same pages.
4. Resemble.js compares each baseline/current pair, calculates a mismatch % and draws a diff image.
5. The results are saved in Supabase and shown as a report that can be exported to PDF.
