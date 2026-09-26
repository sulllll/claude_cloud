// Full-screen first-visit intro player for a code reel (reel.js must be loaded first).
// Expects: #intro > canvas, .bar, #intro-sound, #intro-skip, a #replay-intro button, and a
// `historyPromise` (or any promise) resolving to the data the reel's live scene needs —
// adapt the two lines marked DATA to your page.
// ---- intro reel: plays on the first visit (or with #intro), drawn live from reel/reel.js
const intro = (() => {
  const el = document.getElementById("intro");
  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const bar = el.querySelector(".bar");
  const soundBtn = document.getElementById("intro-sound");
  let start = 0, raf = 0, ac = null, soundOn = false, data = null, playing = false;

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = innerWidth * dpr, h = innerHeight * dpr;
    const cap = 2560 / Math.max(w, 1);
    if (cap < 1) { w *= cap; h *= cap; }
    canvas.width = Math.round(w); canvas.height = Math.round(h);
  }
  function startSound(offset) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      Reel.buildAudio(ac, ac.currentTime + 0.05, offset + 0.05);
    } catch (e) { ac = null; }
  }
  function stopSound() { if (ac) { ac.close().catch(() => {}); ac = null; } }
  function setSound(on) {
    soundOn = on;
    soundBtn.textContent = on ? "🔇 소리 끄기" : "🔊 소리 켜기";
    stopSound();
    if (on && playing) startSound((performance.now() - start) / 1000);
  }
  function tick(now) {
    const t = (now - start) / 1000;
    Reel.frame(ctx, t, data);
    bar.style.width = Math.min(100, (t / Reel.DURATION) * 100) + "%";
    if (t >= Reel.DURATION) return finish();
    raf = requestAnimationFrame(tick);
  }
  function finish() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(raf);
    stopSound();
    el.classList.add("leaving");
    setTimeout(() => { el.hidden = true; el.classList.remove("leaving"); }, 650);
    try { localStorage.setItem("reel-seen", "1"); } catch (e) {}
    if (location.hash === "#intro") history.replaceState(null, "", location.pathname + location.search);
  }
  async function play() {
    if (playing || !window.Reel) return;
    el.hidden = false; el.classList.remove("leaving");
    size();
    const timeout = ms => new Promise(r => setTimeout(r, ms));
    const snaps = await Promise.race([historyPromise, timeout(1500).then(() => [])]); // DATA
    data = Reel.dataFrom(snaps && snaps[0]); // DATA
    await Reel.loadFonts(2500);
    playing = true;
    start = performance.now();
    if (soundOn) startSound(0);
    raf = requestAnimationFrame(tick);
  }
  soundBtn.onclick = () => setSound(!soundOn);
  document.getElementById("intro-skip").onclick = finish;
  document.getElementById("replay-intro").onclick = () => { setSound(true); play(); };
  addEventListener("keydown", e => { if (e.key === "Escape") finish(); });
  addEventListener("resize", () => { if (playing) size(); });
  return { play };
})();

(() => {
  let seen = false;
  try { seen = localStorage.getItem("reel-seen") === "1"; } catch (e) {}
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (location.hash === "#intro" || (!seen && !reduced)) intro.play();
})();
