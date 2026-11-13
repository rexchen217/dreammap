# 把 art 目录中的图片统一裁成 4:3、缩放到 1600x1200，输出高质量 JPG
# 用法: python tools/normalize_art.py <slug> [slug...] [--size 1600]
import sys, os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'site', 'art')

args = [a for a in sys.argv[1:] if not a.startswith('--')]
size = 1600
if '--size' in sys.argv:
    size = int(sys.argv[sys.argv.index('--size') + 1])
height = round(size * 3 / 4)

for slug in args:
    d = os.path.join(ART, slug)
    if not os.path.isdir(d):
        print(slug, 'missing dir')
        continue
    ok = 0
    for name in sorted(os.listdir(d)):
        if not name.lower().endswith('.jpg'):
            continue
        p = os.path.join(d, name)
        try:
            im = Image.open(p)
            im = ImageOps.exif_transpose(im).convert('RGB')
            w, h = im.size
            target = 4 / 3
            if w / h > target:
                nw = int(h * target)
                im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
            else:
                nh = int(w / target)
                im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
            im = im.resize((size, height), Image.LANCZOS)
            im.save(p, 'JPEG', quality=86, optimize=True, progressive=True)
            ok += 1
        except Exception as e:
            print('  fail', name, e)
    print(f'{slug}: normalized {ok}')
