# VisuGuard: Requirements and Build Plan

Status: Stage 7 done (PDF export and Compare Another URL). Written 2026-09-24.

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
| Browser automation | Playwright (Chromium) | Open pages, find links, screenshots |
| Image comparison | Resemble.js | Mismatch % and diff images |
| Auth | Supabase Auth | Email/password, Google, forgot password |
| Database | Supabase Database | Test history and results |

**Not allowed:** TypeScript, Next.js, Tailwind, Python/FastAPI, MongoDB, a separate PostgreSQL, Prisma, Firebase, Redux, Zustand, Material UI, shadcn, any other framework or library.

**Tooling the locked stack itself needs (not extra technologies):**
- Vite: dev server and bundler for React (the JavaScript `react` template, not `react-ts`).
- `pdfkit` (backend): the one small library that writes the PDF report. It has no browser dependency; the PDF is drawn from saved data.
- Node built-ins instead of extra packages: `node --env-file=.env` (no dotenv), `node --watch` (no nodemon), `fetch`, `fs`.
- No `react-router`: screens switch with one `view` state variable.
- No `cors` package: Vite proxies `/api` and `/files` to Express in development.

**Dependencies** (latest when written: express 5.2.1, playwright 1.63.0, @supabase/supabase-js 2.117.1, resemblejs 5.0.0, pdfkit 0.20.2)
- backend: `express`, `playwright`, `resemblejs`, `pdfkit`, `@supabase/supabase-js`
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
   4. Report   -> [ Export PDF ]  [ Compare Another URL ]
                        |                 |
                  PDF download     new current URL -> capture -> analyze -> new report
                                   (same baseline; the old report goes to Comparison History)
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
| `current_captured` | "Current Deployment Captured ✓", counts (`Baseline: 9 pages · Current: 5 of 9 pages`), failed pages with reasons, **View Current Pages** grid, plus the **Analyze Changes** card with its button |
| `analyzing` | "Analyzing Visual Changes" + spinner and two explanation lines. No percentage bar (the real progress is unknown). Polls every 1.5 s |
| `completed` | **Visual Regression Report** (see below) |
| `failed` | Baseline never captured: "Baseline capture failed." + **Try Again**. Baseline captured but current failed: "Current capture failed." + **Try Again** in the current card. Both captured but the analysis failed: "Analysis failed." + **Try Again** in the Analyze card |

`failed` is used by all three jobs and the data tells them apart: no `baseline_pages` screenshots = the baseline failed; baseline screenshots but no `current_pages` screenshots = the current capture failed; both present = the analysis failed. **Try Again** re-runs only that job. A failed analysis never recaptures anything. `capture-current` and `capture-baseline` are refused once the current version / baseline exists.

**Report** (`ComparisonReport.jsx`, shown when `completed`). Title "VISUAL REGRESSION REPORT", then one message: **VISUAL CHANGES DETECTED** (at least one changed page) or **NO VISUAL CHANGES DETECTED**. Baseline URL and current URL. Summary: Pages Compared, Changed, Unchanged, Unavailable, plus the threshold sentence. One card per baseline page: "Page 02", path, mismatch %, badge (CHANGED / UNCHANGED / UNAVAILABLE) and three images: Baseline, Current, Diff. Unavailable pages show the reason instead of images. Small images show the top of the page; a click opens the full screenshot in a simple lightbox (Close button, click outside, or Escape). Every number is read from the saved `results`; there is no overall score. Export PDF and Compare Another URL come in later stages.

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
                              SUPABASE DATABASE  (`tests` + `comparisons` tables)
```

- **React:** screens, Supabase login, polling the API, showing images.
- **Express:** checks the user's token, runs the jobs, saves files, reads and writes the `tests` and `comparisons` tables, builds the PDF report (pdfkit).
- **Playwright:** crawls and screenshots. It is not used for the PDF.
- **Resemble.js:** compares two PNGs, returns mismatch % and a diff PNG.
- **Supabase:** who the user is (Auth) and which tests they ran (DB). It does not store screenshots in the MVP.

### Folder structure

```
Meetmux/
├── REQUIREMENTS.md
├── backend/
│   ├── package.json          "type": "module", canvas override, pdfkit
│   ├── .env.example
│   ├── server.js             Express setup, /files static, error handler
│   ├── auth.js               middleware: verify token, set req.user and req.db
│   ├── supabase.js           creates the per-user Supabase client
│   ├── screenshotter.js      Playwright: captureBaseline (crawl) and captureCurrent (baseline paths only), shared helpers
│   ├── routes/tests.js       /api/tests routes, background capture jobs, in-memory progress
│   ├── routes/comparisons.js /api/comparisons routes: open or export an older, saved comparison
│   ├── comparisons.js        Compare Another URL: saves the finished report to history and moves its files
│   ├── comparer.js           Resemble.js: compares the saved baseline and current screenshots, writes diff images
│   ├── report.js             builds the PDF report from saved results and PNG files (pdfkit)
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
                              DeleteDialog, BaselineCapture, CurrentCapture, ScreenshotGrid,
                              AnalysisPanel (Analyze step), ComparisonReport (report + lightbox + Export PDF + Compare Another URL),
                              ComparisonHistory (older comparisons)
```

Routes live in `routes/tests.js` and `routes/comparisons.js`; `server.js` only sets up Express.

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

**Analyze.** `POST /api/tests/:id/analyze`. Same pattern as the captures: ownership check, atomic claim (`analyzing`, old results cleared), `202 { testId, status }`, background run, polling. `comparer.js` reads the saved PNGs (no browser, no crawling, nothing recaptured), compares each baseline page with the current page of the same index through Resemble.js, and writes diff PNGs to `storage/<id>/diff/` (emptied first, so a retry leaves no stale diffs). Express saves `results`, `pages_tested` (pages really compared) and `pages_changed`, and sets `completed`. If not one page could be compared it sets `failed` with `error_message`. Baseline and current data and files are never written.

**Report.** React reads the same `GET /api/tests/:id`. `results` holds the image addresses (`/files/<id>/{baseline|current|diff}/page-<index>.png`), so the report survives a browser refresh.

**Export PDF.** `GET /api/tests/:id/report.pdf` (latest comparison) or `GET /api/comparisons/:id/report.pdf` (an older one). Express checks the token and ownership (404 for someone else's, 409 if the analysis is not completed) and calls `buildReportPdf` in `report.js`. It writes the PDF with `pdfkit` from the saved `results` and the PNG files on disk: header, baseline and current URL, generated time, summary, and one section per page with status, mismatch % and the baseline / current / diff images (a missing page gets an explanation and no image). Nothing is captured or compared again, no browser is started, and the PDF is not a screenshot of the web page. It is sent as `application/pdf` with the file name `visuguard-report-<first 8 characters of the test id>.pdf` (older comparison: `...-<first 8 characters of the comparison id>.pdf`). React fetches it with the token, turns the response into a Blob and saves it through a temporary link (`downloadPdf` in `api.js`).

**Compare Another URL.** One baseline, many comparisons. The `tests` row keeps the baseline and the **latest** comparison (`current_url`, `current_pages`, `results`). Every older comparison is a row in `comparisons`.
1. The report shows `[ Export PDF ]  [ Compare Another URL ]`. The second button opens the form "Compare Another Deployment": the baseline URL is shown read-only and only a new current URL is asked for.
2. `POST /api/tests/:id/capture-current { currentUrl }` is the same endpoint as the first capture. When the test is `completed`, `archiveComparison` (`comparisons.js`) first saves the finished comparison: it inserts a `comparisons` row (current URL, current pages, results, counts) and moves `storage/<id>/current/` and `diff/` to `storage/<id>/comparisons/<comparisonId>/`. The addresses inside the saved `results` and `current_pages` are rewritten to the new folder. If a later step fails, the archive is undone.
3. The test row is reset to `capturing_current` with the new URL, and the normal capture runs (baseline paths only, no crawl). The form then starts the analysis by itself when the capture is done ("Capture & Compare"). The same `comparer.js` and the same 0.1 % threshold are used.
4. The report page shows a **Comparison History** list (older comparisons: URL, changed / compared, date, View Report). Opening one calls `GET /api/comparisons/:id` and shows the saved report with its own Export PDF button. Nothing is recomputed. The latest comparison is the report above the list.
5. The baseline (`baseline_url`, `baseline_pages`, `baseline/*.png`) is never written by any of this. There is no `clone` endpoint and no copy of the baseline.
6. If the new capture fails, the previous report is already safe in the history and the form offers Try Again (the baseline is untouched).

**Delete.** `DELETE /api/tests/:id` removes the row and the folder `storage/<id>/` (baseline, current, diff and every `comparisons/<comparisonId>/` folder). The `comparisons` rows are removed by `on delete cascade`.

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

**Compare** (`comparer.js`). For every baseline page (in order) it finds the current page with the same `index` and compares the two PNGs with `compareImages` from `resemblejs/compareImages.js`:
- `MISMATCH_THRESHOLD = 0.1` (percent) is one constant at the top of `comparer.js`. A page is `changed` when its mismatch is **more than** 0.1, `unchanged` when it is 0.1 or less.
- `output.largeImageThreshold: 0`. Without it Resemble skips pixels on images larger than 1200 px, which is not accurate for full-page shots.
- `ignore: 'antialiasing'` reduces false positives on the soft edges of text.
- The mismatch is Resemble's `misMatchPercentage`, which has 2 decimals ("0.13"). The status is decided on that same number, so what the report shows explains the status.
- Different image heights are fine: Resemble pads to the larger size, counts the extra area as different, and reports `isSameDimensions: false` (saved as `sameSize`).
- Every compared page gets a diff PNG: `diff/page-<index>.png` (`data.getBuffer()`).
- A problem with one page never stops the others. The page gets a status instead: `missing_baseline` (no baseline screenshot), `missing_current` (not captured on the current site), `error` (a file could not be read or compared). These count as unavailable.
- Verified with exact pixel counts (a 1280x720 page has 921,600 pixels): 460 px = 0.05 % unchanged, 900 px = 0.10 % unchanged, 1152 px = 0.13 % changed, 4608 px = 0.50 % changed, identical pages = 0.00 %.

**Storage layout (local disk).**

```
backend/storage/<testId>/baseline/page-001.png ...
                       /current/page-001.png ...
                       /diff/page-001.png ...     (every compared page)
                       /comparisons/<comparisonId>/current/page-001.png ...   older comparison (Compare Another URL)
                       /comparisons/<comparisonId>/diff/page-001.png ...
```

**The baseline is shared. `current/` and `diff/` belong to one comparison.** The latest comparison lives in `current/` and `diff/`. When Compare Another URL starts, those two folders are moved to `comparisons/<comparisonId>/`, so an old report keeps its own screenshots. `baseline/` never moves and is never written after the capture.

Express serves it at `/files/<testId>/...`. Each test has its own folder, so deleting one test never breaks another.

**`results` column (JSON)**, written by the analysis. One entry per baseline page, in baseline order:

```json
{
  "threshold": 0.1,
  "pages": [
    { "index": 1, "path": "/", "title": "Home", "baseline": "/files/<id>/baseline/page-001.png", "current": "/files/<id>/current/page-001.png", "diff": "/files/<id>/diff/page-001.png", "mismatchPercentage": 0, "sameSize": true, "status": "unchanged" },
    { "index": 2, "path": "/about", "title": "About", "baseline": "...", "current": "...", "diff": "...", "mismatchPercentage": 7.43, "sameSize": true, "status": "changed" },
    { "index": 4, "path": "/contact", "title": "", "baseline": "/files/<id>/baseline/page-004.png", "current": null, "diff": null, "mismatchPercentage": null, "status": "missing_current", "error": "The page returned HTTP 404." }
  ]
}
```

`results.analyzedAt` (ISO time of the analysis) is shown in the report, the history list and the PDF. An older comparison stores the same shape in `comparisons.results`, with `current` and `diff` pointing into `/files/<id>/comparisons/<comparisonId>/...` (`baseline` is unchanged).

Summary numbers are counted from `pages`: Pages Compared = changed + unchanged, Unavailable = every other status. `pages_tested` (compared) and `pages_changed` (changed) are also saved as columns for the history list. `avg_mismatch` is not used: there is no overall score.

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
  results        jsonb,   -- { threshold, pages: [...] } written by the analysis, see section 8
  pages_tested   int,
  pages_changed  int,
  avg_mismatch   numeric, -- not used (no overall score)
  created_at     timestamptz not null default now()
);

alter table tests enable row level security;

create policy "users manage their own tests"
  on tests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

A second table keeps the older comparisons of a test (Compare Another URL). Run this SQL once in the Supabase SQL editor (stage 7):

```sql
create table comparisons (
  id            uuid primary key default gen_random_uuid(),
  test_id       uuid not null references tests(id) on delete cascade,  -- deleting a test deletes its history
  user_id       uuid not null references auth.users(id) on delete cascade,
  current_url   text not null,
  current_pages jsonb,   -- same shape as tests.current_pages, screenshot paths point into comparisons/<id>/current/
  results       jsonb,   -- same shape as tests.results, image addresses point into comparisons/<id>/
  pages_tested  int,
  pages_changed int,
  created_at    timestamptz not null default now()
);

create index comparisons_test_id_idx on comparisons (test_id);

alter table comparisons enable row level security;

create policy "users manage their own comparisons"
  on comparisons for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

One `tests` row = one baseline + the latest comparison (current URL, current pages, results). One `comparisons` row = one finished, older comparison of the same baseline. Only finished comparisons are saved there, so it has no status column. Per-page data sits in JSON columns to keep the MVP simple.

**Status values:** `created`, `capturing_baseline`, `baseline_captured`, `capturing_current`, `current_captured`, `analyzing`, `completed`, `failed`.

The live table was created with the old default (`capturing_baseline`). The backend always sets `status` itself, so it works either way. Optional clean-up: `alter table tests alter column status set default 'created';`

## 10. API (Express)

All routes except `/api/health` need the bearer token (401 without it; a test or comparison of another user is a 404). A route returns 409 if the test is already running a job. URLs must be `http` or `https`.

| Method and path | Body | What it does |
|---|---|---|
| GET `/api/health` | | Check the server is up |
| GET `/api/tests` | | History: my tests, newest first (summary columns only) |
| POST `/api/tests` | `{ baselineUrl }` | Create the test (status `created`), return `{ test }` |
| POST `/api/tests/:id/capture-baseline` | | Start the baseline capture in the background, return `202 { testId, status }`. 409 if it is running or already captured. Allowed from `created` and `failed` |
| GET `/api/tests/:id` | | Full row + `progress` (polling and report) |
| POST `/api/tests/:id/capture-current` | `{ currentUrl }` | Start the current capture (baseline paths only) in the background, return `202 { testId, status }`. 400 invalid URL. 409 if it is running, the baseline is missing, or the current version is captured but not analyzed yet. Allowed from `baseline_captured`, from `failed` (when a baseline exists and no current capture), and from `completed` = **Compare Another URL** (the finished report is saved to history first) |
| POST `/api/tests/:id/analyze` | | Compare the saved screenshots in the background, return `202 { testId, status: "analyzing" }`. 409 if a job is running, the baseline or current version is missing, or the analysis is complete. Allowed from `current_captured` and from `failed` (both captures exist) |
| GET `/api/tests/:id/comparisons` | | Older, saved comparisons of the test, newest first (`id, current_url, pages_tested, pages_changed, analyzed_at`) |
| GET `/api/tests/:id/report.pdf` | | PDF of the latest report. 409 unless `completed`. `Content-Type: application/pdf` |
| GET `/api/comparisons/:id` | | One older comparison: saved results, current URL and the baseline URL |
| GET `/api/comparisons/:id/report.pdf` | | PDF of an older comparison |
| DELETE `/api/tests/:id` | | Delete row (comparison rows cascade) and all files, including old comparisons |
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

Stage 1 installed only what it needs: `express` and `@supabase/supabase-js` (backend), `react`, `react-dom`, `@supabase/supabase-js`, `vite`, `@vitejs/plugin-react` (frontend). `playwright` was added in stage 4 (run `npx playwright install chromium` once); `resemblejs` was added in stage 6; `pdfkit` (the only PDF dependency) in stage 7; the `canvas` override is already in `backend/package.json`.

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
- [x] Compare Another URL (same baseline, every report kept)
- [x] Export PDF (real PDF built on the server)

## 13. Build stages (estimates, 12 h total)

| Stage | Goal | Time |
|---|---|---|
| 0 | Analysis + this file | done |
| 1 | Scaffold both apps, own git repo, env files, `/api/health`, Vite proxy, Supabase client stubs. (Supabase project + table are created by hand, before stage 2.) | done |
| 2 | Landing, Auth (email, forgot password, Google), session handling, dashboard shell, logout, avatar | done |
| 3 | Test management: create, list, open, delete tests; protected API (`auth.js`) + RLS | done |
| 4 | Baseline capture: `screenshotter.js` (Playwright crawl), screenshots on disk, polling, screenshot grid | done |
| 5 | Current capture: reuses the baseline paths, no crawling, `capture-current`, current screenshot grid | done |
| 6 | Comparison + report: `comparer.js` (Resemble.js), `analyze` endpoint, diff images, `ComparisonReport` with lightbox | done |
| 7 | PDF export (`report.js`, pdfkit) and Compare Another URL (`comparisons` table, `comparisons.js`, comparison history) | done |
| 8 | Error handling, demo sites, polish | 1.5 h |
| - | Buffer | 2 h |

**Demo plan (stage 8):** two tiny static demo sites (v1 and v2 with small visible changes such as a colour, a moved button and a removed page), served on two local ports by a small Express script, so the demo does not depend on a third-party site.

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
- The report's small images show only the top of a tall page. The diff and the full screenshot are one click away in the lightbox.
- A current capture that succeeded but was not analyzed yet cannot be replaced. Analyze it first, then use Compare Another URL. A failed current capture can be retried.
- Only finished comparisons are kept in history. If a Compare Another URL capture fails, the previous report is already in the history and the new attempt is not saved.
- Older comparisons cannot be deleted one by one, only together with their test.
- The PDF shows each screenshot scaled into a small box, so a tall page is small. The full-size images are in the report.
- The PDF uses the built-in PDF font: text with characters outside Latin-1 (for example some page paths) may print incorrectly.

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
6. For the next deployment the user clicks Compare Another URL: the same baseline is compared with a new current URL, and every earlier report stays available in the history.
