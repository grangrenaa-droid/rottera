"""Builds the Microsoft Store (MSIX) images from the app icon.

usage: python scripts/make-appx-assets.py [<icon.png>] [<out dir>]
Defaults: build/icon.png -> build/appx (the folder electron-builder reads for the Store package).

Each image comes in the scales Windows asks for (100%, 200%, 400%). The small app icon (Square44x44Logo) also comes
in exact pixel sizes for the taskbar, Start and Explorer, plain and "unplated" (drawn without a tile behind it).
The icon is already a rounded tile with transparent corners, so every image keeps a transparent background.
"""
import sys
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'build' / 'icon.png'
out = Path(sys.argv[2]) if len(sys.argv) > 2 else root / 'build' / 'appx'
out.mkdir(parents=True, exist_ok=True)
for old in out.glob('*.png'):
    old.unlink()

icon = Image.open(src).convert('RGBA')


def canvas(w: int, h: int, share: float) -> Image.Image:
    """The icon centered on a transparent w x h image, its side `share` of the shorter edge."""
    side = max(1, round(min(w, h) * share))
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    img.paste(icon.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
    return img


# name: (width, height at 100%, share of the image the icon takes)
TILES = {
    'StoreLogo': (50, 50, 1.0),
    'Square150x150Logo': (150, 150, 0.66),
    'Wide310x150Logo': (310, 150, 0.66),
    'SmallTile': (71, 71, 0.70),
    'LargeTile': (310, 310, 0.60),
    'Square44x44Logo': (44, 44, 1.0),
}
for name, (w, h, share) in TILES.items():
    for scale in (100, 200, 400):
        canvas(round(w * scale / 100), round(h * scale / 100), share).save(out / f'{name}.scale-{scale}.png')

for size in (16, 24, 32, 48, 256):
    img = canvas(size, size, 1.0)
    img.save(out / f'Square44x44Logo.targetsize-{size}.png')
    img.save(out / f'Square44x44Logo.targetsize-{size}_altform-unplated.png')

print('wrote', len(list(out.glob('*.png'))), 'images to', out)
