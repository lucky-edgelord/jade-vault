#!/usr/bin/env python3
"""Pack Jade's PNGtuber art (5 expressions x 4 frames of 1307x1991 PNG) into what the app embeds:

    body.webp    one full picture (Neutral1), 960 px tall
    faces.webp   an atlas of the 20 face patches (row = expression, column = frame)
    faces.json   where a patch goes on the body, and the atlas layout

Only the face changes between the 20 frames (eyes and mouth), so the app ships one body and 20 small faces
(about 150 kB instead of 1.3 MB). Frames: 1 eyes open / mouth shut, 2 open / open, 3 shut / shut, 4 shut / open.

    python3 app/tools/make_pngtuber.py <folder with Neutral/ Happy/ Sad/ Mad/ Shy/ subfolders, any depth>
"""
import glob, json, os, sys
from PIL import Image, ImageChops, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'avatar', 'pngtuber')
EMOTIONS = ['neutral', 'happy', 'sad', 'mad', 'shy']
H = 960


def frames(root, e):
    fs = sorted(glob.glob(os.path.join(root, '**', e.capitalize(), e.capitalize() + '[1-4].png'), recursive=True))
    if len(fs) != 4: sys.exit(f'{e}: expected 4 frames, found {len(fs)}')
    return [Image.open(f).convert('RGBA') for f in fs]


def main():
    root = sys.argv[1]
    allf = {e: frames(root, e) for e in EMOTIONS}
    base = allf['neutral'][0]
    box = None                      # the union of everything that differs from the base, ignoring compression noise
    for e in EMOTIONS:
        for im in allf[e]:
            d = ImageChops.difference(base, im).convert('L').point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(9)).getbbox()
            if d: box = d if not box else (min(box[0], d[0]), min(box[1], d[1]), max(box[2], d[2]), max(box[3], d[3]))
    s = H / base.height
    W = round(base.width * s)
    bx = [int(box[0] * s) - 10, int(box[1] * s) - 10, int(box[2] * s) + 11, int(box[3] * s) + 11]
    cw, ch = bx[2] - bx[0], bx[3] - bx[1]
    os.makedirs(OUT, exist_ok=True)
    base.resize((W, H), Image.LANCZOS).save(os.path.join(OUT, 'body.webp'), 'WEBP', quality=82, method=6)
    atlas = Image.new('RGBA', (cw * 4, ch * len(EMOTIONS)))
    for r, e in enumerate(EMOTIONS):
        for c, im in enumerate(allf[e]):
            atlas.paste(im.resize((W, H), Image.LANCZOS).crop(bx), (c * cw, r * ch))
    atlas.save(os.path.join(OUT, 'faces.webp'), 'WEBP', quality=88, method=6)
    meta = {'width': W, 'height': H, 'face': bx[:2], 'cell': [cw, ch], 'emotions': EMOTIONS, 'frames': 4}
    json.dump(meta, open(os.path.join(OUT, 'faces.json'), 'w'))
    for f in ('body.webp', 'faces.webp'): print(f, os.path.getsize(os.path.join(OUT, f)))
    print(meta)


if __name__ == '__main__':
    main()
