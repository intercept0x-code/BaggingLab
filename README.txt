Mario Kart Anti-Bagging Research Lab — V2.2 causal-grace build

WHAT CHANGED FROM V2.1.1
- The anti-bagging balance model advances from V2.1 to V2.2.
- Debt, ERP, credit spending, first-box behavior, and later-lap acceleration remain conceptually unchanged.
- Blanket disruption-grace validation is removed.
- V2.2 tracks driver control separately from game-caused slowdown.
- Each hit/disruption grants a bounded causal position-loss budget based on expected lost distance and nearby racers.
- Position losses spend that causal budget. Extra low-effort losses inside grace become voluntary debt normally.
- Grace still protects competitive recovery distance when current control remains >=72%.

FIXED CAUSAL-GRACE PARAMETERS
- Local gap buffer: 14 m
- Maximum active causal budget: 2 positions
- Current-control floor inside grace: 72%
- External slow multiplier in simulator: 0.43

LAB CHANGES
- Main lab reruns frozen V2.1 on identical roster/simulation seeds as a live regression reference.
- Stress Matrix compares V2.1 vs V2.2 directly.
- Grace-Abuse Attack compares V2.1 laundering with V2.2 protected vs blocked losses.
- Old floor-impossible absolute bagging gates are replaced with attainable health gates.
- Balanced and Full attacks continue to cover all six normal bagging AIs.

RECOMMENDED VALIDATION ORDER
1. Run full lab.
2. Run Stress Matrix.
3. Run Balanced Attack.
4. Run Full 162-config Attack.
5. Run Grace-Abuse Attack.
6. Download MKF-C3Z and send it back to ChatGPT.

FILES
- index.html
- styles.css
- app.js
- app.js.txt (same JavaScript source, TXT fallback for accessible viewing/downloading)
- MKF-C3Z-SCHEMA.txt
