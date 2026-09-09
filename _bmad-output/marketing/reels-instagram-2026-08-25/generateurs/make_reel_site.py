# -*- coding: utf-8 -*-
"""Réel 17 « style site » — reprend la charte de kado-app.fr
(night radial, Bricolage Grotesque, gold/coral/mint/violet, texte cream)."""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import kado_reels_lib as K
from kado_reels_lib import W,H,ease,clamp,eob,emoji_img,star,stars_row,gift_logo,wheel,render

FDIR="/mnt/skills/examples/canvas-design/canvas-fonts"
HEAD=lambda s: ImageFont.truetype(os.path.join(FDIR,"BricolageGrotesque-Bold.ttf"),s)
HEADR=lambda s: ImageFont.truetype(os.path.join(FDIR,"BricolageGrotesque-Regular.ttf"),s)
BODY=lambda s: ImageFont.truetype(os.path.join(FDIR,"InstrumentSans-Bold.ttf"),s)
BODYR=lambda s: ImageFont.truetype(os.path.join(FDIR,"InstrumentSans-Regular.ttf"),s)

# ---- charte site ----
NIGHT=(23,9,46); NIGHT2=(17,7,32); SURFACE=(36,22,65); GLOW=(58,37,104)
GOLD=(245,184,65); GOLD_DEEP=(224,160,32); CORAL=(255,93,115); MINT=(61,217,160)
VIOLET=(139,108,255); CREAM=(237,231,251); CREAM_DIM=(179,166,210)

def _interp(stops,t):
    for i in range(len(stops)-1):
        p0,c0=stops[i]; p1,c1=stops[i+1]
        if t<=p1:
            f=(t-p0)/(p1-p0) if p1>p0 else 0
            return tuple(int(c0[k]+(c1[k]-c0[k])*f) for k in range(3))
    return stops[-1][1]

def bg_site():
    # radial-gradient(120% 90% at 50% -10%, glow 0, night 45%, night2 100%)
    qw,qh=270,480; im=Image.new("RGB",(qw,qh)); px=im.load()
    cx,cy=0.5*qw,-0.10*qh; rx,ry=1.20*qw,0.90*qh
    stops=[(0.0,GLOW),(0.45,NIGHT),(1.0,NIGHT2)]
    for y in range(qh):
        for x in range(qw):
            d=math.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2)
            px[x,y]=_interp(stops,clamp(d))
    return im.resize((W,H),Image.BILINEAR).convert("RGBA")
BG=bg_site()

def para(img,spans,font,cx,ty,maxw,lg=1.28,op=255,soft=True,cream=CREAM):
    spans=[(t,(c if c else cream)) for t,c in spans]
    K.para(img,spans,font,cx,ty,maxw,line_gap=lg,soft=soft,opacity=op)

def pill(text,font,fg,bg,padx=42,pady=22,radius=None):
    d0=ImageDraw.Draw(Image.new("RGBA",(4,4))); tw=d0.textlength(text,font=font); a,de=font.getmetrics(); th=a+de
    w=int(tw+2*padx); h=int(th+2*pady); r=radius if radius else h//2
    im=Image.new("RGBA",(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,w,h],radius=r,fill=bg); d.text((padx,pady),text,font=font,fill=fg); return im

def pop(img,el,cx,cy,t,t0,dur=0.4):
    p=clamp((t-t0)/dur)
    if p<=0: return
    sc=0.7+0.3*eob(p); op=int(255*ease(min(1,p*1.4)))
    nw,nh=max(1,int(el.width*sc)),max(1,int(el.height*sc)); e=el.resize((nw,nh),Image.LANCZOS)
    if op<255: e.putalpha(e.getchannel("A").point(lambda v:int(v*op/255)))
    img.alpha_composite(e,(int(cx-nw/2),int(cy-nh/2)))

def feat_row(img,label,y,t,t0):
    op=int(255*ease(clamp((t-t0)/0.3)))
    if op<=0: return
    x=int(W*0.16); r=26
    d=ImageDraw.Draw(img); d.ellipse([x,y+6,x+2*r,y+6+2*r],fill=MINT)
    # check
    d.line([(x+r*0.55,y+6+r),(x+r*0.9,y+6+r*1.35),(x+r*1.5,y+6+r*0.6)],fill=NIGHT,width=7)
    layer=Image.new("RGBA",img.size,(0,0,0,0)); ImageDraw.Draw(layer).text((x+2*r+28,y),label,font=BODY(50),fill=CREAM+(op,))
    img.alpha_composite(layer)

# --------- scènes ---------
def s_hook(t):
    img=BG.copy()
    pop(img,pill("Avis · Abonnés · Fidélité",BODY(46),GOLD,SURFACE),W//2,int(H*0.16),t,0.0,0.4)
    op=int(255*ease(clamp((t-0.3)/0.45)))
    para(img,[("Le jeu qui transforme",None)],HEAD(80),W//2,int(H*0.30),int(W*0.86),op=op)
    para(img,[("vos clients en",None)],HEAD(80),W//2,int(H*0.39),int(W*0.86),op=op)
    op2=int(255*ease(clamp((t-0.6)/0.45)))
    if op2>0:
        f=HEAD(90); d=ImageDraw.Draw(img)
        parts=[("avis 5",GOLD),(" ",None),("★",None),(" & ",CREAM),("abonnés",VIOLET)]
        ss=int(72); w1=d.textlength("avis 5 ",font=f); w2=ss; w3=d.textlength(" & abonnés",font=f)
        total=w1+w2+w3; x0=int(W/2-total/2); by=int(H*0.50)
        lay=Image.new("RGBA",img.size,(0,0,0,0)); dl=ImageDraw.Draw(lay)
        dl.text((x0,by),"avis 5 ",font=f,fill=GOLD+(op2,))
        stx=int(x0+w1); a,de=f.getmetrics()
        st=star(ss,GOLD)
        if op2<255: st=st.copy(); st.putalpha(st.getchannel("A").point(lambda v:int(v*op2/255)))
        lay.alpha_composite(st,(stx,int(by+(a-ss)*0.6)))
        dl.text((x0+w1+w2,by)," & ",font=f,fill=CREAM+(op2,))
        dl.text((x0+w1+w2+d.textlength(" & ",font=f),by),"abonnés",font=f,fill=VIOLET+(op2,))
        img.alpha_composite(lay)
    return img

def s_feats(t):
    img=BG.copy()
    para(img,[("Simple, et sans appli :",None)],HEAD(58),W//2,int(H*0.14),int(W*0.86))
    feat_row(img,"Sans application",int(H*0.30),t,0.05)
    feat_row(img,"Installé en 2 minutes",int(H*0.44),t,0.35)
    feat_row(img,"14 jours d'essai gratuit",int(H*0.58),t,0.65)
    return img

def s_games(t):
    img=BG.copy()
    para(img,[("3 jeux, changez quand vous voulez",None)],HEAD(56),W//2,int(H*0.12),int(W*0.9))
    ws=520; ang=-(360*2.2*ease(clamp(t/0.7))+35); img.alpha_composite(wheel(ws,ang),((W-ws)//2,int(H*0.30)))
    op=int(255*ease(clamp((t-0.5)/0.4)))
    if op>0:
        for i,(ch,lbl,x) in enumerate([("🎡","Roue",0.20),("🎫","Grattage",0.44),("🎰","Machine",0.68)]):
            ic=emoji_img(ch,90)
            if op<255: ic=ic.copy(); ic.putalpha(ic.getchannel("A").point(lambda v:int(v*op/255)))
            img.alpha_composite(ic,(int(W*x),int(H*0.74)))
    return img

def s_cta(t):
    img=BG.copy(); a=ease(clamp(t/0.35)); d=ImageDraw.Draw(img)
    ls=150; logo=gift_logo(ls); wm=d.textlength("Kado",font=HEAD(130)); lx=int((W-(ls+24+wm))/2)
    img.alpha_composite(logo,(lx,int(H*0.16))); d.text((lx+ls+24,int(H*0.16)+14),"Kado",font=HEAD(130),fill=CREAM)
    para(img,[("Créez votre compte, ",None),("gratuitement.",GOLD)],HEAD(64),W//2,int(H*0.37),int(W*0.86))
    # bouton gold (style site)
    pulse=1+0.03*math.sin(t*2*math.pi*1.4); bw,bh=int(W*0.72*pulse),int(148*pulse); bx,by=(W-bw)//2,int(H*0.53)
    d.rounded_rectangle([bx,by,bx+bw,by+bh],radius=16,fill=GOLD)
    txt="Commentez DEMO"; tw=d.textlength(txt,font=HEAD(60)); d.text((W//2-tw/2,by+bh/2-44),txt,font=HEAD(60),fill=NIGHT)
    f=HEAD(52); t1="kado-app.fr"; d.text((W//2-d.textlength(t1,font=f)/2,int(H*0.72)),t1,font=f,fill=CREAM)
    f2=BODY(38); sub="essai gratuit 14 jours · sans carte bancaire"; d.text((W//2-d.textlength(sub,font=f2)/2,int(H*0.72)+70),sub,font=f2,fill=CREAM_DIM)
    if a<1: return Image.blend(BG.copy(),img,a)
    return img

TL=[(0,3.6,s_hook),(3.6,7.4,s_feats),(7.4,11.2,s_games),(11.2,15.0,s_cta)]
if __name__=="__main__":
    out="/tmp/claude-0/-home-user-kado/1bdcc5dd-53b3-5031-82ec-c2fcac50f53b/scratchpad/frames_reel17"
    n=render(TL,15.0,out); print("frames",n,"->",out)
