# Motion vocabulary (all present in assets/example/reel.js)

| Technique | Where in reel.js | Notes |
|---|---|---|
| Easings `E.outExpo / inExpo / outBack / outElastic / inOutCubic` | top | outExpo = "snap in", inExpo = "whip out", outBack = pop with overshoot |
| `prog(t, a, b)` | top | 0→1 progress of t through [a,b], clamped. Build every animation from it |
| Per-letter stagger + mask reveal | `s1` (THE MARKETS) | clip to a rect above a line, letters rise with `prog(t, t0 + i*0.035, …)` |
| Typewriter | `typed(str, p)` | with a blinking `▌` cursor on `Math.floor(t*8)%2` |
| Odometer numbers | `odometer()` | true odometer carry; tight clip (0.8×size above, 0.06 below baseline) |
| Glow | `glow(g, color, blur)` / `noGlow(g)` | scales blur by device scale `S`; reset after use (it is expensive) |
| Slam text + echoes | `s3` SELL-OFF | scale 2.8→1 outExpo, 3 stroked copies expanding and fading |
| Squash exit | `s3` | scaleY → 0 with inExpo over 0.18s |
| Warning stripes | `stripes()` | clipped diagonal polygons scrolling with t |
| Particle sparks | `SPARKS` + `s2` | precomputed velocities, gravity, draw as short streaks along velocity |
| Dot globe | `GLOBE` + `s4` | fibonacci sphere, crude continent ellipses → land dots brighter; y-rotate then x-tilt |
| Great-circle arcs | `ARCS` in `s4` | slerp between unit vectors, lift by sin(πq), draw head→tail window, cycle per arc |
| Tile flip | `s5` | `scaleY = |cos(fp·π)|`, swap value at fp ≥ 0.5 — split-flap feel |
| Warp streaks | `STREAKS` + `s6` | radial lines, distance = frac(p + t·v), length ∝ d² |
| 3D fly-through | `s6` | scale = lerp(0.12, 3.4, inCubic(s)); offset from centre ∝ scale so items pass the camera |
| Letters converge | `s7` | each letter starts at a seeded random offset/rotation/scale, outExpo to place |
| EKG draw-on | `ekg()` + `s7` | piecewise-linear path drawn up to x(t) with a glowing head dot |
| Beat pulse | `pulse(t)` | exp decay per beat inside `kickOn(t)`; use for scale bumps and brightness |

## Post-FX compositor (`frame()`)

1. Draw the scene into an offscreen buffer (letterboxed, logical coords via `setTransform(s,0,0,s,ox,oy)`).
2. Composite to the target with shake offset and slight overscale so edges never show black.
3. Chromatic aberration: copy buffer, `multiply` by `#ff0000` (red channel) and `#00ffff` (cyan);
   draw red at +dx, then `lighter` cyan at −dx. Exact channel split, no pixel loops.
4. Glitch slices: redraw random horizontal bands of the buffer with an x offset.
5. Flashes, vignette, scanlines, grain and the final fade happen in `overlays()` before compositing.

All impact FX come from three timestamp tables: `FLASHES`, `SHAKES`, `CHROMA` — edit those, not the code.
