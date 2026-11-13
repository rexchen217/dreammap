# 用桌面端图标生成安卓各分辨率启动图标（含自适应前景/单色/圆形）
# 用法: python tools/make_android_icons.py
import os
from collections import Counter
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android-app', 'android', 'app', 'src', 'main', 'res')
SRC = os.path.join(ROOT, 'desktop', 'window-icon.png')

DENS = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0}
LEGACY = 48       # mdpi 基准尺寸
ADAPTIVE = 108    # 自适应图标画布 dp

base = Image.open(SRC).convert('RGBA')
big = 1024
base = base.resize((big, big), Image.LANCZOS)

# 取图标边缘的底色（顶部中间区域），避免把画面里的浅色当成背景
strip = base.crop((big // 2 - 60, 2, big // 2 + 60, 26))
vals = [p[:3] for p in strip.getdata() if p[3] > 250]
navy = Counter(vals).most_common(1)[0][0]
print('background color', navy, '#%02X%02X%02X' % navy)

def circle_mask(size):
    m = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)

def save(img, dens, name):
    d = os.path.join(RES, 'mipmap-' + dens)
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, name)
    img.save(p, 'PNG', optimize=True)
    return p

for dens, k in DENS.items():
    # 传统方形图标
    s = round(LEGACY * k)
    ic = base.resize((s, s), Image.LANCZOS)
    save(ic, dens, 'ic_launcher.png')
    # 圆形图标
    r = ic.copy()
    r.putalpha(circle_mask(s))
    save(r, dens, 'ic_launcher_round.png')

    # 自适应前景：108dp 画布，主体缩到约 72%，留安全区
    c = round(ADAPTIVE * k)
    fg = Image.new('RGBA', (c, c), (0, 0, 0, 0))
    inner = round(c * 0.72)
    fg.paste(base.resize((inner, inner), Image.LANCZOS), ((c - inner) // 2, (c - inner) // 2))
    save(fg, dens, 'ic_launcher_foreground.png')

    # 单色（主题图标）：取画面中较亮的内容做白色剪影
    mono_src = base.resize((inner, inner), Image.LANCZOS)
    px = mono_src.load()
    mono = Image.new('RGBA', (inner, inner), (0, 0, 0, 0))
    mp = mono.load()
    for y in range(inner):
        for x in range(inner):
            r0, g0, b0, a0 = px[x, y]
            lum = 0.299 * r0 + 0.587 * g0 + 0.114 * b0
            if a0 > 128 and lum > 110:
                mp[x, y] = (255, 255, 255, 255)
    mc = Image.new('RGBA', (c, c), (0, 0, 0, 0))
    mc.paste(mono, ((c - inner) // 2, (c - inner) // 2), mono)
    save(mc, dens, 'ic_launcher_monochrome.png')

# 同步自适应图标背景色
colors = os.path.join(RES, 'values', 'ic_launcher_background.xml')
hexc = '#%02X%02X%02X' % navy
if os.path.exists(colors):
    txt = open(colors, encoding='utf-8').read()
    import re
    txt2 = re.sub(r'(<color name="ic_launcher_background">)[^<]*(</color>)', r'\g<1>' + hexc + r'\g<2>', txt)
    open(colors, 'w', encoding='utf-8').write(txt2)
    print('updated', colors, hexc)
else:
    print('no ic_launcher_background.xml, style color remains')
print('icons generated')
