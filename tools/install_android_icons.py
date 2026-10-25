# -*- coding: utf-8 -*-
"""
把生成好的图标与启动图装进安卓工程
--------------------------------------------------
1) assets/android-icons/  → android/app/src/main/res/mipmap-<density>/
2) 自适应图标的背景色改为站点主题深蓝，并补上 Android 13+ 单色图层
3) 生成各密度的启动图 drawable*/splash.png（深蓝底 + 像素图钉 + 像素字体标题）
用法： python tools/install_android_icons.py
"""
import os
import shutil
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = r"C:\Users\rex\DreamMap"
ICONS = os.path.join(ROOT, "assets", "android-icons")
RES = os.path.join(ROOT, "android-app", "android", "app", "src", "main", "res")
ZPIX = os.path.join(ROOT, "site", "fonts", "Zpix.ttf")

sys_path = os.path.join(ROOT, "tools")
import sys
sys.path.insert(0, sys_path)
from make_icon import map_layers, vert_grad, id_grad  # noqa: E402

BG_SPLASH_A = (18, 23, 43)
BG_SPLASH_B = (43, 51, 88)
LAUNCHER_BG = "#303a60"
TEXT_COLOR = (255, 240, 214)
SUB_COLOR = (150, 168, 202)

DENSITIES = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]
SPLASHES = [
    (os.path.join(RES, "drawable"), (480, 320)),
    (os.path.join(RES, "drawable-land-mdpi"), (480, 320)),
    (os.path.join(RES, "drawable-land-hdpi"), (800, 480)),
    (os.path.join(RES, "drawable-land-xhdpi"), (1280, 720)),
    (os.path.join(RES, "drawable-land-xxhdpi"), (1600, 960)),
    (os.path.join(RES, "drawable-land-xxxhdpi"), (1920, 1280)),
    (os.path.join(RES, "drawable-port-mdpi"), (320, 480)),
    (os.path.join(RES, "drawable-port-hdpi"), (480, 800)),
    (os.path.join(RES, "drawable-port-xhdpi"), (720, 1280)),
    (os.path.join(RES, "drawable-port-xxhdpi"), (960, 1600)),
    (os.path.join(RES, "drawable-port-xxxhdpi"), (1280, 1920)),
]


def install_icons():
    for d in DENSITIES:
        src_dir = os.path.join(ICONS, "mipmap-" + d)
        dst_dir = os.path.join(RES, "mipmap-" + d)
        os.makedirs(dst_dir, exist_ok=True)
        for name in ("ic_launcher.png", "ic_launcher_round.png",
                     "ic_launcher_foreground.png", "ic_launcher_monochrome.png"):
            shutil.copy2(os.path.join(src_dir, name), os.path.join(dst_dir, name))
    print("图标已装进 mipmap-%s" % " / ".join(DENSITIES))

    with open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">%s</color>\n</resources>\n' % LAUNCHER_BG)

    adaptive = ('<?xml version="1.0" encoding="utf-8"?>\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@color/ic_launcher_background"/>\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
                '</adaptive-icon>\n')
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(RES, "mipmap-anydpi-v26", name), "w", encoding="utf-8") as f:
            f.write(adaptive)
    print("自适应图标背景色与单色图层已更新")


def splash(w, h):
    """启动图：深蓝渐变 + 中心光晕 + 像素图钉 + 像素字体标题"""
    img = vert_grad(max(w, h), BG_SPLASH_A, BG_SPLASH_B).resize((w, h), Image.LANCZOS).convert("RGB")
    img = img.convert("RGBA")

    short = min(w, h)
    # 中心光晕
    glow_side = 256
    glow = ImageOps.invert(Image.radial_gradient("L").resize((glow_side, glow_side), Image.LANCZOS))
    glow = glow.point(lambda a: int(a * 0.30))
    glow = glow.resize((int(short * 1.5), int(short * 1.5)), Image.LANCZOS)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    halo = Image.new("RGB", glow.size, (255, 176, 118))
    layer.paste(halo, (int((w - glow.size[0]) / 2), int(h * 0.40 - glow.size[1] / 2)), glow)
    img.alpha_composite(layer)

    # 像素字体（Zpix 以 12px 为基准，取 12 的倍数最清晰）
    px = max(12, int(round(short * 0.070 / 12)) * 12)
    title = ImageFont.truetype(ZPIX, px)
    sub = ImageFont.truetype(ZPIX, max(12, int(round(px * 0.42 / 12)) * 12))

    pin_h = int(short * 0.44)
    pin, _ = map_layers(pin_h, 0.92, False)

    d = ImageDraw.Draw(img)
    t_bbox = d.textbbox((0, 0), "梦想地图", font=title)
    s_bbox = d.textbbox((0, 0), "DREAM MAP", font=sub)
    t_h, s_h = t_bbox[3] - t_bbox[1], s_bbox[3] - s_bbox[1]
    gap, gap2 = int(short * 0.045), int(short * 0.030)

    total = pin_h + gap + t_h + gap2 + s_h
    top = int(h / 2 - total / 2)

    img.alpha_composite(pin, (int((w - pin_h) / 2), top))
    y = top + pin_h + gap
    d.text(((w - (t_bbox[2] - t_bbox[0])) / 2 - t_bbox[0], y - t_bbox[1]), "梦想地图",
           font=title, fill=TEXT_COLOR)
    y += t_h + gap2
    d.text(((w - (s_bbox[2] - s_bbox[0])) / 2 - s_bbox[0], y - s_bbox[1]), "DREAM MAP",
           font=sub, fill=SUB_COLOR)
    return img.convert("RGB")


def install_splashes():
    for path, (w, h) in SPLASHES:
        os.makedirs(path, exist_ok=True)
        splash(w, h).save(os.path.join(path, "splash.png"), "PNG", optimize=True)
    print("启动图已生成（%d 张，含横竖屏各密度）" % len(SPLASHES))


if __name__ == "__main__":
    install_icons()
    install_splashes()
