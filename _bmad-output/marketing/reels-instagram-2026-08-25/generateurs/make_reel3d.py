# -*- coding: utf-8 -*-
"""Réel 13 « 3D » : roue Three.js (frames PNG) + texte de marque + CTA orange."""
import os
from PIL import Image
from kado_reels_lib import *

SC="/tmp/claude-0/-home-user-kado/1bdcc5dd-53b3-5031-82ec-c2fcac50f53b/scratchpad"
FR3D=os.path.join(SC,"3d","frames")
OUT=os.path.join(SC,"frames_reel13"); os.makedirs(OUT,exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".jpg"): os.remove(os.path.join(OUT,f))

FPS=30
N3D=len(sorted(f for f in os.listdir(FR3D) if f.endswith(".png")))
DUR3D=N3D/FPS
CTA_DUR=3.6
NCTA=int(CTA_DUR*FPS)

def band(img, spans, font, yf, opacity):
    if opacity<=0: return
    para(img, spans, font, W//2, int(H*yf), int(W*0.9), opacity=opacity)

def overlay(img, sec):
    # haut : hook (0.2-3.4)
    op=int(255*(ease(clamp((sec-0.2)/0.4)) * (1-ease(clamp((sec-2.9)/0.5)))))
    band(img,[("La roue qui transforme",WHITE)],BOLD(66),0.06,op)
    band(img,[("vos clients en ",WHITE),("avis Google",GOLD)],BOLD(66),0.13,op)
    # bas : étapes (3.6-6.9)
    op2=int(255*(ease(clamp((sec-3.6)/0.4)) * (1-ease(clamp((sec-6.6)/0.5)))))
    band(img,[("Ils scannent, jouent, gagnent",WHITE)],BOLD(60),0.82,op2)
    # bas : avis (7.1-10.6)
    op3=int(255*(ease(clamp((sec-7.1)/0.4)) * (1-ease(clamp((sec-10.4)/0.6)))))
    band(img,[("…et l'avis Google vient ",WHITE),("tout seul.",GOLD)],BOLD(58),0.82,op3)

print(f"3D frames: {N3D} ({DUR3D:.1f}s) + CTA {NCTA}")
idx=0
for i in range(N3D):
    sec=i/FPS
    img=Image.open(os.path.join(FR3D,f"w_{i:04d}.png")).convert("RGBA")
    overlay(img,sec)
    img.convert("RGB").save(os.path.join(OUT,f"f_{idx:04d}.jpg"),quality=92); idx+=1
# CTA orange (2D)
for j in range(NCTA):
    t=j/(NCTA-1)
    img=cta(t,"La roue qui rapporte des avis",q="Vous en êtes à combien ?").convert("RGB")
    img.save(os.path.join(OUT,f"f_{idx:04d}.jpg"),quality=92); idx+=1
print("TOTAL frames:",idx,"->",OUT)
