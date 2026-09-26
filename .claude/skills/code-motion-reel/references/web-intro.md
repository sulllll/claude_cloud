# Embedding the reel as a site intro

Markup (after `</main>`), then `<script src="reel/reel.js"></script>`:

```html
<div id="intro" hidden>
  <canvas aria-label="Intro video"></canvas>
  <div class="ui">
    <button type="button" id="intro-sound">🔊 소리 켜기</button>
    <button type="button" id="intro-skip">건너뛰기 ›</button>
  </div>
  <div class="bar"></div>
</div>
```

CSS essentials: `#intro{position:fixed;inset:0;z-index:1000;background:#000;transition:opacity .6s}`,
`#intro.leaving{opacity:0;pointer-events:none}`, canvas 100%×100%, `.bar` = 3px progress line at the bottom.
Load the reel's fonts on the page (Google Fonts `<link>` for Space Grotesk, JetBrains Mono, Noto Sans KR).

Behaviour (ready-made in `assets/example/intro.js` — include it after reel.js and adapt the two `// DATA` lines):

| Behaviour | Implementation |
|---|---|
| Autoplay once | play if `localStorage['reel-seen'] !== '1'` and not `prefers-reduced-motion`; set the flag on finish (wrap storage in try/catch) |
| Force play | `location.hash === '#intro'`; clear the hash on finish |
| Replay | a header button that turns sound on and calls `play()` (a click = user gesture, so audio is allowed) |
| Sound | browsers block autoplay audio: start muted; on click create `AudioContext` and `buildAudio(ac, ac.currentTime + 0.05, t + 0.05)` |
| Clock | `t = (performance.now() - start) / 1000`, `requestAnimationFrame` loop, finish at `Reel.DURATION` |
| Resolution | canvas = viewport × min(dpr, 2), capped at 2560px wide for performance; `frame()` letterboxes 16:9 |
| Skip | button + Esc: cancel the rAF loop, close the AudioContext, fade the overlay out |
| Live data | await the page's data fetch (max ~1.5s) and pass it as `frame(ctx, t, data)`; fall back to built-in data |
| Fonts | `await Reel.loadFonts(2500)` before the first frame |

Also offer the MP4 on the page: `<video src="reel/reel.mp4" poster="reel/reel-poster.jpg" controls playsinline preload="none">`
plus a download link. Test the intro headlessly: first visit plays, auto-closes after DURATION, second visit
doesn't autoplay, replay and skip work, no page errors.
