Mario Kart Anti-Bagging Research Lab — V2.1
============================================

FILES
- index.html       UI / app structure
- styles.css       styling
- app.js           simulator + analytics + exporters
- app.js.txt       identical copy of app.js for easy viewing in ChatGPT environments
- MKF-C2Z-SCHEMA.txt  report format / decoding notes

RUNNING THE LAB
1. Extract the ZIP.
2. Keep index.html, styles.css, and app.js in the same folder.
3. Open index.html in a normal browser.
4. If your browser blocks local linked scripts, serve the folder with GitHub Pages,
   VS Code Live Server, or: python -m http.server

app.js.txt is only a viewing fallback. index.html loads app.js.

V2.1 CHANGES
- No strategy receives a free speed multiplier.
- Bagger steering schedules are frozen across Instant / V1 / V2.1.
- Exogenous randomness is keyed by race/player/tick/box so RNG streams do not drift
  simply because one system took an extra random branch.
- Competitive effort is a rolling multi-second signal, not a single-tick check.
- Deliberate low-effort position losses create Voluntary Disadvantage Debt.
- Debt must be repaid with validated competitive distance before ERP or comeback
  credit can grow again.
- Disruption grace supplies virtual competitive distance so item hits do not falsely
  suppress legitimate recovery.
- Front-running credit decays faster instead of being banked indefinitely.
- Blue Shell is treated as a race-state / leader-control item in V2.1 rather than a
  standard deep-comeback reward.
- Race-health comparisons use cohorts defined in the Instant control and track those
  same player IDs through V1 and V2.1.
- Sacrifice/payoff slope controls for skill and bagger AI.
- Bagger archetype scoreboard is included.
- Exploit hunter now searches debt size, effort window, effort sensitivity, and bagger AI.

PRIMARY FORENSIC FORMAT
MKF-C2Z is the primary report format.
- The archive is first converted to MKF-C2: a self-describing fixed-schema integer-
  quantized representation.
- It is then gzip-compressed and Base64 wrapped as text.
- Output begins with: MKF-C2Z|
- The file remains a normal .txt file and can be uploaded back into ChatGPT.
- If CompressionStream is unavailable, the app automatically falls back to plain MKF-C2.

Raw JSON and NDJSON are still available under Advanced / huge raw exports, but are no
longer generated unless explicitly requested.

SMOKE TEST
This build was syntax checked, all app.js DOM references were checked against index.html,
and the main workflow was executed in headless Chromium with 50 paired races:
- architecture booted successfully
- Run completed
- six headline metric cards populated
- bagger AI scoreboard populated
- forensic report generated
- MKF-C2Z compression succeeded
- no runtime errors were reported
