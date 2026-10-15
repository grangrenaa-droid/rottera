"""Builds the app icon files from one source picture.

usage: python scripts/make-icon.py <source image> [<out dir>]

The picture goes on a white rounded square (like other app icons) so the white band of the clapper keeps
its shape on dark and light backgrounds alike. Writes icon.png (1024, transparent corners) and icon.ico
(16, 24, 32, 48, 64, 128, 256).
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

src = Path(sys.argv[1])
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / 'build'
out.mkdir(parents=True, exist_ok=True)

SIZE = 1024
RADIUS = int(SIZE * 0.22)
ART = 0.80  # share of the tile the picture covers

art = Image.open(src).convert('RGB')
side = min(art.size)
art = art.crop(((art.width - side) // 2, (art.height - side) // 2, (art.width + side) // 2, (art.height + side) // 2))
art = art.resize((int(SIZE * ART), int(SIZE * ART)), Image.LANCZOS)

# 4x supersampled mask for smooth corners
big = Image.new('L', (SIZE * 4, SIZE * 4), 0)
ImageDraw.Draw(big).rounded_rectangle((0, 0, SIZE * 4 - 1, SIZE * 4 - 1), radius=RADIUS * 4, fill=255)
mask = big.resize((SIZE, SIZE), Image.LANCZOS)

tile = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 255))
off = (SIZE - art.width) // 2
tile.paste(art, (off, off))
# a thin edge so the white tile reads on a white taskbar
edge = Image.new('L', (SIZE * 4, SIZE * 4), 0)
d = ImageDraw.Draw(edge)
d.rounded_rectangle((0, 0, SIZE * 4 - 1, SIZE * 4 - 1), radius=RADIUS * 4, outline=255, width=14)
edge = edge.resize((SIZE, SIZE), Image.LANCZOS)
line = Image.new('RGBA', (SIZE, SIZE), (200, 204, 210, 255))
tile = Image.composite(line, tile, edge)
tile.putalpha(mask)

tile.save(out / 'icon.png')
tile.save(out / 'icon.ico', sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
print('wrote', out / 'icon.png', out / 'icon.ico')
