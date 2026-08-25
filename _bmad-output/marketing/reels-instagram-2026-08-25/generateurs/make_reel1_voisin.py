#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère le Réel 1 Kado « Votre voisin capte VOS clients » (1080x1920, 30fps, 15s)."""
import math, os
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
FDIR = "/mnt/skills/examples/canvas-design/canvas-fonts"
OUT = "/tmp/claude-0/-home-user-kado/1bdcc5dd-53b3-5031-82ec-c2fcac50f53b/scratchpad"
FRAMES = os.path.join(OUT, "reel1_frames")
os.makedirs(FRAMES, exist_ok=True)

def F(name, size): return ImageFont.truetype(os.path.join(FDIR, name), size)
BOLD   = lambda s: F("Outfit-Bold.ttf", s)
REG    = lambda s: F("Outfit-Regular.ttf", s)
BODYB  = lambda s: F("InstrumentSans-Bold.ttf", s)
BODY   = lambda s: F("InstrumentSans-Regular.ttf", s)

# ---- couleurs ----
NAVY   = (30, 27, 58)
WHITE  = (255, 255, 255)
CREAM  = (255, 246, 224)
GOLD   = (255, 202, 58)
ORANGE = (255, 138, 61)
PINK   = (255, 94, 168)
GREEN  = (26, 127, 55)
RED    = (229, 72, 77)
CARDTX = (28, 36, 64)
GREY   = (150, 150, 170)

def ease(t):  # easeOutCubic
    return 1 - (1 - t) ** 3
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))

def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def vgrad(c_top, c_bot):
    base = Image.new("RGB", (1, H))
    px = base.load()
    for y in range(H):
        px[0, y] = lerp(c_top, c_bot, y/(H-1))
    return base.resize((W, H))

def glow(img, cx, cy, radius, color, strength=0.35):
    """halo radial doux."""
    layer = Image.new("RGB", (W, H), (0,0,0))
    d = ImageDraw.Draw(layer)
    steps = 40
    for i in range(steps, 0, -1):
        r = int(radius * i/steps)
        a = strength * (1 - i/steps)
        col = tuple(int(color[k]*a) for k in range(3))
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=col)
    return Image.blend(img, ImageChops.add(img, layer), 1.0) if False else ImageChops.add(img, layer)

from PIL import ImageChops

# ---------- rendu texte multi-couleurs, centré, avec retour à la ligne ----------
def tokenize(spans):
    toks = []
    for text, color in spans:
        for w in text.replace("\n", " \n ").split(" "):
            if w != "":
                toks.append([w, color])
    return toks

def wrap(draw, spans, font, max_w):
    toks = tokenize(spans)
    space = draw.textlength(" ", font=font)
    lines, cur, curw = [], [], 0.0
    for w, c in toks:
        if w == "\n":
            lines.append(cur); cur, curw = [], 0.0
            continue
        ww = draw.textlength(w, font=font)
        add = ww if not cur else curw + space + ww
        if cur and add > max_w:
            lines.append(cur); cur, curw = [(w,c)], ww
        else:
            cur.append((w,c)); curw = add
    if cur: lines.append(cur)
    return lines, space

def draw_paragraph(img, spans, font, cx, top_y, max_w, line_gap=1.28, shadow=True):
    draw = ImageDraw.Draw(img)
    lines, space = wrap(draw, spans, font, max_w)
    asc, desc = font.getmetrics()
    lh = int((asc+desc) * line_gap)
    y = top_y
    for line in lines:
        total = sum(draw.textlength(w, font=font) for w,_ in line) + space*(len(line)-1)
        x = cx - total/2
        for w, c in line:
            if shadow:
                draw.text((x+3, y+3), w, font=font, fill=(0,0,0))
            draw.text((x, y), w, font=font, fill=c)
            x += draw.textlength(w, font=font) + space
        y += lh
    return y  # bas du paragraphe

def text_block_height(img, spans, font, max_w, line_gap=1.28):
    draw = ImageDraw.Draw(img)
    lines, _ = wrap(draw, spans, font, max_w)
    asc, desc = font.getmetrics()
    return int((asc+desc)*line_gap) * len(lines)

# ---------- éléments graphiques (supersampling x3) ----------
SS = 3
def star(size, color):
    s = size*SS
    im = Image.new("RGBA", (s, s), (0,0,0,0))
    d = ImageDraw.Draw(im)
    cx=cy=s/2; R=s/2*0.98; r=R*0.42; pts=[]
    for i in range(10):
        ang = -math.pi/2 + i*math.pi/5
        rad = R if i%2==0 else r
        pts.append((cx+rad*math.cos(ang), cy+rad*math.sin(ang)))
    d.polygon(pts, fill=color)
    return im.resize((size, size), Image.LANCZOS)

def stars_row(count, size, color, gap_ratio=0.14):
    gap = int(size*gap_ratio)
    w = count*size + (count-1)*gap
    im = Image.new("RGBA", (w, size), (0,0,0,0))
    st = star(size, color)
    for i in range(count):
        im.alpha_composite(st, (i*(size+gap), 0))
    return im

def gift_logo(size):
    """Logo Kado : cercle navy + cadeau crème + étincelle."""
    s = size*SS
    im = Image.new("RGBA", (s, s), (0,0,0,0))
    d = ImageDraw.Draw(im)
    d.ellipse([0,0,s,s], fill=NAVY)
    # boîte cadeau
    bw, bh = s*0.52, s*0.40
    bx, by = (s-bw)/2, s*0.34
    lid_h = bh*0.28
    d.rounded_rectangle([bx, by+lid_h, bx+bw, by+bh+lid_h*0.2], radius=s*0.03, fill=CREAM)
    d.rounded_rectangle([bx-bw*0.06, by, bx+bw+bw*0.06, by+lid_h], radius=s*0.03, fill=GOLD)
    # ruban vertical
    d.rectangle([s/2-bw*0.07, by, s/2+bw*0.07, by+bh+lid_h], fill=GOLD)
    # noeud
    d.ellipse([s/2-bw*0.20, by-lid_h*0.7, s/2-bw*0.01, by+lid_h*0.3], fill=GOLD)
    d.ellipse([s/2+bw*0.01, by-lid_h*0.7, s/2+bw*0.20, by+lid_h*0.3], fill=GOLD)
    # étincelle (4 branches)
    sx, sy, sr = s*0.70, s*0.30, s*0.075
    d.polygon([(sx,sy-sr),(sx+sr*0.32,sy-sr*0.32),(sx+sr,sy),(sx+sr*0.32,sy+sr*0.32),
               (sx,sy+sr),(sx-sr*0.32,sy+sr*0.32),(sx-sr,sy),(sx-sr*0.32,sy-sr*0.32)], fill=CREAM)
    return im.resize((size, size), Image.LANCZOS)

WHEEL_COLORS = [(255,111,174),(255,202,58),(155,93,229),(255,122,92),(241,91,181),(255,209,102)]
def wheel(size, angle_deg):
    s = size*SS
    im = Image.new("RGBA", (s, s), (0,0,0,0))
    d = ImageDraw.Draw(im)
    n = len(WHEEL_COLORS); step = 360/n
    # anneau extérieur
    d.ellipse([0,0,s,s], fill=(245,245,250))
    pad = s*0.035
    for i in range(n):
        a0 = angle_deg + i*step
        a1 = a0 + step
        d.pieslice([pad,pad,s-pad,s-pad], a0, a1, fill=WHEEL_COLORS[i])
    # moyeu
    hub = s*0.16
    d.ellipse([s/2-hub, s/2-hub, s/2+hub, s/2+hub], fill=NAVY)
    g = gift_logo(int(size*0.20))
    im.alpha_composite(g.resize((int(hub*2*0.9), int(hub*2*0.9)), Image.LANCZOS),
                       (int(s/2-hub*0.9), int(s/2-hub*0.9)))
    out = im.resize((size, size), Image.LANCZOS)
    # pointeur (triangle) au sommet
    tri = Image.new("RGBA", (size, size), (0,0,0,0))
    dt = ImageDraw.Draw(tri)
    tw = size*0.08
    dt.polygon([(size/2-tw, 0),(size/2+tw, 0),(size/2, size*0.10)], fill=(240,240,245))
    out.alpha_composite(tri)
    return out

def google_card(w, label, stars_n, reviews_txt, rev_color, extra="€€ · Ouvert"):
    """carte fiche Google (RGBA)."""
    pad = 44
    h = 240
    im = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,w,h], radius=34, fill=WHITE)
    d.text((pad, 40), label, font=BODYB(52), fill=CARDTX)
    srow = stars_row(stars_n, 46, GOLD)
    im.alpha_composite(srow, (pad, 118))
    d.text((pad, 178), reviews_txt, font=BODYB(40), fill=rev_color)
    tw = d.textlength(reviews_txt, font=BODYB(40))
    d.text((pad+tw+18, 182), "·  "+extra, font=BODY(36), fill=GREY)
    return im

def down_chevron(size, color):
    s=size*SS; im=Image.new("RGBA",(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.line([(s*0.2,s*0.35),(s*0.5,s*0.65)], fill=color, width=int(s*0.10))
    d.line([(s*0.8,s*0.35),(s*0.5,s*0.65)], fill=color, width=int(s*0.10))
    return im.resize((size,size), Image.LANCZOS)

# fonds pré-calculés
BG_VIOLET = vgrad((51,25,74),(23,9,31))
BG_ORANGE = vgrad((255,194,77),(255,120,35))

def add_glow(bg, cx, cy, r, color, strength):
    return glow(bg.copy(), cx, cy, r, color, strength).convert("RGBA")

# ---------------- SCÈNES ----------------
def scene_hook(t):  # 0..1 progress local
    img = add_glow(BG_VIOLET, W//2, int(H*0.42), 720, (120,40,140), 0.30)
    a = ease(clamp(t/0.5))
    yoff = int((1-a)*40)
    spans = [("Pourquoi votre voisin\nest toujours plein…", WHITE)]
    # on gère le saut de ligne manuellement -> deux paragraphes
    fnt = BOLD(84)
    draw_paragraph(img, [("Pourquoi votre voisin est toujours plein…", WHITE)], fnt,
                   W//2, int(H*0.30)+yoff, int(W*0.82))
    a2 = ease(clamp((t-0.35)/0.5))
    if a2>0:
        layer = img.copy()
        draw_paragraph(layer, [("et pas ", WHITE),("vous ?", PINK)], BOLD(96),
                       W//2, int(H*0.56), int(W*0.82))
        img = Image.blend(img, layer, a2)
    return img

def scene_cards(t):
    img = add_glow(BG_VIOLET, W//2, int(H*0.40), 700, (110,40,150), 0.28)
    draw_paragraph(img, [("Sur Google, dans votre quartier :", WHITE)], BOLD(58),
                   W//2, int(H*0.16), int(W*0.85))
    cw = int(W*0.82)
    # carte voisin (slide depuis la gauche)
    a1 = ease(clamp(t/0.45))
    c1 = google_card(cw, "Le Voisin", 5, "243 avis", GREEN)
    x1 = int(-cw + (W//2 - cw//2 + cw)*a1)
    x1 = int(lerp((-cw,0,0),( (W-cw)//2,0,0), a1)[0])
    img.alpha_composite(c1, (x1, int(H*0.30)))
    # compteur avis voisin? garde statique pour lisibilité
    # carte vous (slide depuis la droite, un peu après)
    a2 = ease(clamp((t-0.25)/0.45))
    if a2>0:
        # compteur qui monte 3 (reste petit) -> effet rouge clignotant léger
        c2 = google_card(cw, "Vous", 5, "3 avis", RED)
        x2 = int(lerp((W,0,0),((W-cw)//2,0,0), a2)[0])
        img.alpha_composite(c2, (x2, int(H*0.52)))
    # verdict
    a3 = ease(clamp((t-0.6)/0.4))
    if a3>0:
        layer = img.copy()
        draw_paragraph(layer, [("C'est ", WHITE),("lui", GOLD),(" qui capte le client.", WHITE)],
                       BOLD(60), W//2, int(H*0.74), int(W*0.85))
        img = Image.blend(img, layer, a3)
    return img

def scene_point(t):
    img = add_glow(BG_VIOLET, W//2, int(H*0.45), 720, (130,45,150), 0.30)
    a = ease(clamp(t/0.5))
    layer = img.copy()
    draw_paragraph(layer, [("Le client choisit ", WHITE),("TOUJOURS", GOLD),
                           (" le mieux noté.", WHITE)], BOLD(84),
                   W//2, int(H*0.34), int(W*0.84))
    draw_paragraph(layer, [("Point.", PINK)], BOLD(110), W//2, int(H*0.56), int(W*0.84))
    return Image.blend(img, layer, a)

def scene_kado(t):
    img = add_glow(BG_VIOLET, W//2, int(H*0.42), 760, (150,60,170), 0.32)
    draw_paragraph(img, [("Kado transforme vos\nclients en avis.", WHITE)], BOLD(80),
                   W//2, int(H*0.14), int(W*0.86))
    # roue qui tourne
    ws = 620
    w = wheel(ws, -angle(t))
    img.alpha_composite(w, ((W-ws)//2, int(H*0.34)))
    a = ease(clamp((t-0.4)/0.5))
    if a>0:
        layer = img.copy()
        draw_paragraph(layer, [("Ils scannent, jouent, gagnent —", WHITE)], BODYB(46),
                       W//2, int(H*0.78), int(W*0.86), line_gap=1.2)
        draw_paragraph(layer, [("l'avis vient tout seul.", GOLD)], BODYB(50),
                       W//2, int(H*0.82), int(W*0.86), line_gap=1.2)
        img = Image.blend(img, layer, a)
    return img
def angle(t):  # vitesse de rotation décroissante
    return 360*2*ease(clamp(t)) + 40

def scene_cta(t):
    img = BG_ORANGE.convert("RGBA")
    a = ease(clamp(t/0.4))
    # logo + wordmark
    ls = 200
    logo = gift_logo(ls)
    total_w = ls + 30 + ImageDraw.Draw(img).textlength("Kado", font=BOLD(150))
    lx = int((W-total_w)/2)
    img.alpha_composite(logo, (lx, int(H*0.16)))
    d = ImageDraw.Draw(img)
    d.text((lx+ls+30, int(H*0.16)+18), "Kado", font=BOLD(150), fill=NAVY)
    # accroche
    draw_paragraph(img, [("Chaque client =\nune chance d'avis", NAVY)], BOLD(76),
                   W//2, int(H*0.36), int(W*0.86), shadow=False)
    # bouton
    bw, bh = int(W*0.74), 150
    bx, by = (W-bw)//2, int(H*0.55)
    d.rounded_rectangle([bx,by,bx+bw,by+bh], radius=bh//2, fill=NAVY)
    txt="Commentez DEMO"; tw=d.textlength(txt, font=BOLD(64))
    d.text((W//2-tw/2, by+bh/2-46), txt, font=BOLD(64), fill=WHITE)
    ch = down_chevron(90, NAVY)
    img.alpha_composite(ch, (W//2-45, by+bh+24))
    # pied
    d2t="kado-app.fr"; f=BOLD(54); tw=d.textlength(d2t, font=f)
    d.text((W//2-tw/2, int(H*0.74)), d2t, font=f, fill=NAVY)
    sub="essai gratuit 14 jours · sans carte bancaire"; f2=BODYB(40); tw2=d.textlength(sub, font=f2)
    d.text((W//2-tw2/2, int(H*0.74)+72), sub, font=f2, fill=(90,45,10))
    if a<1:
        return Image.blend(BG_ORANGE.convert("RGBA"), img, a)
    return img

# ---- timeline (secondes) ----
TL = [
    (0.0, 2.2, scene_hook),
    (2.2, 6.2, scene_cards),
    (6.2, 9.4, scene_point),
    (9.4, 12.8, scene_kado),
    (12.8, 15.0, scene_cta),
]
TOTAL = 15.0
N = int(TOTAL*FPS)

def frame_at(sec):
    for a,b,fn in TL:
        if a <= sec < b:
            return fn((sec-a)/(b-a))
    return TL[-1][2](1.0)

def crossfade(prev, cur, k):  # petit fondu entre scènes
    return Image.blend(prev, cur, k)

print("Rendu de", N, "frames…")
FADE = 0.18  # s
boundaries = [b for a,b,_ in TL[:-1]]
for i in range(N):
    sec = i/FPS
    img = frame_at(sec)
    # fondu court aux frontières
    for bd in boundaries:
        if 0 <= sec-bd < FADE:
            k = (sec-bd)/FADE
            img = crossfade(frame_at(bd-0.001), img, ease(k))
    img.convert("RGB").save(os.path.join(FRAMES, f"f_{i:04d}.jpg"), quality=92)
    if i % 30 == 0: print("  frame", i)
print("Frames OK ->", FRAMES)
