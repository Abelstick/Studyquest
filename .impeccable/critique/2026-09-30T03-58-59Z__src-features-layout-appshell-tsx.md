---
target: src/features/layout/AppShell.tsx
total_score: 24
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 2
timestamp: 2026-09-30T03-58-59Z
slug: src-features-layout-appshell-tsx
---
# Critique: sidebar (AppShell.tsx)
Method: dual-agent (A: acb4b9b457dff97df, B: a20ce2b4c4c7cebf7)
Score 24/36 (heuristic 10 n/a) = Good/Acceptable border (~26.7/40)

P1 Modern override erased the pixel identity (features.css 3348+).
P1 Small-text legibility: 7-8px pixel labels; NEW badge contrast 2.93:1; ONLINE pill overflows brand card at 248px.
P2 Too many always-on choices and badge noise (17 rows, 8 badges, 4 formats).
P2 Two stylesheets fight (base.css vs features.css); .sysbar__sync CSS is dead.
P3 Mobile drawer: rows ~36px, no Escape/focus trap, 100vh.
Detector: 11 findings, none in sidebar (pre-existing side-tab cards elsewhere).
