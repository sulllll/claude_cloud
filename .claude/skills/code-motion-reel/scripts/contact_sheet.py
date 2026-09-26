"""Tile still frames into contact sheets so a whole reel can be reviewed in one image.

    python3 contact_sheet.py reel-stills [--cols 3] [--per-sheet 12] [--width 640]

Writes sheet_1.jpg, sheet_2.jpg ... into the stills folder (frames sorted by time; each tile
is labelled with its timestamp from the file name, e.g. t04.56.jpg -> 4.56s).
"""
import argparse, glob, os, re, subprocess, sys


def ffmpeg():
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--per-sheet", type=int, default=12)
    ap.add_argument("--width", type=int, default=640)
    a = ap.parse_args()
    key = lambda p: float(re.search(r"t([\d.]+)\.jpg$", p).group(1))
    frames = sorted(glob.glob(os.path.join(a.folder, "t*.jpg")), key=key)
    if not frames:
        sys.exit("no t*.jpg stills found")
    w, h = a.width, a.width * 9 // 16
    for n, i in enumerate(range(0, len(frames), a.per_sheet), 1):
        batch = frames[i:i + a.per_sheet]
        inputs = [x for f in batch for x in ("-i", f)]
        layout = "|".join(f"{(k % a.cols) * w}_{(k // a.cols) * h}" for k in range(len(batch)))
        out = os.path.join(a.folder, f"sheet_{n}.jpg")

        def graph(label):
            chains = []
            for k, f in enumerate(batch):
                tag = (f",drawtext=text='{key(f):.2f}s':x=10:y=10:fontsize=22:fontcolor=yellow:"
                       f"box=1:boxcolor=black@0.6") if label else ""
                chains.append(f"[{k}:v]scale={w}:{h}{tag}[v{k}]")
            g = ";".join(chains) + ";" + "".join(f"[v{k}]" for k in range(len(batch)))
            return g + (f"xstack=inputs={len(batch)}:layout={layout}:fill=black[o]" if len(batch) > 1 else "null[o]")

        cmd = lambda label: [ffmpeg(), "-loglevel", "error", "-y", *inputs, "-filter_complex", graph(label), "-map", "[o]", out]
        # some static ffmpeg builds lack drawtext (no freetype): fall back to unlabelled tiles
        if subprocess.run(cmd(True), stderr=subprocess.DEVNULL).returncode != 0:
            subprocess.run(cmd(False), check=True)
        print(out, "=", ", ".join(f"{key(f):.2f}s" for f in batch), f"(row-major, {a.cols} per row)")


if __name__ == "__main__":
    main()
