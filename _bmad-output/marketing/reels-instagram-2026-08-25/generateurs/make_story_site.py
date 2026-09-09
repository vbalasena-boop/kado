# -*- coding: utf-8 -*-
"""Story « Créez votre roue → 1 mois offert » — charte kado-app.fr.
Zones sûres Instagram : rien d'important dans les 250 px haut/bas (UI + sticker lien)."""
import os, math
from PIL import Image, ImageDraw
import kado_reels_lib as K
from kado_reels_lib import W,H,ease,clamp,wheel,gift_logo,render
from make_reel_site import BG,HEAD,BODY,GOLD,CORAL,MINT,VIOLET,CREAM,CREAM_DIM,NIGHT,SURFACE,para,pill,pop,star

DUR=7.0
def s_story(p):
    t=p*DUR  # render() passe un temps normalisé 0..1 → secondes
    img=BG.copy(); d=ImageDraw.Draw(img)
    # badge offre
    pop(img,pill("Offre de lancement",BODY(44),NIGHT,CORAL),W//2,int(H*0.17),t,0.0,0.4)
    op=int(255*ease(clamp((t-0.3)/0.45)))
    para(img,[("Créez votre roue",None)],HEAD(84),W//2,int(H*0.24),int(W*0.88),op=op)
    para(img,[("en ",None),("2 minutes",GOLD)],HEAD(84),W//2,int(H*0.315),int(W*0.88),op=op)
    # roue
    ws=560; ang=-(360*2.4*ease(clamp((t-0.5)/1.6))+35)
    sc=0.7+0.3*ease(clamp((t-0.4)/0.4))
    w=wheel(ws,ang); nw=max(1,int(ws*sc)); w=w.resize((nw,nw),Image.LANCZOS)
    img.alpha_composite(w,((W-nw)//2,int(H*0.55)-nw//2))
    # récompense
    op2=int(255*ease(clamp((t-2.2)/0.45)))
    if op2>0:
        f=HEAD(96); txt="1 mois offert"; tw=d.textlength(txt,font=f)
        lay=Image.new("RGBA",img.size,(0,0,0,0)); dl=ImageDraw.Draw(lay)
        dl.text((W//2-tw/2,int(H*0.735)),txt,font=f,fill=GOLD+(op2,))
        img.alpha_composite(lay)
        para(img,[("Répondez ",None),("DEMO",GOLD),(" à cette story",None)],BODY(44),W//2,int(H*0.815),int(W*0.9),op=op2)
    return img

TL=[(0,DUR,s_story)]
if __name__=="__main__":
    SC="/tmp/claude-0/-home-user-kado/1bdcc5dd-53b3-5031-82ec-c2fcac50f53b/scratchpad"
    out=os.path.join(SC,"frames_story"); n=render(TL,DUR,out); print("frames",n)
    s_story(1.0).convert("RGB").save(os.path.join(SC,"story-site-image.jpg"),quality=93); print("image OK")
