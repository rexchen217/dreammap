# -*- coding: utf-8 -*-
"""
梦想地图 · 应用图标生成器（像素折叠地图 + 金色图钉）
--------------------------------------------------
一次生成：
  assets/                     桌面端与存档用图标（master 512 / 256 / 48 / 预览图）
  desktop/                    托盘与窗口图标（tray-16 / tray-32 / window-icon）
  assets/android-icons/       安卓各密度启动图标（自适应 + 旧版方形 + 圆形 + 单色）

风格：全部按「逻辑像素网格」绘制再整数倍放大（NEAREST），
      得到和站内像素小人一致的硬边像素观感，无抗锯齿模糊。
"""
import os
from PIL import Image, ImageDraw, ImageChops, ImageFilter, ImageFont

ROOT = r"C:\Users\rex\DreamMap"
ASSETS = os.path.join(ROOT, "assets")
DESKTOP = os.path.join(ROOT, "desktop")
ANDROID_ICONS = os.path.join(ASSETS, "android-icons")

OUTLINE = (29, 26, 36)      # 与站内像素小人统一描边色 #1d1a24
PAPER_A = (249, 242, 229)   # 纸面（正折面）
PAPER_B = (225, 212, 190)   # 纸面（背折面，暗一档）
CREASE = (186, 168, 140)    # 折痕
ROUTE = (206, 126, 46)      # 路线点
PLACE = (84, 148, 114)      # 地物（小山）
PIN_A = (255, 216, 132)     # 图钉亮端（鎏金）
PIN_B = (223, 143, 32)      # 图钉暗端（琥珀）
PIN_HL = (255, 248, 220)    # 图钉高光
BG_A = (48, 58, 96)         # 背景亮端 #303a60
BG_B = (16, 21, 42)         # 背景暗端 #10152a
SPARK = (255, 213, 122)     # 星点

# ── 折叠地图：四面手风琴式折纸，上下边交替错开 ──
MX0, MX1, MX2, MX3, MX4 = 0.055, 0.278, 0.500, 0.722, 0.945
MT_A, MT_B = 0.470, 0.430      # 四个面的顶边（隔面下沉 / 抬起）
MB_A, MB_B = 0.870, 0.830      # 四个面的底边（与顶边同步错开）

# ── 金色图钉：头部浮在纸上方，针尖扎进折缝 ──
PCX, PTIP = 0.500, 0.650
PHY = 0.315                    # 头部中心
PHR = 0.112                    # 头部半径
PTW = 0.048                    # 针身半宽
P_INR = 0.076                  # 内芯半径
P_ITW = 0.026                  # 内芯针身半宽
P_ITIP = 0.606                 # 内芯尖端

CY = 0.5375                    # 自然框垂直中心（让地图+图钉居中）
CONTENT = 0.95

DENSITIES = [("mdpi", 1.0), ("hdpi", 1.5), ("xhdpi", 2.0), ("xxhdpi", 3.0), ("xxxhdpi", 4.0)]
LEGACY_BASE = 48            # 旧版方形图标基准
FG_BASE = 108               # 自适应图标前景基准


# ───────────────────────── 基础工具 ─────────────────────────

def id_grad(size, c0, c1):
    """左上→右下线性渐变"""
    out = Image.new("RGB", (size, size))
    px = out.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2.0 * (size - 1)) if size > 1 else 0
            px[x, y] = (round(c0[0] + (c1[0] - c0[0]) * t),
                        round(c0[1] + (c1[1] - c0[1]) * t),
                        round(c0[2] + (c1[2] - c0[2]) * t))
    return out


def vert_grad(size, c0, c1):
    """上→下线性渐变"""
    out = Image.new("RGB", (size, size))
    px = out.load()
    for y in range(size):
        t = y / (size - 1.0) if size > 1 else 0
        row = (round(c0[0] + (c1[0] - c0[0]) * t),
               round(c0[1] + (c1[1] - c0[1]) * t),
               round(c0[2] + (c1[2] - c0[2]) * t))
        for x in range(size):
            px[x, y] = row
    return out


def sprite_size(target):
    """按目标边长挑像素块大小，使逻辑网格稳定在 28~32 格"""
    block = max(1, int(round(target / 30.0)))
    return block, max(10, int(round(target / block)))


def transform(g, content):
    """自然坐标 → 逻辑网格"""
    def X(v):
        return int(round(g * (0.5 + (v - 0.5) * content)))

    def Y(v):
        return int(round(g * (0.5 + (v - CY) * content)))
    return X, Y


def map_points(X, Y):
    """手风琴折纸轮廓：四面交替高低，形成 Z 字折边"""
    return [(X(MX0), Y(MT_A)), (X(MX1), Y(MT_A)), (X(MX1), Y(MT_B)), (X(MX2), Y(MT_B)),
            (X(MX2), Y(MT_A)), (X(MX3), Y(MT_A)), (X(MX3), Y(MT_B)), (X(MX4), Y(MT_B)),
            (X(MX4), Y(MB_B)), (X(MX3), Y(MB_B)), (X(MX3), Y(MB_A)), (X(MX2), Y(MB_A)),
            (X(MX2), Y(MB_B)), (X(MX1), Y(MB_B)), (X(MX1), Y(MB_A)), (X(MX0), Y(MB_A))]


def mask_of(g, pts):
    m = Image.new("L", (g, g), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def erode(m, k):
    """按逻辑像素腐蚀，k 为描边宽度"""
    return m.filter(ImageFilter.MinFilter(2 * k + 1)) if k > 0 else m


# ───────────────────────── 折叠地图 + 图钉精灵 ─────────────────────────

def map_layers(target, content=CONTENT, detail=True):
    """在 target×target 透明画布上画「折叠地图 + 金色图钉」，返回 (成品图, 实心剪影)"""
    block, g = sprite_size(target)
    X, Y = transform(g, content)
    px = max(1, int(round(g / 30.0)))

    pts = map_points(X, Y)
    body = mask_of(g, pts)
    inner = erode(body, px)

    img = Image.new("RGBA", (g, g), (0, 0, 0, 0))
    img.paste(Image.new("RGB", (g, g), OUTLINE), (0, 0), body)     # 描边
    img.paste(Image.new("RGB", (g, g), PAPER_A), (0, 0), inner)    # 纸面

    # 第 2、4 面压暗，让折纸的明暗交替一眼看出来
    dk = Image.new("L", (g, g), 0)
    dd = ImageDraw.Draw(dk)
    dd.polygon([(X(MX1), Y(MT_B)), (X(MX2), Y(MT_B)), (X(MX2), Y(MB_B)), (X(MX1), Y(MB_B))], fill=255)
    dd.polygon([(X(MX3), Y(MT_B)), (X(MX4), Y(MT_B)), (X(MX4), Y(MB_B)), (X(MX3), Y(MB_B))], fill=255)
    img.paste(Image.new("RGB", (g, g), PAPER_B), (0, 0), ImageChops.multiply(dk, inner))
    crease = Image.new("RGB", (g, g), CREASE)
    for fx in (MX1, MX2, MX3):
        cm = Image.new("L", (g, g), 0)
        ImageDraw.Draw(cm).rectangle([X(fx) - (px - 1), Y(MT_B), X(fx) + (px - 1), Y(MB_B)], fill=255)
        img.paste(crease, (0, 0), ImageChops.multiply(cm, inner))

    # 纸面上的内容：一串通往图钉的路线点 + 两座小山
    if detail:
        rd = ImageDraw.Draw(img)
        step = max(1, int(round(g / 26.0)))
        for i in range(8):
            t = i / 7.0
            rx = 0.135 + (0.360 - 0.135) * t
            ry = 0.775 - (0.775 - 0.690) * t
            x, y = X(rx), Y(ry)
            rd.rectangle([x, y, x + step - 1, y + step - 1], fill=ROUTE)
        mt = max(1, int(round(g / 16.0)))
        for mx, my in ((0.812, 0.735), (0.642, 0.792)):
            x, y = X(mx), Y(my)
            rd.polygon([(x - mt, y + mt - 1), (x, y - mt + 1), (x + mt, y + mt - 1)], fill=PLACE)

    # 图钉：描边 → 三层纸色内芯
    ppts = pin_shapes(g, X, Y)
    img.paste(Image.new("RGB", (g, g), OUTLINE), (0, 0), ppts[0])
    img.paste(Image.new("RGB", (g, g), PIN_A), (0, 0), ppts[1])
    right = ImageChops.multiply(ppts[1], _half(g, X(PCX), 1))
    img.paste(Image.new("RGB", (g, g), PIN_B), (0, 0), right)
    hl = ImageChops.multiply(ppts[1], _box(g, X(PCX - P_INR * 0.74), Y(PHY - P_INR * 0.72),
                                           X(PCX - P_INR * 0.06), Y(PHY + P_INR * 0.30)))
    img.paste(Image.new("RGB", (g, g), PIN_HL), (0, 0), hl)

    out = img.resize((target, target), Image.NEAREST)

    # 单色主题用的实心剪影：地图 + 图钉的合并外形
    solid = ImageChops.lighter(body, ppts[0]).resize((target, target), Image.NEAREST)
    sil = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    sil.paste(Image.new("RGB", (target, target), (0, 0, 0)), (0, 0), solid)
    return out, sil


def pin_shapes(g, X, Y):
    """返回 (外轮廓遮罩, 内芯遮罩)"""
    outer = Image.new("L", (g, g), 0)
    inner = Image.new("L", (g, g), 0)
    do, di = ImageDraw.Draw(outer), ImageDraw.Draw(inner)
    do.ellipse([X(PCX - PHR), Y(PHY - PHR), X(PCX + PHR), Y(PHY + PHR)], fill=255)
    do.polygon([(X(PCX - PTW), Y(PHY)), (X(PCX + PTW), Y(PHY)), (X(PCX), Y(PTIP))], fill=255)
    di.ellipse([X(PCX - P_INR), Y(PHY - P_INR), X(PCX + P_INR), Y(PHY + P_INR)], fill=255)
    di.polygon([(X(PCX - P_ITW), Y(PHY)), (X(PCX + P_ITW), Y(PHY)), (X(PCX), Y(P_ITIP))], fill=255)
    return outer, inner


def _half(g, xs, side):
    m = Image.new("L", (g, g), 0)
    d = ImageDraw.Draw(m)
    if side > 0:
        d.rectangle([xs, 0, g - 1, g - 1], fill=255)
    else:
        d.rectangle([0, 0, xs, g - 1], fill=255)
    return m


def _box(g, x0, y0, x1, y1):
    m = Image.new("L", (g, g), 0)
    ImageDraw.Draw(m).rectangle([x0, y0, x1, y1], fill=255)
    return m


def sparkles(target, count=2):
    """在图钉周围点几粒星尘，增加「梦想」的意味"""
    block, _ = sprite_size(target)
    if block < 2:            # 太小时星尘会变成脏点，干脆不画
        return Image.new("RGBA", (target, target), (0, 0, 0, 0))
    img = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    spots = [(0.845, 0.180, block), (0.128, 0.315, block)]
    for sx, sy, s in spots[:count]:
        x, y = round(sx * target), round(sy * target)
        d.rectangle([x, y, x + s - 1, y + s - 1], fill=SPARK + (255,))
    return img


def legacy_icon(size, content=CONTENT, round_shape=False):
    """旧版系统用的成品图标：深色圆角底 + 折叠地图 + 金图钉 + 星尘"""
    _, g = sprite_size(size)
    shp = Image.new("L", (g, g), 0)
    d = ImageDraw.Draw(shp)
    if round_shape:
        d.ellipse([0, 0, g - 1, g - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, g - 1, g - 1], radius=max(1, int(round(0.22 * g))), fill=255)
    shp = shp.resize((size, size), Image.NEAREST)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(id_grad(size, BG_A, BG_B), (0, 0), shp)
    icon, _ = map_layers(size, content, size >= 64)
    out.alpha_composite(icon)
    out.alpha_composite(sparkles(size))
    return out


def foreground_layer(size, content=0.62):
    """自适应图标前景：内容收敛在安全区内"""
    icon, _ = map_layers(size, content, False)
    return icon


def mono_layer(size, content=0.62):
    """单色主题图层：实心剪影，交给系统上色"""
    _, sil = map_layers(size, content, False)
    return sil


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    return path


# ───────────────────────── 输出 ─────────────────────────

def main():
    # 桌面端 / 存档
    save(legacy_icon(512), os.path.join(ASSETS, "icon-master.png"))
    save(legacy_icon(256), os.path.join(ASSETS, "icon-256.png"))
    save(legacy_icon(48, 0.90), os.path.join(ASSETS, "icon-48.png"))
    save(legacy_icon(16, 0.96), os.path.join(DESKTOP, "tray-16.png"))
    save(legacy_icon(32, 0.94), os.path.join(DESKTOP, "tray-32.png"))
    save(legacy_icon(256), os.path.join(DESKTOP, "window-icon.png"))
    print("[桌面] assets/ + desktop/ 图标已生成")

    # 安卓各密度
    for name, sc in DENSITIES:
        lg = int(round(LEGACY_BASE * sc))
        fg = int(round(FG_BASE * sc))
        d = os.path.join(ANDROID_ICONS, "mipmap-" + name)
        save(legacy_icon(lg, 0.86), os.path.join(d, "ic_launcher.png"))
        save(legacy_icon(lg, 0.82, True), os.path.join(d, "ic_launcher_round.png"))
        save(foreground_layer(fg), os.path.join(d, "ic_launcher_foreground.png"))
        save(mono_layer(fg), os.path.join(d, "ic_launcher_monochrome.png"))
        print("  %-9s legacy=%dpx fg=%dpx" % (name, lg, fg))
    print("[安卓] assets/android-icons/ 已生成")

    make_preview()


def make_preview():
    """一眼看清各尺寸与各启动器遮罩下的效果"""
    LIGHT = (236, 239, 243)
    TILE, PAD, COLS = 176, 20, 4
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 18)
    except Exception:
        font = None

    def masked(size, kind):
        s = size * 4
        shp = Image.new("L", (s, s), 0)
        d = ImageDraw.Draw(shp)
        if kind == "circle":
            d.ellipse([0, 0, s - 1, s - 1], fill=255)
        elif kind == "squircle":
            d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(0.30 * s), fill=255)
        elif kind == "roundrect":
            d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(0.16 * s), fill=255)
        else:
            d.rectangle([0, 0, s - 1, s - 1], fill=255)
        return shp.resize((size, size), Image.NEAREST)

    masks = [("方形", "square"), ("圆形", "circle"), ("圆角方", "squircle"), ("圆角矩", "roundrect")]

    # 自适应图标真实行为：取 108 画布中心 2/3 再套遮罩
    fg = foreground_layer(432)
    adaptive = []
    for _, kind in masks:
        canvas = Image.new("RGBA", (432, 432), BG_A + (255,))
        canvas.alpha_composite(fg)
        crop = canvas.crop((72, 72, 360, 360)).resize((TILE, TILE), Image.NEAREST)
        tile = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
        tile.paste(crop, (0, 0), masked(TILE, kind))
        adaptive.append(tile)

    head = 32
    width = PAD + COLS * (TILE + PAD)
    height = PAD + head + TILE + PAD + head + TILE + PAD
    sheet = Image.new("RGB", (width, height), LIGHT)
    d = ImageDraw.Draw(sheet)

    def label(x, y, t):
        if font:
            d.text((x, y), t, fill=(64, 70, 78), font=font)

    y = PAD
    label(PAD, y, "自适应图标（不同启动器遮罩）")
    y += head
    for i, tile in enumerate(adaptive):
        x = PAD + i * (TILE + PAD)
        sheet.paste(tile, (x, y), tile)
        label(x + 4, y + TILE + 2, masks[i][0])
    y += TILE + PAD
    label(PAD, y, "旧版方形 / 圆形图标 · 各尺寸 16 / 32 / 48 / 256 / 512")
    y += head
    x = PAD
    for s, c in ((16, 0.96), (32, 0.94), (48, 0.90), (256, 0.86)):
        img = legacy_icon(s, c)
        sheet.paste(img, (x, y + (TILE - img.width)), img)
        label(x + 2, y + TILE + 2, str(s))
        x += img.width + 22
    sheet.paste(legacy_icon(144, 0.82, True), (x + 10, y), legacy_icon(144, 0.82, True))
    label(x + 14, y + TILE + 2, "round")

    path = os.path.join(ASSETS, "icon-preview.png")
    sheet.save(path, "PNG", optimize=True)
    print("预览图: " + path)


if __name__ == "__main__":
    main()
