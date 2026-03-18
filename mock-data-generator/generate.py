#!/usr/bin/env python3
"""
Mock Video Data Generator for Arvexis Editor & Engine Testing.

Generates test videos with alpha channels using system FFmpeg.
Videos contain various combinations of text overlays, shapes, colors,
positions, and durations — producing a diverse set of clips for
integration testing of the editor timeline, compositing pipeline,
and the runtime engine.

Usage:
    python generate.py                   # generate all combinations
    python generate.py --max 20          # cap output to 20 videos
    python generate.py --dry-run         # preview commands without running
    python generate.py --config cfg.json # load options from JSON file

Output goes to ./generated/ (git-ignored).

Requirements:
    - Python 3.8+
    - FFmpeg with libvpx (VP9+alpha) support on PATH
"""

import argparse
import itertools
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

# ──────────────────────────────────────────────────────────────────────────────
# Defaults
# ──────────────────────────────────────────────────────────────────────────────

DEFAULT_TEXTS: List[str] = ["Hello", "Test", "Arvexis", "Sample", "Demo"]

DEFAULT_SIZES: List[str] = ["640x480", "1280x720", "1920x1080"]

DEFAULT_DURATIONS: List[float] = [1.0, 3.0, 5.0, 10.0]

DEFAULT_SHAPES: List[str] = ["circle", "rectangle", "triangle", "diamond"]

DEFAULT_COLORS: List[str] = [
    "red",
    "green",
    "blue",
    "yellow",
    "cyan",
    "magenta",
    "white",
]

DEFAULT_POSITIONS: List[str] = ["left", "right", "center", "top", "bottom"]

OUTPUT_DIR = Path(__file__).resolve().parent / "generated"

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def _check_ffmpeg() -> str:
    """Return the path to ffmpeg or exit with a helpful message."""
    path = shutil.which("ffmpeg")
    if path is None:
        print("ERROR: ffmpeg not found on PATH. Please install FFmpeg.", file=sys.stderr)
        sys.exit(1)
    return path


def _position_xy(position: str, w: int, h: int, obj_size: int) -> tuple:
    """Return (x, y) for a named position inside a frame of size w×h."""
    margin = 20
    cx, cy = w // 2, h // 2
    mapping = {
        "left": (margin, cy - obj_size // 2),
        "right": (w - obj_size - margin, cy - obj_size // 2),
        "center": (cx - obj_size // 2, cy - obj_size // 2),
        "top": (cx - obj_size // 2, margin),
        "bottom": (cx - obj_size // 2, h - obj_size - margin),
    }
    return mapping.get(position, (cx - obj_size // 2, cy - obj_size // 2))


def _text_position_xy(position: str, w: int, h: int) -> tuple:
    """Return (x, y) expressions for drawtext filter."""
    mapping = {
        "left": ("20", "(h-text_h)/2"),
        "right": ("w-tw-20", "(h-text_h)/2"),
        "center": ("(w-tw)/2", "(h-text_h)/2"),
        "top": ("(w-tw)/2", "20"),
        "bottom": ("(w-tw)/2", "h-text_h-20"),
    }
    return mapping.get(position, ("(w-tw)/2", "(h-text_h)/2"))


def _shape_alpha_geq(shape: str, size: int) -> str:
    """Return a geq alpha expression that masks a shape within a size×size frame.

    The geq filter rewrites the alpha plane so that pixels outside the shape
    become transparent while the interior keeps its original alpha (255).
    """
    half = size // 2

    if shape == "circle":
        # Circle inscribed in the square: distance from centre ≤ radius.
        return (
            f"geq=lum=lum(X\\,Y):cb=cb(X\\,Y):cr=cr(X\\,Y):"
            f"a=if(lte(pow(X-{half}\\,2)+pow(Y-{half}\\,2)\\,pow({half}\\,2))\\,255\\,0)"
        )

    if shape == "triangle":
        # Isoceles triangle: apex at top-centre, base at bottom.
        # Left edge: Y ≥ size - size*(X / half)  → rearranged.
        # Right edge: Y ≥ size - size*((size-X) / half).
        return (
            f"geq=lum=lum(X\\,Y):cb=cb(X\\,Y):cr=cr(X\\,Y):"
            f"a=if(gte(Y\\,{size}-{size}*min(X\\,{size}-X)/{half})\\,255\\,0)"
        )

    if shape == "diamond":
        # Diamond (rotated square): |X - half| + |Y - half| ≤ half.
        return (
            f"geq=lum=lum(X\\,Y):cb=cb(X\\,Y):cr=cr(X\\,Y):"
            f"a=if(lte(abs(X-{half})+abs(Y-{half})\\,{half})\\,255\\,0)"
        )

    # rectangle — no masking needed, full square is opaque.
    return ""


def _build_filtergraph(
    text: str,
    shape: str,
    color: str,
    position: str,
    w: int,
    h: int,
    duration: float,
) -> str:
    """
    Assemble a complex FFmpeg filtergraph with proper alpha compositing.

    Strategy (drawbox/drawtext do NOT write the alpha plane, so we use
    overlay-based compositing throughout):

      1. Transparent background — solid black + colorchannelmixer zeroes alpha.
      2. Shape source — a solid-colour square, optionally masked to circle /
         triangle / diamond via ``geq``.
      3. Text source — white text on a green (#00FF00) background, then
         ``colorkey`` removes the green → transparent text layer.
      4. Compose: overlay shape → overlay text.
    """
    obj_size = min(w, h) // 4
    sx, sy = _position_xy(position, w, h, obj_size)
    tx, ty = _text_position_xy(position, w, h)
    font_size = max(16, min(w, h) // 15)

    # 1. Transparent canvas
    bg = (
        f"color=c=black:s={w}x{h}:d={duration},"
        f"format=yuva420p,colorchannelmixer=aa=0[bg]"
    )

    # 2. Shape layer
    shape_geq = _shape_alpha_geq(shape, obj_size)
    shape_chain = f"color=c={color}:s={obj_size}x{obj_size}:d={duration},format=yuva420p"
    if shape_geq:
        shape_chain += f",{shape_geq}"
    shape_chain += "[shape]"

    # 3. Text layer (green-screen keyed)
    label = f"{text} ({shape})"
    txt = (
        f"color=c=0x00FF00:s={w}x{h}:d={duration},"
        f"drawtext=text='{label}':"
        f"fontcolor=white:fontsize={font_size}:"
        f"borderw=2:bordercolor=black:"
        f"x={tx}:y={ty},"
        f"format=rgba,"
        f"colorkey=color=0x00FF00:similarity=0.12:blend=0.0,"
        f"format=yuva420p[txt]"
    )

    # 4. Compose: bg + shape → + text
    compose = (
        f"[bg][shape]overlay=x={sx}:y={sy}[v1];"
        f"[v1][txt]overlay=0:0[out]"
    )

    return f"{bg};{shape_chain};{txt};{compose}"


# ──────────────────────────────────────────────────────────────────────────────
# Video generation
# ──────────────────────────────────────────────────────────────────────────────


@dataclass
class GeneratorConfig:
    texts: List[str] = field(default_factory=lambda: list(DEFAULT_TEXTS))
    sizes: List[str] = field(default_factory=lambda: list(DEFAULT_SIZES))
    durations: List[float] = field(default_factory=lambda: list(DEFAULT_DURATIONS))
    shapes: List[str] = field(default_factory=lambda: list(DEFAULT_SHAPES))
    colors: List[str] = field(default_factory=lambda: list(DEFAULT_COLORS))
    positions: List[str] = field(default_factory=lambda: list(DEFAULT_POSITIONS))
    output_dir: Path = OUTPUT_DIR
    max_videos: Optional[int] = None
    dry_run: bool = False
    verbose: bool = False


def _sanitize(s: str) -> str:
    return s.replace(" ", "_").replace("(", "").replace(")", "").lower()


def generate_videos(cfg: GeneratorConfig) -> int:
    """Generate all video combinations. Returns count of videos produced."""
    ffmpeg = _check_ffmpeg()
    cfg.output_dir.mkdir(parents=True, exist_ok=True)

    combos = list(
        itertools.product(
            cfg.texts,
            cfg.sizes,
            cfg.durations,
            cfg.shapes,
            cfg.colors,
            cfg.positions,
        )
    )

    if cfg.max_videos is not None and cfg.max_videos > 0:
        combos = combos[: cfg.max_videos]

    total = len(combos)
    print(f"Generating {total} video(s) into {cfg.output_dir} ...")

    generated = 0
    for idx, (text, size, duration, shape, color, position) in enumerate(combos, 1):
        w, h = (int(d) for d in size.split("x"))
        filtergraph = _build_filtergraph(text, shape, color, position, w, h, duration)

        filename = (
            f"{_sanitize(text)}_{size}_{duration}s"
            f"_{shape}_{color}_{position}.webm"
        )
        outpath = cfg.output_dir / filename

        cmd = [
            ffmpeg,
            "-y",
            "-filter_complex", filtergraph,
            "-map", "[out]",
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            "-auto-alt-ref", "0",
            "-b:v", "1M",
            "-an",
            "-t", str(duration),
            str(outpath),
        ]

        tag = f"[{idx}/{total}]"
        if cfg.dry_run:
            print(f"{tag} (dry-run) {' '.join(cmd)}")
            generated += 1
            continue

        if cfg.verbose:
            print(f"{tag} {filename}")
            print(f"     cmd: {' '.join(cmd)}")
        else:
            print(f"{tag} {filename}", end=" ... ", flush=True)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                print("FAILED")
                print(result.stderr[-500:] if result.stderr else "(no stderr)")
            else:
                if not cfg.verbose:
                    print("OK")
                generated += 1
        except subprocess.TimeoutExpired:
            print("TIMEOUT")
        except Exception as exc:
            print(f"ERROR: {exc}")

    print(f"\nDone. {generated}/{total} video(s) generated.")
    return generated


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────


def _parse_args() -> GeneratorConfig:
    parser = argparse.ArgumentParser(
        description="Generate mock test videos with alpha channels via FFmpeg.",
    )
    parser.add_argument(
        "--texts",
        nargs="+",
        default=None,
        help=f"Text labels (default: {DEFAULT_TEXTS})",
    )
    parser.add_argument(
        "--sizes",
        nargs="+",
        default=None,
        help=f"Video sizes as WxH (default: {DEFAULT_SIZES})",
    )
    parser.add_argument(
        "--durations",
        nargs="+",
        type=float,
        default=None,
        help=f"Durations in seconds (default: {DEFAULT_DURATIONS})",
    )
    parser.add_argument(
        "--shapes",
        nargs="+",
        choices=DEFAULT_SHAPES,
        default=None,
        help=f"Shapes to render (default: {DEFAULT_SHAPES})",
    )
    parser.add_argument(
        "--colors",
        nargs="+",
        default=None,
        help=f"Shape colors (default: {DEFAULT_COLORS})",
    )
    parser.add_argument(
        "--positions",
        nargs="+",
        choices=DEFAULT_POSITIONS,
        default=None,
        help=f"Positions (default: {DEFAULT_POSITIONS})",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=None,
        dest="max_videos",
        help="Maximum number of videos to generate",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help=f"Output directory (default: {OUTPUT_DIR})",
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to JSON config file with generation options",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print FFmpeg commands without executing",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show full FFmpeg commands",
    )

    args = parser.parse_args()
    cfg = GeneratorConfig()

    # Load from JSON config first (CLI flags override).
    if args.config:
        with open(args.config) as f:
            data = json.load(f)
        if "texts" in data:
            cfg.texts = data["texts"]
        if "sizes" in data:
            cfg.sizes = data["sizes"]
        if "durations" in data:
            cfg.durations = [float(d) for d in data["durations"]]
        if "shapes" in data:
            cfg.shapes = data["shapes"]
        if "colors" in data:
            cfg.colors = data["colors"]
        if "positions" in data:
            cfg.positions = data["positions"]
        if "max" in data:
            cfg.max_videos = int(data["max"])

    # CLI overrides
    if args.texts is not None:
        cfg.texts = args.texts
    if args.sizes is not None:
        cfg.sizes = args.sizes
    if args.durations is not None:
        cfg.durations = args.durations
    if args.shapes is not None:
        cfg.shapes = args.shapes
    if args.colors is not None:
        cfg.colors = args.colors
    if args.positions is not None:
        cfg.positions = args.positions
    if args.max_videos is not None:
        cfg.max_videos = args.max_videos
    if args.output is not None:
        cfg.output_dir = Path(args.output)

    cfg.dry_run = args.dry_run
    cfg.verbose = args.verbose

    return cfg


if __name__ == "__main__":
    cfg = _parse_args()
    count = generate_videos(cfg)
    sys.exit(0 if count > 0 else 1)
