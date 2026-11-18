#!/usr/bin/env python3
"""Append missing translation glyphs to the shared atlas: bake_chinese.py NotoSansSC.ttf."""
import argparse
import base64
import hashlib
import json
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('font', type=Path)
    args = parser.parse_args()
    target = ROOT / 'kit/runtime/fonts/cjk.json'
    atlas = json.loads(target.read_text())
    words = json.loads((ROOT / 'kit/runtime/locales/zh-CN.json').read_text())
    text = ''.join(words.values())
    for path in (ROOT / 'apps').glob('*/app.json'):
        spec = json.loads(path.read_text())
        text += spec['title'] + spec.get('description', '')
    for size in atlas['sizes']:
        missing = sorted({c for c in text if '\u3000' <= c <= '\uffef' and not c.isascii()
                          and str(ord(c)) not in size['glyphs']})
        if not missing:
            continue
        font = ImageFont.truetype(str(args.font), size['size'])
        font.set_variation_by_name('Medium')
        width, old_height = size['atlasW'], size['atlasH']
        cell = size['ascent'] + size['descent'] + 2
        image = Image.new('L', (width, old_height + cell * len(missing)), 0)
        image.paste(Image.frombytes('L', (width, old_height), zlib.decompress(base64.b64decode(size['alpha']))), (0, 0))
        draw = ImageDraw.Draw(image)
        x, y = 0, old_height
        for char in missing:
            left, top, right, bottom = font.getbbox(char, anchor='ls')
            w, h = right - left, bottom - top
            if x + w + 2 > width:
                x, y = 0, y + cell
            draw.text((x - left, y - top), char, font=font, fill=255, anchor='ls')
            size['glyphs'][str(ord(char))] = [x, y, w, h, left, top, round(font.getlength(char))]
            x += w + 2
        size['atlasH'] = y + cell
        raw = image.crop((0, 0, width, size['atlasH'])).tobytes()
        size['alpha'] = base64.b64encode(zlib.compress(raw, 9)).decode()
    atlas['cacheKey'] = hashlib.sha256(json.dumps(atlas['sizes'], sort_keys=True).encode()).hexdigest()[:16]
    target.write_text(json.dumps(atlas, ensure_ascii=False, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    main()
