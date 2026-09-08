Mario Kart Anti-Bagging Research Lab — V2.1.1
==============================================

PURPOSE
V2.1.1 is a laboratory upgrade only. The V2.1 anti-bagging mechanics are intentionally frozen.
This build improves adversarial coverage and adds telemetry for the disruption-grace loophole.

FILES
- index.html          UI / app structure
- styles.css          styling
- app.js              simulator + analytics + exporters
- app.js.txt          identical copy of app.js for easy viewing in ChatGPT environments
- MKF-C2Z-SCHEMA.txt  report format / decoding notes

RUNNING THE LAB
1. Extract the ZIP.
2. Keep index.html, styles.css, and app.js in the same folder.
3. Open index.html in a normal browser.
4. If local linked scripts are blocked, use GitHub Pages, VS Code Live Server, or: python -m http.server

WHAT CHANGED FROM V2.1
- Fixed exploit-hunter coverage bug: standard AIs are no longer filled sequentially until a cap.
- Balanced Attack: 36 tests, exactly six representative parameter points per standard bagger AI.
- Full Attack: all 162 combinations across 6 standard AIs × 3 debt values × 3 effort windows × 3 effort sensitivities.
- Grace-Abuse Attack: a dedicated attacker races normally until disruption grace exists, then deliberately slows during grace.
- Grace parameter sweep: 0 / 1.4 / 2.8 / 4.2 seconds.
- New telemetry: grace-laundered losses, potential avoided debt, low-intent grace time, and non-bagger false-debt burden.
- Attack top-3 comparisons use all Bagger strategy runs, avoiding activation-selection bias.
- Attack suites are stored separately in the forensic export so running one does not erase the others.

IMPORTANT
The telemetry does not alter V2.1 classification, debt, credit, ERP, item tables, grace behavior, or comeback mechanics.
A loss is flagged as potentially laundered only for analysis when low driver intent occurs inside active disruption grace and the loss is validated.

RECOMMENDED ORDER
1. Run full lab
2. Run stress matrix
3. Run Balanced Attack
4. Run Grace-Abuse Attack
5. Run Full Attack if you want exhaustive standard-AI coverage
6. Export MKF-C2Z and upload it back to ChatGPT

PRIMARY FORENSIC FORMAT
MKF-C2Z remains the primary report format. The embedded schema now includes the additional grace-laundering telemetry fields.
