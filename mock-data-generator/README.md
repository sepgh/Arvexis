# Mock Data Generator

Generates test videos with **alpha channels** using system FFmpeg. The output
is a batch of `.webm` (VP9) clips with transparent backgrounds — useful for
testing the Arvexis **editor** timeline, compositing pipeline, and the
**runtime** engine.

## Purpose

The editor and engine need a diverse set of short video clips to exercise:

- **Timeline import & arrangement** — clips of varying lengths.
- **Alpha-channel compositing** — every clip has a transparent background so
  overlay / blending behaviour can be verified.
- **Resolution handling** — multiple sizes (SD → Full HD).
- **Visual differentiation** — each clip has a unique combination of text,
  shape, colour, and position so you can visually confirm correct playback
  order and layering.

## Requirements

| Dependency | Version  | Notes                               |
|------------|----------|-------------------------------------|
| Python     | ≥ 3.8    |                                     |
| FFmpeg     | ≥ 4.x    | Must include `libvpx` (VP9) support |

## Quick Start

```bash
# Generate a small test set (20 videos)
python generate.py --max 20

# Preview commands without generating anything
python generate.py --dry-run

# Full combinatorial set (may produce thousands of files)
python generate.py
```

## Options

| Flag            | Description                                      | Default                                         |
|-----------------|--------------------------------------------------|-------------------------------------------------|
| `--texts`       | Space-separated text labels                      | `Hello Test Arvexis Sample Demo`                |
| `--sizes`       | Video dimensions (`WxH`)                         | `640x480 1280x720 1920x1080`                   |
| `--durations`   | Clip lengths in seconds                          | `1.0 3.0 5.0 10.0`                             |
| `--shapes`      | Shape drawn on clip                              | `circle rectangle triangle diamond`             |
| `--colors`      | Shape / overlay colour                           | `red green blue yellow cyan magenta white`      |
| `--positions`   | Where the shape is placed                        | `left right center top bottom`                  |
| `--max N`       | Cap the total number of videos                   | *(all combinations)*                            |
| `--output DIR`  | Output directory                                 | `./generated/`                                  |
| `--config FILE` | Load options from a JSON file                    | —                                               |
| `--dry-run`     | Print FFmpeg commands without executing           | —                                               |
| `-v, --verbose` | Show full FFmpeg command lines during generation  | —                                               |

## JSON Config Example

You can also drive the generator via a config file:

```json
{
  "texts": ["Clip A", "Clip B"],
  "sizes": ["640x480"],
  "durations": [2.0, 5.0],
  "shapes": ["circle", "rectangle"],
  "colors": ["red", "blue"],
  "positions": ["center", "top"],
  "max": 50
}
```

```bash
python generate.py --config my-config.json
```

## Output

Videos are written to the `generated/` subdirectory (git-ignored).
Filenames encode every parameter for easy identification:

```
hello_640x480_3.0s_circle_red_center.webm
```

Each video has:
- A **transparent background** (YUVA420P pixel format, VP9 codec).
- A **coloured shape** at the specified position.
- A **text label** with the text content and shape name.
