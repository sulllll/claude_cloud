---
name: code-motion-reel
description: Make showreel-grade motion-graphics videos (10–30s, 1920×1080, 60fps, with a synthesized soundtrack) from pure code — a deterministic HTML canvas animation plus a Web Audio score, rendered to MP4 with Playwright + ffmpeg and optionally embedded as a live full-screen intro on a website. Use this whenever the user asks for a motion graphic, showreel, intro/opening video, promo or teaser clip, animated title sequence, kinetic typography, "영상 만들어줘", 모션그래픽, 쇼릴, 인트로 영상, 오프닝, 홍보 영상, or any video that must be generated without video-editing tools, stock assets, or music/voice APIs — even if they only say "make it look amazing" or "go all out". Also use it to add a cinematic intro to a site, or to re-theme the MARKET PULSE reel for a new topic.
---

# Code Motion Reel

Build a short film where **every pixel and every sound is computed from `t`**. One file (`reel.js`) exposes
`frame(ctx, t, data)` and `buildAudio(ac, when, offset)`. Because both are pure functions of time, the same code:

- plays live in a browser (a first-visit intro, a hero banner),
- renders frame-by-frame into a pixel-perfect MP4 with a sample-accurate soundtrack.

A complete, working reference lives in `assets/example/` (the "MARKET PULSE" market reel: opening bell →
bull run → crash + circuit breaker → global rebound → sector heatmap → live search countdown → logo).
**Start by reading `assets/example/reel.js`** — reuse its helpers (easings, odometer, glow, post-FX compositor,
synth instruments) rather than rewriting them; replace the scenes and the story.

## Workflow

1. **Storyboard first, in a table** (scene · time range · beat count · hero visual · motion · sound).
   Follow the dramatic arc in `references/storyboard.md`: hook → build → impact → recovery → showcase →
   data/personal payoff → logo lock-up. Snap every cut to the beat grid (120 BPM → 0.5s per beat, so a
   15s reel is 30 beats). Pick the topic's own visual metaphors (charts for markets, circuits for tech,
   maps for travel…) — the arc is generic, the imagery must not be.
2. **Copy the engine**: `assets/example/reel.js` → `<site>/reel/reel.js`, `assets/example/render.html` →
   `<site>/reel/render.html`. Keep: math/easing helpers, `rng`/`hash`, `text`/`glow`/`odometer`,
   `background`, `hud`, `overlays`, `frame` (post-FX), and the audio instrument functions. Replace:
   the data constants, the scene functions `s1…s7`, `SECTIONS`, `FLASHES/SHAKES/CHROMA`, and the
   event list at the bottom of `buildAudio`.
3. **Write scenes** as `function sN(g, t)` that return early outside their window and draw in logical
   1920×1080 coordinates. Overlap neighbouring scenes by 0.1–0.3s for transitions. Motion vocabulary
   and ready-made patterns: `references/motion-vocabulary.md`.
4. **Score it** with the synth kit (kick, snare, hats, bass, pad, pluck, riser, whoosh, impact, bell,
   tick, blip). Music follows the edit: grooves only in "energy" scenes, silence/tension before the
   biggest hit, an impact on every major cut. See `references/sound-design.md`.
5. **QA with stills before the full render** (a full 60fps render takes minutes; stills take seconds):
   ```bash
   NODE_PATH=$(npm root -g) node <skill>/scripts/render.mjs --root site --page reel/render.html \
     --stills 0.5,1.3,2.6,3.6,4.56,5.3,5.9,6.8,7.6,8.9,9.8,10.4,11.9,12.5,13.3,13.8,14.4
   python3 <skill>/scripts/contact_sheet.py reel-stills
   ```
   Look at every sheet. Check: text overflowing boxes, elements colliding (especially fly-throughs),
   things clipped at the frame edge, HUD overlapping content, fonts actually loaded (the `ready` log
   lists loaded fonts — an empty list means fallback fonts). Fix and re-shoot until clean.
6. **Render**:
   ```bash
   NODE_PATH=$(npm root -g) node <skill>/scripts/render.mjs --root site --page reel/render.html \
     --out site/reel/reel.mp4 --fps 60 --crf 25 --poster 14.4
   python3 <skill>/scripts/loudness.py site/reel/reel.wav
   ```
   The loudness chart must show hits exactly where the edit has them. The script prints the raw peak:
   **above 1.0 means the live browser version will clip** — lower the `out` trim gain after the
   compressor. After audio-only changes use `--remux` (re-renders sound, keeps frames; seconds, not minutes).
   CRF 25 keeps a 15s 1080p60 reel at ~6–7MB (CRF 20 was 24MB — too heavy for a web page).
7. **Embed as a site intro** if asked (or if the reel is for a site): see `references/web-intro.md` —
   full-screen overlay on first visit, skip button + Esc, sound toggle (browsers block autoplay audio,
   so audio starts on click at the current offset), replay button, `#intro` hash, respects
   `prefers-reduced-motion`, and live data injected into the data scene.
8. **Deliver**: send the MP4 to the user, commit `reel.js`, `render.html`, the MP4 and poster
   (gitignore the stills folder and the `.wav`).

## The look (what made it feel like a pro showreel)

These choices are the "feel". Keep them unless the user asks for a different style.

| Element | Choice | Why |
|---|---|---|
| Canvas | 1920×1080 logical, near-black `#05060a` base, section-tinted radial glow | Dark stage makes glows and colour pop |
| Palette | 3 semantic accents + white: good `#1ef2a0`, bad `#ff3355`, highlight `#ffb627`, info `#4d7cff` | Colour carries story (green run, red crash); never decoration |
| Type | Display: Space Grotesk 700 · numbers/HUD: JetBrains Mono · Korean: Noto Sans KR 500/700/900 | Big confident display + technical mono = "broadcast" |
| HUD | Corner brackets, reel title, blinking REC dot + section name, SMPTE-style timecode | Instantly reads as a showreel/broadcast frame |
| Texture | Vignette, 4px scanlines at 7%, animated grain at 5% | Removes the "flat vector" look |
| Motion | outExpo for entrances, inExpo for exits, outBack for pops, per-letter stagger 25–35ms, mask reveals | Snappy, deliberate, never linear |
| Impacts | White/colour flash + screen shake + RGB split + glitch slices, all decaying exponentially | Sells every cut; driven by one table of timestamps |
| Numbers | Odometer digits that roll, counting to the value | Data feels alive |
| Camera | Scenes zoom/pan/tilt (follow the chart head, fall with the crash, fly into the globe) | Continuous camera = one film, not slides |
| Rhythm | Cuts on beats, beat pulse (`pulse(t)`) scales content 1–1.5% and brightens the grid | Picture and sound lock together |
| Payoff | One scene uses real, current data (e.g. today's top searches), fetched live on the site | Makes it personal and "live" |
| End | Letters converge into a logo, EKG/underline draws in, closing sound, fade to black | Clean, memorable lock-up |

## Pitfalls already solved (don't rediscover them)

- **Determinism**: never use `Math.random()` or wall-clock time inside drawing — use the seeded `rng()`
  for precomputed data and `hash(n)` for per-frame flicker. Otherwise the MP4 and the live intro differ.
- **`shadowBlur` ignores transforms**: multiply blur by the device scale (`glow()` does this via `S`).
- **Gradients are in the transform at fill time**: a gradient created outside a per-letter
  `translate` will be wrong inside it — compute per-letter colours instead.
- **Chrome's DynamicsCompressor adds make-up gain** (raw peak hit 1.9): put a trim gain (0.5) after it.
- **Fonts in headless Chromium behind a TLS-intercepting proxy**: the bundled Chromium may not trust the
  proxy CA. Don't disable certificate checks; `render.mjs` fetches Google Fonts via `curl` and fulfils the
  requests itself. Don't route the browser through the proxy (loopback pages then return 405).
- **Always `await Reel.loadFonts()`** before the first frame, or the first frames use fallback fonts.
- **Fit text to its box**: measure at a base size and scale down (`(w - padding) / measuredWidth`).
- **Fly-through lists collide**: push items off-axis as they grow (radius ∝ scale) and give the
  final/hero item its own later slot.
- **`letterSpacing` on canvas** is Chromium-only; guard with `'letterSpacing' in ctx`.
- **Web test servers**: read the file before `writeHead`, or a 404 crashes the server.

## Adapting to a new topic

Keep the arc and the engine; swap metaphors, data and copy. Examples:
product launch (blueprint lines → assembly → "sold out" impact → world map of shipments → feature grid →
live signup counter → logo); sports season (whistle → highlight counters → injury/defeat hit →
comeback → league table → live standings → crest); personal portfolio (terminal boot → skills odometers →
"deadline" glitch → shipped projects globe → tech grid → live GitHub stats → name).
Ask the user only for things you can't infer: topic, length if not ~15s, language of on-screen copy,
and any brand name/colours. Otherwise decide and go.
