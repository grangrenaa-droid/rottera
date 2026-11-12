"""Builds the app icon files from one source picture.

usage: python scripts/make-icon.py <source image> [<out dir>]
       python scripts/make-icon.py <source image> --tile x0,y0,x1,y1,radius [<out dir>]

Without --tile, the picture goes on a white rounded square (like other app icons) so the white band of the clapper
keeps its shape on dark and light backgrounds alike.
With --tile, the picture already is the icon (a rounded tile on a backdrop): the tile is cut out at that box and
corner radius, in the picture's own pixels, and what is outside it becomes transparent.
Writes icon.png (1024, transparent corners) and icon.ico (16, 24, 32, 48, 64, 128, 256).
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

args = sys.argv[1:]
tile_box = None
if '--tile' in args:
    i = args.index('--tile')
    tile_box = [int(v) for v in args[i + 1].split(',')]
    del args[i : i + 2]
src = Path(args[0])
out = Path(args[1]) if len(args) > 1 else Path(__file__).resolve().parent.parent / 'build'
out.mkdir(parents=True, exist_ok=True)

SIZE = 1024
RADIUS = int(SIZE * 0.22)
ART = 0.80  # share of the tile the picture covers


def rounded_mask(w: int, h: int, radius: float, size: tuple[int, int]) -> Image.Image:
    """A rounded rectangle of w x h, drawn 4x larger and scaled to `size` for smooth corners."""
    big = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), radius=int(radius * 4), fill=255)
    return big.resize(size, Image.LANCZOS)


if tile_box:
    x0, y0, x1, y1, r = tile_box
    art = Image.open(src).convert('RGB').crop((x0, y0, x1 + 1, y1 + 1))
    w, h = art.size
    # a little room around the tile, so it does not touch the edges of the icon
    side = round(max(w, h) * 1.04)
    scale = SIZE / side
    tw, th = round(w * scale), round(h * scale)
    piece = art.resize((tw, th), Image.LANCZOS).convert('RGBA')
    piece.putalpha(rounded_mask(w, h, r, (tw, th)))
    tile = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    tile.paste(piece, ((SIZE - tw) // 2, (SIZE - th) // 2), piece)
else:
    art = Image.open(src).convert('RGB')
    side = min(art.size)
    art = art.crop(((art.width - side) // 2, (art.height - side) // 2, (art.width + side) // 2, (art.height + side) // 2))
    art = art.resize((int(SIZE * ART), int(SIZE * ART)), Image.LANCZOS)
    mask = rounded_mask(SIZE, SIZE, RADIUS, (SIZE, SIZE))

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
