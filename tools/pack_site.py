# -*- coding: utf-8 -*-
"""
打包用站点构建：site/ → build/pack-site/
--------------------------------------------------
站内 art/ 下 200 张原始照片是 2240×1680（单张约 830KB，合计 166MB）。
装机包只需要在手机/桌面窗口里看清卡片，把长边压到 1600、质量 82，
体积砍掉约六成，肉眼在卡片尺寸下看不出差别。

site/ 本身保持原样（网页版与自建服务仍用全尺寸图）。
用法： python tools/pack_site.py [宽上限] [质量]
"""
import os
import sys
import shutil
import time
from PIL import Image

ROOT = r"C:\Users\rex\DreamMap"
SRC = os.path.join(ROOT, "site")
DST = os.path.join(ROOT, "build", "pack-site")

MAXW = int(sys.argv[1]) if len(sys.argv) > 1 else 1600
QUALITY = int(sys.argv[2]) if len(sys.argv) > 2 else 82


def human(n):
    return "%.1f MB" % (n / 1048576.0)


def main():
    if os.path.isdir(DST):
        shutil.rmtree(DST)
    os.makedirs(DST, exist_ok=True)

    total_in = total_out = 0
    pics = 0
    t0 = time.time()

    for dirpath, dirnames, filenames in os.walk(SRC):
        rel = os.path.relpath(dirpath, SRC)
        outdir = DST if rel == "." else os.path.join(DST, rel)
        os.makedirs(outdir, exist_ok=True)

        for name in filenames:
            src = os.path.join(dirpath, name)
            dst = os.path.join(outdir, name)
            total_in += os.path.getsize(src)

            if name.lower().endswith((".jpg", ".jpeg")):
                im = Image.open(src).convert("RGB")
                if im.width > MAXW:
                    h = round(im.height * MAXW / im.width)
                    im = im.resize((MAXW, h), Image.LANCZOS)
                im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
                pics += 1
            else:
                shutil.copy2(src, dst)

            total_out += os.path.getsize(dst)

    print("照片 %d 张 → 长边 %dpx / 质量 %d，用时 %.1fs" % (pics, MAXW, QUALITY, time.time() - t0))
    print("站点总体积：%s → %s" % (human(total_in), human(total_out)))
    print("输出目录：%s" % DST)


if __name__ == "__main__":
    main()
