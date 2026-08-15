#!/usr/bin/env python3
"""Build OKMD.icns from OKMD_logo.svg.

Follows the macOS (Big Sur and later) icon grid: the artwork sits in an
824x824 squircle centred on a 1024x1024 canvas, with a soft shadow beneath.

    python3 make-icon.py        # writes OKMD.icns

Needs rsvg-convert (brew install librsvg) and Pillow.
"""

import math
import os
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(ROOT, 'OKMD_logo.svg')
ICNS = os.path.join(ROOT, 'OKMD.icns')

CANVAS = 1024      # full icon canvas
TILE = 824         # artwork square, per Apple's icon grid
SS = 4             # supersampling factor for a clean squircle edge
SQUIRCLE_N = 5.0   # superellipse exponent; ~5 matches Apple's continuous corners


def squircle_mask(size):
    """An anti-aliased superellipse mask — macOS's rounded-square shape."""
    big = size * SS
    mask = Image.new('L', (big, big), 0)
    draw = ImageDraw.Draw(mask)
    r = big / 2.0
    points = []
    steps = 2048
    for i in range(steps):
        t = 2.0 * math.pi * i / steps
        c, s = math.cos(t), math.sin(t)
        # superellipse, parametric form
        x = math.copysign(r * abs(c) ** (2.0 / SQUIRCLE_N), c)
        y = math.copysign(r * abs(s) ** (2.0 / SQUIRCLE_N), s)
        points.append((r + x, r + y))
    draw.polygon(points, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def render_tile():
    """Rasterise the logo (background included) at the artwork size."""
    tmp = tempfile.mktemp(suffix='.png')
    subprocess.run(
        ['rsvg-convert', '-w', str(TILE * SS), '-h', str(TILE * SS), SVG, '-o', tmp],
        check=True,
    )
    tile = Image.open(tmp).convert('RGBA').resize((TILE, TILE), Image.LANCZOS)
    os.unlink(tmp)
    return tile


def build_icon():
    mask = squircle_mask(TILE)
    tile = render_tile()
    tile.putalpha(mask)

    icon = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    inset = (CANVAS - TILE) // 2

    # soft shadow beneath the tile
    shadow = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 90), (inset, inset + 10), mask)
    icon.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(11)))

    icon.alpha_composite(tile, (inset, inset))
    return icon


def main():
    icon = build_icon()
    iconset = tempfile.mkdtemp(suffix='.iconset')
    for base in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            px = base * scale
            name = f'icon_{base}x{base}{"@2x" if scale == 2 else ""}.png'
            icon.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, name))
    subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', ICNS], check=True)
    shutil.rmtree(iconset)
    print(f'Wrote {ICNS}')


if __name__ == '__main__':
    main()
