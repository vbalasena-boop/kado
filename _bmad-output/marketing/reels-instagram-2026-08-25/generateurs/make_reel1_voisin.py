#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Réel 1 Kado « Votre voisin capte VOS clients » — v2 améliorée (BMAD).
1080x1920, 30fps, 15s. Mêmes polices : Outfit + Instrument Sans."""
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter

W, H, FPS = 1080, 1920, 30
FDIR = "/mnt/skills/examples/canvas-design/canvas-fonts"
OUT = "/tmp/claude-0/-home-user-kado/1bdcc5dd-53b3-5031-82ec-c2fcac50f53b/scratchpad"
FRAMES = os.path.join(OUT, "reel1_frames")
os.makedirs(FRAMES, exist_ok=True)

def F(name, size): return ImageFont.truetype(os.path.join(FDIR, name), size)
BOLD  = lambda s: F("Outfit-Bold.ttf", s)          # même police qu'avant
REG   = lambda s: F("Outfit-Regular.ttf", s)
BODYB = lambda s: F("InstrumentSans-Bold.ttf", s)
BODY  = lambda s: F("InstrumentSans-Regular.ttf", s)

# ---- couleurs ----
NAVY=(30,27,58); WHITE=(255,255,255); CREAM=(255,246,224); GOLD=(255,202,58)
ORANGE=(255,138,61); PINK=(255,94,168); GREEN=(26,127,55); RED=(229,72,77)
CARDTX=(28,36,64); GREY=(150,150,170)

def ease(t): t=max(0.0,min(1.0,t)); return 1-(1-t)**3
def eob(t):  # easeOutBack (léger overshoot)
    t=max(0.0,min(1.0,t)); c1=1.70158; c3=c1+1
    return 1+c3*(t-1)**3+c1*(t-1)**2
def clamp(x,a=0.0,b=1.0): return max(a,min(b,x))
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))

def vgrad(c_top,c_bot):
    base=Image.new("RGB",(1,H)); px=base.load()
    for y in range(H): px[0,y]=lerp(c_top,c_bot,y/(H-1))
    return base.resize((W,H))

def glow(img,cx,cy,radius,color,strength):
    layer=Image.new("RGB",(W,H),(0,0,0)); d=ImageDraw.Draw(layer); steps=44
    for i in range(steps,0,-1):
        r=int(radius*i/steps); a=strength*(1-i/steps)
        d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=tuple(int(color[k]*a) for k in range(3)))
    return ImageChops.add(img,layer)

def bg_violet(cx=W//2,cy=int(H*0.42)):
    return glow(vgrad((51,25,74),(23,9,31)),cx,cy,760,(150,55,165),0.30).convert("RGBA")
BG_ORANGE=vgrad((255,194,77),(255,120,35))

# ---------- texte multi-couleurs, centré, wrap + saut de ligne + ombre douce ----------
def tokenize(spans):
    toks=[]
    for text,color in spans:
        for w in text.replace("\n"," \n ").split(" "):
            if w!="": toks.append([w,color])
    return toks

def wrap(draw,spans,font,max_w):
    toks=tokenize(spans); space=draw.textlength(" ",font=font)
    lines,cur,curw=[],[],0.0
    for w,c in toks:
        if w=="\n": lines.append(cur); cur,curw=[],0.0; continue
        ww=draw.textlength(w,font=font); add=ww if not cur else curw+space+ww
        if cur and add>max_w: lines.append(cur); cur,curw=[(w,c)],ww
        else: cur.append((w,c)); curw=add
    if cur: lines.append(cur)
    return lines,space

def para(img,spans,font,cx,top_y,max_w,line_gap=1.28,soft=True,opacity=255):
    """Dessine un paragraphe avec ombre douce floutée sur une image RGBA."""
    layer=Image.new("RGBA",img.size,(0,0,0,0)); d=ImageDraw.Draw(layer)
    lines,space=wrap(d,spans,font,max_w); asc,desc=font.getmetrics()
    lh=int((asc+desc)*line_gap); y=top_y
    for line in lines:
        total=sum(d.textlength(w,font=font) for w,_ in line)+space*(len(line)-1)
        x=cx-total/2
        for w,c in line:
            d.text((x,y),w,font=font,fill=(c[0],c[1],c[2],opacity))
            x+=d.textlength(w,font=font)+space
        y+=lh
    if soft:
        a=layer.getchannel("A").point(lambda p:int(p*0.55)).filter(ImageFilter.GaussianBlur(7))
        sh=Image.new("RGBA",img.size,(6,2,14,0)); sh.putalpha(a)
        img.alpha_composite(sh,(0,5))
    img.alpha_composite(layer)
    return y

# ---------- éléments (supersampling x3) ----------
SS=3
def star(size,color):
    s=size*SS; im=Image.new("RGBA",(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
    cx=cy=s/2; R=s/2*0.98; r=R*0.42; pts=[]
    for i in range(10):
        ang=-math.pi/2+i*math.pi/5; rad=R if i%2==0 else r
        pts.append((cx+rad*math.cos(ang),cy+rad*math.sin(ang)))
    d.polygon(pts,fill=color); return im.resize((size,size),Image.LANCZOS)

def stars_row(count,size,color,gap_ratio=0.14):
    gap=int(size*gap_ratio); w=count*size+(count-1)*gap
    im=Image.new("RGBA",(w,size),(0,0,0,0)); st=star(size,color)
    for i in range(count): im.alpha_composite(st,(i*(size+gap),0))
    return im

def gift_logo(size):
    s=size*SS; im=Image.new("RGBA",(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse([0,0,s,s],fill=NAVY)
    bw,bh=s*0.52,s*0.40; bx,by=(s-bw)/2,s*0.34; lid=bh*0.28
    d.rounded_rectangle([bx,by+lid,bx+bw,by+bh+lid*0.2],radius=s*0.03,fill=CREAM)
    d.rounded_rectangle([bx-bw*0.06,by,bx+bw+bw*0.06,by+lid],radius=s*0.03,fill=GOLD)
    d.rectangle([s/2-bw*0.07,by,s/2+bw*0.07,by+bh+lid],fill=GOLD)
    d.ellipse([s/2-bw*0.20,by-lid*0.7,s/2-bw*0.01,by+lid*0.3],fill=GOLD)
    d.ellipse([s/2+bw*0.01,by-lid*0.7,s/2+bw*0.20,by+lid*0.3],fill=GOLD)
    sx,sy,sr=s*0.70,s*0.30,s*0.075
    d.polygon([(sx,sy-sr),(sx+sr*0.32,sy-sr*0.32),(sx+sr,sy),(sx+sr*0.32,sy+sr*0.32),
               (sx,sy+sr),(sx-sr*0.32,sy+sr*0.32),(sx-sr,sy),(sx-sr*0.32,sy-sr*0.32)],fill=CREAM)
    return im.resize((size,size),Image.LANCZOS)

WHEEL_COLORS=[(255,111,174),(255,202,58),(155,93,229),(255,122,92),(241,91,181),(255,209,102)]
WHEEL_EMOJI=["🎉","☕","🍰","🥐","🎁","😄"]  # icônes produits (comme le vrai réel Kado)
EMOJI_FONT=ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",109)
_emoji_cache={}
def emoji_img(ch,size):
    key=(ch,size)
    if key in _emoji_cache: return _emoji_cache[key]
    tmp=Image.new("RGBA",(160,160),(0,0,0,0))
    ImageDraw.Draw(tmp).text((8,4),ch,font=EMOJI_FONT,embedded_color=True)
    bb=tmp.getbbox()
    if bb: tmp=tmp.crop(bb)
    m=max(tmp.size); sq=Image.new("RGBA",(m,m),(0,0,0,0))
    sq.alpha_composite(tmp,((m-tmp.width)//2,(m-tmp.height)//2))
    out=sq.resize((size,size),Image.LANCZOS); _emoji_cache[key]=out; return out

def wheel(size,angle_deg):
    s=size*SS; im=Image.new("RGBA",(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
    n=len(WHEEL_COLORS); step=360/n
    d.ellipse([0,0,s,s],fill=(245,245,250)); pad=s*0.035
    for i in range(n):
        a0=angle_deg+i*step; d.pieslice([pad,pad,s-pad,s-pad],a0,a0+step,fill=WHEEL_COLORS[i])
    # icônes produits, une par segment, gardées à l'endroit (lisibles)
    er=int(s*0.30); esz=int(s*0.15)
    for i,ch in enumerate(WHEEL_EMOJI):
        mid=math.radians(angle_deg+(i+0.5)*step)
        ex=s/2+er*math.cos(mid); ey=s/2+er*math.sin(mid)
        ic=emoji_img(ch,esz); im.alpha_composite(ic,(int(ex-esz/2),int(ey-esz/2)))
    hub=s*0.16; d.ellipse([s/2-hub,s/2-hub,s/2+hub,s/2+hub],fill=NAVY)
    g=gift_logo(int(hub*2*0.9))
    im.alpha_composite(g,(int(s/2-hub*0.9),int(s/2-hub*0.9)))
    out=im.resize((size,size),Image.LANCZOS)
    tri=Image.new("RGBA",(size,size),(0,0,0,0)); dt=ImageDraw.Draw(tri); tw=size*0.08
    dt.polygon([(size/2-tw,0),(size/2+tw,0),(size/2,size*0.10)],fill=(240,240,245))
    out.alpha_composite(tri); return out

def google_card(w,label,stars_n,reviews_txt,rev_color,extra="€€ · Ouvert"):
    pad=44; h=240; im=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    # ombre douce de carte
    sh=Image.new("RGBA",(w,h),(0,0,0,0)); ds=ImageDraw.Draw(sh)
    ds.rounded_rectangle([0,0,w,h],radius=34,fill=(0,0,0,120))
    sh=sh.filter(ImageFilter.GaussianBlur(12))
    base=Image.new("RGBA",(w,h+24),(0,0,0,0)); base.alpha_composite(sh,(0,14)); base.alpha_composite(im,(0,0))
    d=ImageDraw.Draw(base)
    d.rounded_rectangle([0,0,w,h],radius=34,fill=WHITE)
    d.text((pad,40),label,font=BODYB(52),fill=CARDTX)
    base.alpha_composite(stars_row(stars_n,46,GOLD),(pad,118))
    d.text((pad,178),reviews_txt,font=BODYB(40),fill=rev_color)
    tw=d.textlength(reviews_txt,font=BODYB(40))
    d.text((pad+tw+18,182),"·  "+extra,font=BODY(36),fill=GREY)
    return base

def pill(text,font,fg,bg,padx=40,pady=22):
    d0=ImageDraw.Draw(Image.new("RGBA",(10,10))); tw=d0.textlength(text,font=font)
    asc,desc=font.getmetrics(); th=asc+desc
    w=int(tw+2*padx); h=int(th+2*pady); im=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,w,h],radius=h//2,fill=bg); d.text((padx,pady),text,font=font,fill=fg)
    return im

def review_card(w):
    h=210; im=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    sh=Image.new("RGBA",(w,h),(0,0,0,0)); ds=ImageDraw.Draw(sh)
    ds.rounded_rectangle([0,0,w,h],radius=30,fill=(0,0,0,120)); sh=sh.filter(ImageFilter.GaussianBlur(12))
    base=Image.new("RGBA",(w,h+24),(0,0,0,0)); base.alpha_composite(sh,(0,14)); base.alpha_composite(im,(0,0))
    d=ImageDraw.Draw(base); d.rounded_rectangle([0,0,w,h],radius=30,fill=WHITE)
    base.alpha_composite(stars_row(5,44,GOLD),(40,38))
    d.text((40,104),"« Super accueil ! »",font=BODYB(46),fill=CARDTX)
    d.text((40,158),"il y a 2 min",font=BODY(32),fill=GREY)
    return base

def down_chevron(size,color):
    s=size*SS; im=Image.new("RGBA",(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.line([(s*0.2,s*0.35),(s*0.5,s*0.65)],fill=color,width=int(s*0.10))
    d.line([(s*0.8,s*0.35),(s*0.5,s*0.65)],fill=color,width=int(s*0.10))
    return im.resize((size,size),Image.LANCZOS)

def pop_in(img,element,cx,cy,t,t0,dur=0.4):
    """apparition avec léger scale-up + fade, centrée sur (cx,cy)."""
    p=clamp((t-t0)/dur)
    if p<=0: return
    sc=0.6+0.4*eob(p); op=int(255*ease(min(1,p*1.4)))
    w,h=element.size; nw,nh=max(1,int(w*sc)),max(1,int(h*sc))
    el=element.resize((nw,nh),Image.LANCZOS)
    if op<255:
        a=el.getchannel("A").point(lambda v:int(v*op/255)); el.putalpha(a)
    img.alpha_composite(el,(int(cx-nw/2),int(cy-nh/2)))

# ---------------- SCÈNES ----------------
def scene_hook(t):
    img=bg_violet()
    para(img,[("Pourquoi votre voisin est toujours plein…",WHITE)],BOLD(84),
         W//2,int(H*0.28)+int((1-eob(clamp(t/0.45)))*30),int(W*0.82),opacity=int(255*ease(clamp(t/0.4))))
    op2=int(255*ease(clamp((t-0.4)/0.4)))
    if op2>0:
        para(img,[("et pas ",WHITE),("vous ?",PINK)],BOLD(100),
             W//2,int(H*0.56),int(W*0.82),opacity=op2)
    return img

def scene_cards(t):
    img=bg_violet(int(H*0.40))
    para(img,[("Sur Google, dans votre quartier :",WHITE)],BOLD(58),W//2,int(H*0.15),int(W*0.85))
    cw=int(W*0.82)
    # carte voisin : slide + compteur qui grimpe 0->243
    a1=ease(clamp(t/0.4)); cnt=int(243*ease(clamp((t-0.15)/0.4)))
    c1=google_card(cw,"Le Voisin",5,f"{cnt} avis",GREEN)
    x1=int(lerp((-cw,0,0),((W-cw)//2,0,0),a1)[0]); img.alpha_composite(c1,(x1,int(H*0.27)))
    # carte vous : slide (droite)
    a2=ease(clamp((t-0.22)/0.4))
    if a2>0:
        c2=google_card(cw,"Vous",5,"3 avis",RED)
        x2=int(lerp((W,0,0),((W-cw)//2,0,0),a2)[0]); img.alpha_composite(c2,(x2,int(H*0.49)))
    # pill 81x
    pop_in(img,pill("81× moins d'avis",BOLD(52),WHITE,RED),W//2,int(H*0.685),t,0.55)
    # verdict
    op=int(255*ease(clamp((t-0.68)/0.32)))
    if op>0:
        para(img,[("C'est ",WHITE),("lui",GOLD),(" qui capte le client.",WHITE)],BOLD(60),
             W//2,int(H*0.76),int(W*0.85),opacity=op)
    return img

def scene_point(t):
    img=bg_violet(int(H*0.45)); op=int(255*ease(clamp(t/0.4)))
    para(img,[("Le client choisit ",WHITE),("TOUJOURS",GOLD),(" le mieux noté.",WHITE)],
         BOLD(84),W//2,int(H*0.32),int(W*0.84),opacity=op)
    op2=int(255*ease(clamp((t-0.35)/0.4)))
    if op2>0:
        para(img,[("Point.",PINK)],BOLD(120),W//2,int(H*0.56),int(W*0.84),
             opacity=op2)
    return img

def scene_kado(t):
    img=bg_violet()
    para(img,[("Kado transforme vos clients en avis.",WHITE)],BOLD(80),
         W//2,int(H*0.12),int(W*0.86))
    # roue qui décélère et s'arrête
    ws=560; ang=-(360*2.3*ease(clamp(t/0.62))+35)
    img.alpha_composite(wheel(ws,ang),((W-ws)//2,int(H*0.30)))
    # avis 5 étoiles qui pop après l'arrêt
    rc=review_card(int(W*0.78))
    pop_in(img,rc,W//2,int(H*0.80),t,0.66,dur=0.45)
    return img

def scene_cta(t):
    img=BG_ORANGE.convert("RGBA"); a=ease(clamp(t/0.35))
    ls=200; logo=gift_logo(ls)
    d=ImageDraw.Draw(img); wm=d.textlength("Kado",font=BOLD(150))
    total=ls+30+wm; lx=int((W-total)/2)
    img.alpha_composite(logo,(lx,int(H*0.15)))
    d.text((lx+ls+30,int(H*0.15)+18),"Kado",font=BOLD(150),fill=NAVY)
    para(img,[("Chaque client = une chance d'avis",NAVY)],BOLD(76),
         W//2,int(H*0.36),int(W*0.80),soft=False)
    # bouton avec pulsation
    pulse=1+0.028*math.sin(t*2*math.pi*1.4)
    bw,bh=int(W*0.74*pulse),int(150*pulse); bx,by=(W-bw)//2,int(H*0.55)
    d.rounded_rectangle([bx,by,bx+bw,by+bh],radius=bh//2,fill=NAVY)
    txt="Commentez DEMO"; tw=d.textlength(txt,font=BOLD(64))
    d.text((W//2-tw/2,by+bh/2-46),txt,font=BOLD(64),fill=WHITE)
    img.alpha_composite(down_chevron(90,NAVY),(W//2-45,by+bh+24))
    f=BOLD(54); t1="kado-app.fr"; tw=d.textlength(t1,font=f)
    d.text((W//2-tw/2,int(H*0.74)),t1,font=f,fill=NAVY)
    f2=BODYB(40); sub="essai gratuit 14 jours · sans carte bancaire"; tw2=d.textlength(sub,font=f2)
    d.text((W//2-tw2/2,int(H*0.74)+72),sub,font=f2,fill=(90,45,10))
    if a<1: return Image.blend(BG_ORANGE.convert("RGBA"),img,a)
    return img

# ---- timeline (secondes) ----
SCALE=1.5  # laisse le temps de lire : ~15 s -> ~22,5 s
TL=[(a*SCALE,b*SCALE,fn) for a,b,fn in
    [(0.0,2.2,scene_hook),(2.2,6.4,scene_cards),(6.4,9.3,scene_point),
     (9.3,12.7,scene_kado),(12.7,15.0,scene_cta)]]
TOTAL=15.0*SCALE; N=int(TOTAL*FPS)

def frame_at(sec):
    for a,b,fn in TL:
        if a<=sec<b: return fn((sec-a)/(b-a))
    return TL[-1][2](1.0)

FADE=0.16; boundaries=[b for a,b,_ in TL[:-1]]
print("Rendu de",N,"frames…")
for i in range(N):
    sec=i/FPS; img=frame_at(sec)
    for bd in boundaries:
        if 0<=sec-bd<FADE:
            img=Image.blend(frame_at(bd-0.001),img,ease((sec-bd)/FADE))
    img.convert("RGB").save(os.path.join(FRAMES,f"f_{i:04d}.jpg"),quality=92)
    if i%60==0: print("  frame",i)
print("Frames OK ->",FRAMES)
