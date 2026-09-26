# Storyboard: the showreel arc

A 15s reel = 30 beats at 120 BPM. Cut on beats; put the biggest hit on a downbeat.

| # | Role | Time (15s) | Beats | What it must do | MARKET PULSE example |
|---|---|---|---|---|---|
| 1 | Hook | 0–2.0 | 4 | Start from nothing (a dot/line), a countdown or tick, one sharp hit at ~1.0s, title reveal | Horizon line, clock 08:59:57→09:00:00, bell, "THE MARKETS" rises |
| 2 | Build | 2.0–4.5 | 5 | Energy + data: something growing, a camera that follows, rolling numbers, groove starts | Candles build, camera tracks head, KOSPI odometer, ticker tape |
| 3 | Impact | 4.5–6.5 | 4 | The twist. Silence the groove, biggest hit, glitch/shake, then a "freeze" beat | Red plunge + sparks, SELL-OFF slam, circuit breaker stripes + halt timer |
| 4 | Recovery / world | 6.5–9.0 | 5 | Release: bright colour, big 3D-ish object, flows/connections | Dot globe with capital-flow arcs, "V-SHAPED REBOUND", rising sweep |
| 5 | Showcase grid | 9.0–11.5 | 5 | Breadth: many items at once, staggered entrance, a mid-scene flip, explode out | Sector heatmap tiles flip in, values flip on a beat, tiles explode |
| 6 | Payoff (live data) | 11.5–13.5 | 4 | Personal/real data, countdown, warp speed, hero item lands | Top-10 searches fly through 10→1, #1 lands in amber |
| 7 | Lock-up | 13.5–15.0 | 3 | Logo assembles, underline/EKG draws, closing sound, credits, fade | Letters converge to MARKET PULSE, EKG, closing bell, URL |

## Transition recipes (between scenes)

| Transition | How |
|---|---|
| Zoom-through | Outgoing scene scales 1→5 with inExpo over 0.3s and fades; incoming scales 1.3→1 with outExpo |
| Camera follow | Keep drawing the previous scene in the same transform while the camera moves (crash falls, camera tilts down) |
| Band wipe | Warning stripes/bars grow from top and bottom until they meet, flash, cut |
| Fly-into-object | Hero object's radius ×5 with inExpo while it recentres, then white flash |
| Explode | Every tile/letter flies outward from centre (direction = atan2 from centre) with rotation, fade |
| Flash cut | 0.2–0.35s exponential white flash + chroma + shake spike at the cut timestamp |

## Scaling the length

- 10s: merge Build+Impact, drop Showcase. 20–30s: add a second Build/Showcase pair; keep ONE biggest hit.
- Change `DURATION`, the scene windows, `SECTIONS`, `FLASHES/SHAKES/CHROMA`, `PROG` (chords) and `kickOn()` together.
