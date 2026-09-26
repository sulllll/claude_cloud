"""Print a loudness-over-time bar chart of a 16-bit WAV so the soundtrack can be checked by eye.

    python3 loudness.py reel.wav [--step 0.25]

Hits (impacts, drops) should appear exactly where the edit has them; breakdowns should dip.
"""
import argparse, array, math, wave

ap = argparse.ArgumentParser()
ap.add_argument("wav")
ap.add_argument("--step", type=float, default=0.25)
a = ap.parse_args()
w = wave.open(a.wav)
sr, ch = w.getframerate(), w.getnchannels()
d = array.array("h", w.readframes(w.getnframes()))[0::ch]
win = int(sr * a.step)
peak = max(abs(x) for x in d) / 32768
print(f"peak {20 * math.log10(peak + 1e-9):.1f} dBFS")
for i in range(0, len(d), win):
    seg = d[i:i + win:8]
    rms = math.sqrt(sum(x * x for x in seg) / max(1, len(seg))) / 32768
    db = 20 * math.log10(rms + 1e-9)
    print(f"{i / sr:6.2f}s {db:6.1f} dB {'#' * max(0, int((db + 60) / 1.5))}")
