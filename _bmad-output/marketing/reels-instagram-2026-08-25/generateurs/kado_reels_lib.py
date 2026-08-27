# -*- coding: utf-8 -*-
"""Boîte à outils réels Kado — mêmes polices & style que le Réel 1."""
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter
import qrcode

W, H, FPS = 1080, 1920, 30
FDIR = "/mnt/skills/examples/canvas-design/canvas-fonts"

def F(name, size): return ImageFont.truetype(os.path.join(FDIR, name), size)
BOLD  = lambda s: F("Outfit-Bold.ttf", s)
REG   = lambda s: F("Outfit-Regular.ttf", s)
BODYB = lambda s: F("InstrumentSans-Bold.ttf", s)
BODY  = lambda s: F("InstrumentSans-Regular.ttf", s)

NAVY=(30,27,58); WHITE=(255,255,255); CREAM=(255,246,224); GOLD=(255,202,58)
ORANGE=(255,138,61); PINK=(255,94,168); GREEN=(26,127,55); RED=(229,72,77)
CARDTX=(28,36,64); GREY=(150,150,170)

def ease(t): t=max(0.0,min(1.0,t)); return 1-(1-t)**3
def eob(t):
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

def bg_violet(cy=None):
    if cy is None: cy=int(H*0.42)
    return glow(vgrad((51,25,74),(23,9,31)),W//2,cy,760,(150,55,165),0.30).convert("RGBA")
BG_ORANGE=vgrad((255,194,77),(255,120,35))

# ---- texte multi-couleurs centré + wrap + ombre douce ----
def tokenize(spans):
    toks=[]
    for text,color in spans:
        for w in text.replace("\n"," \n ").split(" "):
            if w!="": toks.append([w,color])
    return toks
def wrap(draw,spans,font,max_w):
    toks=tokenize(spans); space=draw.textlength(" ",font=font); lines,cur,curw=[],[],0.0
    for w,c in toks:
        if w=="\n": lines.append(cur); cur,curw=[],0.0; continue
        ww=draw.textlength(w,font=font); add=ww if not cur else curw+space+ww
        if cur and add>max_w: lines.append(cur); cur,curw=[(w,c)],ww
        else: cur.append((w,c)); curw=add
    if cur: lines.append(cur)
    return lines,space
def para(img,spans,font,cx,top_y,max_w,line_gap=1.28,soft=True,opacity=255):
    layer=Image.new("RGBA",img.size,(0,0,0,0)); d=ImageDraw.Draw(layer)
    lines,space=wrap(d,spans,font,max_w); asc,desc=font.getmetrics(); lh=int((asc+desc)*line_gap); y=top_y
    for line in lines:
        total=sum(d.textlength(w,font=font) for w,_ in line)+space*(len(line)-1); x=cx-total/2
        for w,c in line:
            d.text((x,y),w,font=font,fill=(c[0],c[1],c[2],opacity)); x+=d.textlength(w,font=font)+space
        y+=lh
    if soft:
        a=layer.getchannel("A").point(lambda p:int(p*0.55)).filter(ImageFilter.GaussianBlur(7))
        sh=Image.new("RGBA",img.size,(6,2,14,0)); sh.putalpha(a); img.alpha_composite(sh,(0,5))
    img.alpha_composite(layer); return y

# ---- éléments (supersampling x3) ----
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
    d.ellipse([0,0,s,s],fill=NAVY); bw,bh=s*0.52,s*0.40; bx,by=(s-bw)/2,s*0.34; lid=bh*0.28
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
WHEEL_EMOJI=["🎉","☕","🍰","🥐","🎁","😄"]
EMOJI_FONT=ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",109)
_ecache={}
def emoji_img(ch,size):
    key=(ch,size)
    if key in _ecache: return _ecache[key]
    tmp=Image.new("RGBA",(160,160),(0,0,0,0)); ImageDraw.Draw(tmp).text((8,4),ch,font=EMOJI_FONT,embedded_color=True)
    bb=tmp.getbbox()
    if bb: tmp=tmp.crop(bb)
    m=max(tmp.size); sq=Image.new("RGBA",(m,m),(0,0,0,0)); sq.alpha_composite(tmp,((m-tmp.width)//2,(m-tmp.height)//2))
    out=sq.resize((size,size),Image.LANCZOS); _ecache[key]=out; return out
def wheel(size,angle_deg):
    s=size*SS; im=Image.new("RGBA",(s,s),(0,0,0,0)); d=ImageDraw.Draw(im); n=len(WHEEL_COLORS); step=360/n
    d.ellipse([0,0,s,s],fill=(245,245,250)); pad=s*0.035
    for i in range(n):
        a0=angle_deg+i*step; d.pieslice([pad,pad,s-pad,s-pad],a0,a0+step,fill=WHEEL_COLORS[i])
    er=int(s*0.30); esz=int(s*0.15)
    for i,ch in enumerate(WHEEL_EMOJI):
        mid=math.radians(angle_deg+(i+0.5)*step); ex=s/2+er*math.cos(mid); ey=s/2+er*math.sin(mid)
        im.alpha_composite(emoji_img(ch,esz),(int(ex-esz/2),int(ey-esz/2)))
    hub=s*0.16; d.ellipse([s/2-hub,s/2-hub,s/2+hub,s/2+hub],fill=NAVY)
    im.alpha_composite(gift_logo(int(hub*2*0.9)),(int(s/2-hub*0.9),int(s/2-hub*0.9)))
    out=im.resize((size,size),Image.LANCZOS)
    tri=Image.new("RGBA",(size,size),(0,0,0,0)); dt=ImageDraw.Draw(tri); tw=size*0.08
    dt.polygon([(size/2-tw,0),(size/2+tw,0),(size/2,size*0.10)],fill=(240,240,245)); out.alpha_composite(tri)
    return out

def _card_shadow(w,h,radius):
    sh=Image.new("RGBA",(w,h),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([0,0,w,h],radius=radius,fill=(0,0,0,120))
    sh=sh.filter(ImageFilter.GaussianBlur(12)); base=Image.new("RGBA",(w,h+24),(0,0,0,0)); base.alpha_composite(sh,(0,14)); return base
def google_card(w,label,stars_n,reviews_txt,rev_color,extra="€€ · Ouvert"):
    pad=44; h=240; base=_card_shadow(w,h,34); d=ImageDraw.Draw(base)
    d.rounded_rectangle([0,0,w,h],radius=34,fill=WHITE); d.text((pad,40),label,font=BODYB(52),fill=CARDTX)
    base.alpha_composite(stars_row(stars_n,46,GOLD),(pad,118))
    d.text((pad,178),reviews_txt,font=BODYB(40),fill=rev_color); tw=d.textlength(reviews_txt,font=BODYB(40))
    d.text((pad+tw+18,182),"·  "+extra,font=BODY(36),fill=GREY); return base
def pill(text,font,fg,bg,padx=40,pady=22):
    d0=ImageDraw.Draw(Image.new("RGBA",(10,10))); tw=d0.textlength(text,font=font); asc,desc=font.getmetrics(); th=asc+desc
    w=int(tw+2*padx); h=int(th+2*pady); im=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,w,h],radius=h//2,fill=bg); d.text((padx,pady),text,font=font,fill=fg); return im
def review_card(w,text="« Super accueil ! »"):
    h=210; base=_card_shadow(w,h,30); d=ImageDraw.Draw(base); d.rounded_rectangle([0,0,w,h],radius=30,fill=WHITE)
    base.alpha_composite(stars_row(5,44,GOLD),(40,38)); d.text((40,104),text,font=BODYB(46),fill=CARDTX)
    d.text((40,158),"il y a 2 min",font=BODY(32),fill=GREY); return base
def qr_img(data,size):
    q=qrcode.QRCode(border=2,box_size=10,error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(data); q.make(fit=True)
    im=q.make_image(fill_color=(28,36,64),back_color=(255,255,255)).convert("RGBA")
    return im.resize((size,size),Image.NEAREST)
def win_card(w,prize="Un café offert",code="K7XM3",emoji="☕"):
    h=560; base=_card_shadow(w,h,36); d=ImageDraw.Draw(base); d.rounded_rectangle([0,0,w,h],radius=36,fill=WHITE)
    base.alpha_composite(emoji_img("🎉",70),(int(w/2-35),40))
    t1="Bravo, vous avez gagné"; d.text((w/2-d.textlength(t1,font=BODYB(40))/2,128),t1,font=BODYB(40),fill=GREEN)
    base.alpha_composite(emoji_img(emoji,64),(int(w/2-100-32),int(196))) if False else None
    tw=d.textlength(prize,font=BOLD(64)); ew=64
    total=tw+16+ew; sx=w/2-total/2
    d.text((sx,190),prize,font=BOLD(64),fill=CARDTX)
    base.alpha_composite(emoji_img(emoji,ew),(int(sx+tw+16),int(196)))
    # code
    bx0,by0,bx1,by1=w*0.14,300,w*0.86,384
    d.rounded_rectangle([bx0,by0,bx1,by1],radius=18,outline=(180,180,200),width=3)
    spaced=" ".join(list(code)); d.text((w/2-d.textlength(spaced,font=BOLD(56))/2,312),spaced,font=BOLD(56),fill=CARDTX)
    base.alpha_composite(qr_img("https://www.kado-app.fr",150),(int(w/2-75),410))
    return base
def down_chevron(size,color):
    s=size*SS; im=Image.new("RGBA",(s,s),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.line([(s*0.2,s*0.35),(s*0.5,s*0.65)],fill=color,width=int(s*0.10))
    d.line([(s*0.8,s*0.35),(s*0.5,s*0.65)],fill=color,width=int(s*0.10)); return im.resize((size,size),Image.LANCZOS)
def pop(img,element,cx,cy,t,t0,dur=0.4):
    p=clamp((t-t0)/dur)
    if p<=0: return
    sc=0.6+0.4*eob(p); op=int(255*ease(min(1,p*1.4)))
    w,h=element.size; nw,nh=max(1,int(w*sc)),max(1,int(h*sc)); el=element.resize((nw,nh),Image.LANCZOS)
    if op<255:
        a=el.getchannel("A").point(lambda v:int(v*op/255)); el.putalpha(a)
    img.alpha_composite(el,(int(cx-nw/2),int(cy-nh/2)))
def emoji_pop(img,ch,cx,cy,size,t,t0,dur=0.4): pop(img,emoji_img(ch,size),cx,cy,t,t0,dur)

def cta(t,tagline="Chaque client = une chance d'avis",q=None):
    img=BG_ORANGE.convert("RGBA"); a=ease(clamp(t/0.35))
    ls=175; logo=gift_logo(ls); d=ImageDraw.Draw(img); wm=d.textlength("Kado",font=BOLD(130))
    lx=int((W-(ls+26+wm))/2); img.alpha_composite(logo,(lx,int(H*0.10))); d.text((lx+ls+26,int(H*0.10)+16),"Kado",font=BOLD(130),fill=NAVY)
    para(img,[(tagline,NAVY)],BOLD(70),W//2,int(H*0.29),int(W*0.82),soft=False)
    # question d'engagement facile (comment-bait)
    if q:
        qp=pill(q,BOLD(48),WHITE,NAVY); img.alpha_composite(qp,((W-qp.width)//2,int(H*0.45)))
    pulse=1+0.028*math.sin(t*2*math.pi*1.4); bw,bh=int(W*0.74*pulse),int(150*pulse); bx,by=(W-bw)//2,int(H*0.55)
    d.rounded_rectangle([bx,by,bx+bw,by+bh],radius=bh//2,fill=NAVY)
    txt="Commentez DEMO"; tw=d.textlength(txt,font=BOLD(64)); d.text((W//2-tw/2,by+bh/2-46),txt,font=BOLD(64),fill=WHITE)
    img.alpha_composite(down_chevron(90,NAVY),(W//2-45,by+bh+24))
    f=BOLD(54); t1="kado-app.fr"; d.text((W//2-d.textlength(t1,font=f)/2,int(H*0.74)),t1,font=f,fill=NAVY)
    f2=BODYB(40); sub="essai gratuit 14 jours · sans carte bancaire"; d.text((W//2-d.textlength(sub,font=f2)/2,int(H*0.74)+72),sub,font=f2,fill=(90,45,10))
    if a<1: return Image.blend(BG_ORANGE.convert("RGBA"),img,a)
    return img

def render(TL, total, outdir):
    os.makedirs(outdir,exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith(".jpg"): os.remove(os.path.join(outdir,f))
    N=int(total*FPS); FADE=0.16; bounds=[b for a,b,_ in TL[:-1]]
    def frame_at(sec):
        for a,b,fn in TL:
            if a<=sec<b: return fn((sec-a)/(b-a))
        return TL[-1][2](1.0)
    for i in range(N):
        sec=i/FPS; img=frame_at(sec)
        for bd in bounds:
            if 0<=sec-bd<FADE: img=Image.blend(frame_at(bd-0.001),img,ease((sec-bd)/FADE))
        img.convert("RGB").save(os.path.join(outdir,f"f_{i:04d}.jpg"),quality=92)
    return N
