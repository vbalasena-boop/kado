# -*- coding: utf-8 -*-
"""Réel 16 « Complet 44€ » — cinématographique (3D + vignette/grain/letterbox + reveal)."""
import os
from PIL import Image, ImageDraw, ImageChops
from kado_reels_lib import *

SC="/tmp/claude-0/-home-user-kado/1bdcc5dd-53b3-5031-82ec-c2fcac50f53b/scratchpad"
FR=os.path.join(SC,"3d","frames_cine")
OUT=os.path.join(SC,"frames_reel16"); os.makedirs(OUT,exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".jpg"): os.remove(os.path.join(OUT,f))
FPS=30

# --- effets ciné pré-calculés ---
BAR=int(H*0.065)  # bandes noires
# vignette (masque radial sombre)
_vig=Image.new("L",(W,H),0); dv=ImageDraw.Draw(_vig)
for i in range(60):
    a=int(150*(i/60)**2); m=int(i/60* (W*0.9))
    dv.ellipse([ -m, -m, W+m, H+m], outline=a)
_vig=_vig.filter(ImageFilter.GaussianBlur(120))
VIG=Image.merge("RGBA",(Image.new("L",(W,H),0),)*3+(_vig,))  # noir avec alpha vignette

def cine(img, sec):
    # vignette
    img.alpha_composite(VIG)
    # grain film léger (subtil, préserve la compression)
    noise=Image.effect_noise((W//3,H//3), 16).resize((W,H)).convert("L")
    base=img.convert("RGB")
    img=Image.blend(base, ImageChops.overlay(base, Image.merge("RGB",(noise,)*3)), 0.06).convert("RGBA")
    # bandes ciné
    d=ImageDraw.Draw(img); d.rectangle([0,0,W,BAR],fill=(0,0,0,255)); d.rectangle([0,H-BAR,W,H],fill=(0,0,0,255))
    return img

def band(img,spans,font,yf,op,soft=True):
    if op>0: para(img,spans,font,W//2,int(H*yf),int(W*0.9),opacity=op,soft=soft)

def overlay(img,sec):
    # haut : accroche (0.3-3.2)
    op=int(255*(ease(clamp((sec-0.3)/0.4))*(1-ease(clamp((sec-2.8)/0.5)))))
    band(img,[("Jeux ",WHITE),("+",GOLD),(" Fidélité,",WHITE)],BOLD(64),0.11,op)
    band(img,[("réunis.",GOLD)],BOLD(64),0.175,op)
    # reveal prix (4.6-fin) — pill + COMPLET + 44€
    r=ease(clamp((sec-4.6)/0.5))
    if r>0:
        opr=int(255*r)
        p=pill("LE PLUS POPULAIRE",BODYB(40),NAVY,GOLD)
        if opr<255: p=p.copy(); p.putalpha(p.getchannel("A").point(lambda v:int(v*opr/255)))
        img.alpha_composite(p,((W-p.width)//2,int(H*0.66)))
        band(img,[("COMPLET",WHITE)],BOLD(96),0.72,opr)
        band(img,[("44 €",GOLD),("/mois",WHITE)],BOLD(84),0.80,opr)

def frame(img,sec):
    img=cine(img,sec); overlay(img,sec); return img

N3D=len(sorted(f for f in os.listdir(FR) if f.endswith(".png")))
print("cine 3D frames:",N3D)
idx=0
for i in range(N3D):
    sec=i/FPS
    im=Image.open(os.path.join(FR,f"w_{i:04d}.png")).convert("RGBA")
    frame(im,sec).convert("RGB").save(os.path.join(OUT,f"f_{idx:04d}.jpg"),quality=92); idx+=1
# CTA orange (2D) ~3.4s
NCTA=int(3.4*FPS)
for j in range(NCTA):
    t=j/(NCTA-1)
    cta(t,"Jeux + Fidélité = Complet",btn="Commentez DEMO",sub="44 €/mois · essai 14 jours").convert("RGB").save(os.path.join(OUT,f"f_{idx:04d}.jpg"),quality=92); idx+=1
print("TOTAL:",idx,"->",OUT)
