# -*- coding: utf-8 -*-
"""Réels Kado 2 à 6 — même template/police que le Réel 1, méthode BMAD."""
import sys, math
from kado_reels_lib import *

# helper générique : écran texte (chaque bloc apparaît à son t0)
def text_scene(t, blocks, cy=None):
    img=bg_violet(cy)
    for spans,font,yf,t0 in blocks:
        op=int(255*ease(clamp((t-t0)/0.4)))
        if op>0: para(img,spans,font,W//2,int(H*yf),int(W*0.86),opacity=op)
    return img

# COLD OPEN : chiffre/mot choc dès la 1re seconde (retient avant le décrochage)
def cold(t, big_spans, sub=None):
    img=bg_violet()
    op=int(255*ease(clamp(t/0.12)))          # apparition quasi instantanée
    para(img, big_spans, BOLD(150), W//2, int(H*0.34), int(W*0.92), opacity=op)
    if sub:
        op2=int(255*ease(clamp((t-0.12)/0.2)))
        if op2>0: para(img,[(sub,WHITE)],BOLD(56),W//2,int(H*0.56),int(W*0.86),opacity=op2)
    return img
def _co(big,sub): return lambda t: cold(t,big,sub)
COLD={
 'reel2':_co([("+44 avis.",GOLD)],"Sans rien demander."),
 'reel3':_co([("29 €/mois",GOLD)],"= 1,5 client. C'est tout."),
 'reel4':_co([("Légal ?",GOLD)],"Récompenser un avis Google…"),
 'reel5':_co([("30 secondes.",GOLD)],"C'est tout ce que ça prend."),
 'reel7':_co([("La rentrée.",GOLD)],"Le moment pour vos avis."),
 'reel8':_co([("1er mois ",WHITE),("OFFERT",GOLD)],"Offre de lancement"),
 'reel9':_co([("Vous perdez",WHITE),(" des clients",GOLD)],"…et vous ne le voyez pas."),
 'reel10':_co([("x2 d'avis.",GOLD)],"0 € de pub."),
}
CO_DUR=0.9  # durée de base (x SCALE ensuite)
def with_cold(name,TL):
    if name not in COLD: return TL
    return [(0,CO_DUR,COLD[name])]+[(a+CO_DUR,b+CO_DUR,f) for a,b,f in TL]

# =================== RÉEL 2 — 3 avis -> 47 avis ===================
def r2_hook(t):
    img=text_scene(t,[([("De 3 avis à 47 avis",WHITE)],BOLD(90),0.30,0.0),
                      ([("en 6 semaines.",GOLD)],BOLD(90),0.44,0.35)])
    emoji_pop(img,"🤯",W//2,int(H*0.62),150,t,0.6); return img
def r2_card(t):
    img=bg_violet(int(H*0.40))
    para(img,[("Sans rien demander :",WHITE)],BOLD(60),W//2,int(H*0.16),int(W*0.85))
    cw=int(W*0.82); cnt=int(3+44*ease(clamp((t-0.1)/0.55)))
    img.alpha_composite(google_card(cw,"Votre commerce",5,f"{cnt} avis",GREEN),((W-cw)//2,int(H*0.34)))
    pop(img,pill("+44 avis en 6 semaines",BOLD(50),WHITE,GREEN),W//2,int(H*0.60),t,0.55)
    return img
def r2_secret(t):
    return text_scene(t,[([("Le secret ?",WHITE)],BOLD(84),0.30,0.0),
                         ([("On a arrêté de ",WHITE),("demander.",PINK)],BOLD(72),0.46,0.4),
                         ([("On a fait ",WHITE),("jouer.",GOLD)],BOLD(80),0.60,0.8)])
def r2_wheel(t):
    img=bg_violet()
    para(img,[("QR → roue → cadeau → avis.",WHITE)],BOLD(64),W//2,int(H*0.14),int(W*0.86))
    ws=560; ang=-(360*2.3*ease(clamp(t/0.7))+35); img.alpha_composite(wheel(ws,ang),((W-ws)//2,int(H*0.30)))
    op=int(255*ease(clamp((t-0.55)/0.4)))
    if op>0: para(img,[("Automatique.",GOLD)],BOLD(72),W//2,int(H*0.80),int(W*0.86),opacity=op)
    return img
REEL2=[(0,2.2,r2_hook),(2.2,6.2,r2_card),(6.2,9.4,r2_secret),(9.4,12.7,r2_wheel),
       (12.7,15.0,lambda t: cta(t,"Chaque client = une chance d'avis",q="Combien d'avis vous avez ?"))]

# =================== RÉEL 3 — le calcul 29 € ===================
def r3_hook(t):
    img=text_scene(t,[([("« 29 €/mois ?",WHITE)],BOLD(84),0.28,0.0),
                      ([("C'est cher. »",WHITE)],BOLD(84),0.40,0.25),
                      ([("Vraiment ?",GOLD)],BOLD(96),0.56,0.6)])
    emoji_pop(img,"🧮",W//2,int(H*0.74),140,t,0.7); return img
def r3_calc(t):
    img=bg_violet(int(H*0.4))
    para(img,[("Panier moyen ",WHITE),("20 €",GOLD)],BOLD(80),W//2,int(H*0.22),int(W*0.86))
    op=int(255*ease(clamp((t-0.3)/0.4)))
    if op>0: para(img,[("Il vous faut",WHITE)],BOLD(60),W//2,int(H*0.40),int(W*0.86),opacity=op)
    pop(img,pill("1,5 client de plus / mois",BOLD(56),NAVY,GOLD),W//2,int(H*0.52),t,0.45)
    op2=int(255*ease(clamp((t-0.7)/0.4)))
    if op2>0: para(img,[("…pour être rentable.",WHITE)],BOLD(56),W//2,int(H*0.62),int(W*0.86),opacity=op2)
    return img
def r3_more(t):
    return text_scene(t,[([("Un seul nouvel ",WHITE),("avis",GOLD)],BOLD(80),0.34,0.0),
                         ([("vous en ramène bien plus.",WHITE)],BOLD(64),0.50,0.4)])
def r3_punch(t):
    img=text_scene(t,[([("Kado ne vous ",WHITE),("coûte",RED),(" pas.",WHITE)],BOLD(80),0.34,0.0),
                      ([("Il vous ",WHITE),("rapporte.",GREEN)],BOLD(88),0.50,0.45)])
    emoji_pop(img,"💰",W//2,int(H*0.70),140,t,0.7); return img
REEL3=[(0,2.4,r3_hook),(2.4,6.4,r3_calc),(6.4,9.4,r3_more),(9.4,12.7,r3_punch),
       (12.7,15.0,lambda t: cta(t,"Rentable dès le 1er mois",q="Votre panier moyen ?"))]

# =================== RÉEL 4 — conformité ===================
def r4_hook(t):
    img=text_scene(t,[([("« Payer pour des avis,",WHITE)],BOLD(70),0.28,0.0),
                      ([("c'est interdit. »",WHITE)],BOLD(70),0.40,0.25),
                      ([("Exact.",GOLD)],BOLD(100),0.56,0.6)])
    emoji_pop(img,"🚫",W//2,int(H*0.74),140,t,0.7); return img
def r4_not(t):
    img=text_scene(t,[([("Kado ne récompense ",WHITE),("PAS",RED)],BOLD(76),0.36,0.0),
                      ([("un 5 étoiles.",WHITE)],BOLD(76),0.52,0.4)])
    return img
def r4_yes(t):
    img=text_scene(t,[([("On récompense le ",WHITE),("geste.",GOLD)],BOLD(76),0.32,0.0),
                      ([("Pas la note.",WHITE)],BOLD(72),0.48,0.4)])
    emoji_pop(img,"✅",W//2,int(H*0.66),150,t,0.7); return img
def r4_real(t):
    img=bg_violet()
    para(img,[("Vos vrais clients,",WHITE)],BOLD(76),W//2,int(H*0.16),int(W*0.86))
    para(img,[("vos vrais avis.",GOLD)],BOLD(76),W//2,int(H*0.26),int(W*0.86))
    pop(img,review_card(int(W*0.78)),W//2,int(H*0.52),t,0.4)
    op=int(255*ease(clamp((t-0.7)/0.3)))
    if op>0: para(img,[("100 % conforme Google.",WHITE)],BODYB(50),W//2,int(H*0.72),int(W*0.86),opacity=op)
    return img
REEL4=[(0,2.4,r4_hook),(2.4,5.8,r4_not),(5.8,9.2,r4_yes),(9.2,12.7,r4_real),
       (12.7,15.0,lambda t: cta(t,"100 % conforme Google",q="Une question ? Posez-la"))]

# =================== RÉEL 5 — parcours 30 s ===================
def r5_hook(t):
    return text_scene(t,[([("Ce que fait un client",WHITE)],BOLD(80),0.34,0.0),
                         ([("en 30 secondes 👇",GOLD)],BOLD(80),0.50,0.4)]) if False else \
           _r5_hook(t)
def _r5_hook(t):
    img=text_scene(t,[([("Ce que fait un client",WHITE)],BOLD(80),0.32,0.0),
                      ([("en 30 secondes",GOLD)],BOLD(84),0.48,0.4)])
    emoji_pop(img,"👇",W//2,int(H*0.64),130,t,0.7); return img
def r5_scan(t):
    img=bg_violet()
    para(img,[("1. Il ",WHITE),("scanne",GOLD)],BOLD(80),W//2,int(H*0.16),int(W*0.86))
    pop(img,qr_img("https://www.kado-app.fr",520),W//2,int(H*0.52),t,0.2)
    op=int(255*ease(clamp((t-0.6)/0.4)))
    if op>0: para(img,[("le QR sur la table",WHITE)],BODYB(48),W//2,int(H*0.82),int(W*0.86),opacity=op)
    return img
def r5_play(t):
    img=bg_violet()
    para(img,[("2. Il ",WHITE),("joue",GOLD)],BOLD(80),W//2,int(H*0.16),int(W*0.86))
    ws=560; ang=-(360*2.4*ease(clamp(t/0.85))+35); img.alpha_composite(wheel(ws,ang),((W-ws)//2,int(H*0.34)))
    return img
def r5_win(t):
    img=bg_violet()
    para(img,[("3. Il ",WHITE),("gagne",GOLD)],BOLD(80),W//2,int(H*0.10),int(W*0.86))
    pop(img,win_card(int(W*0.72)),W//2,int(H*0.55),t,0.15)
    return img
def r5_and(t):
    img=text_scene(t,[([("…et il a laissé un ",WHITE),("avis Google.",GOLD)],BOLD(72),0.40,0.0)])
    return img
REEL5=[(0,2.0,_r5_hook),(2.0,5.4,r5_scan),(5.4,8.4,r5_play),(8.4,11.6,r5_win),
       (11.6,13.2,r5_and),(13.2,15.0,lambda t: cta(t,"Sans que vous demandiez",q="Vous le mettriez où ?"))]

# =================== RÉEL 6 — 1 par rue (rareté) ===================
def r6_hook(t):
    img=text_scene(t,[([("Je ne prends qu'",WHITE),("UN",GOLD)],BOLD(88),0.30,0.0),
                      ([("commerce par rue.",WHITE)],BOLD(72),0.46,0.4)])
    emoji_pop(img,"🚧",W//2,int(H*0.64),140,t,0.7); return img
def r6_edge(t):
    return text_scene(t,[([("Kado, c'est une",WHITE)],BOLD(76),0.32,0.0),
                         ([("longueur d'avance",GOLD)],BOLD(80),0.46,0.35),
                         ([("sur Google.",WHITE)],BOLD(76),0.60,0.7)])
def r6_gap(t):
    img=bg_violet(int(H*0.4))
    para(img,[("Si votre voisin s'y met avant vous…",WHITE)],BOLD(58),W//2,int(H*0.16),int(W*0.85))
    cw=int(W*0.82)
    img.alpha_composite(google_card(cw,"Le Voisin",5,f"{int(150+150*ease(clamp((t-0.1)/0.6)))} avis",GREEN),((W-cw)//2,int(H*0.32)))
    a2=ease(clamp((t-0.2)/0.4))
    if a2>0: img.alpha_composite(google_card(cw,"Vous",5,"12 avis",RED),((W-cw)//2,int(H*0.54)))
    pop(img,pill("l'écart se creuse tout seul",BOLD(48),WHITE,RED),W//2,int(H*0.76),t,0.6)
    return img
def r6_first(t):
    img=text_scene(t,[([("Le premier de la rue",WHITE)],BOLD(76),0.34,0.0),
                      ([("qui dégaine ",WHITE),("gagne.",GOLD)],BOLD(80),0.50,0.4)])
    return img
REEL6=[(0,2.4,r6_hook),(2.4,5.8,r6_edge),(5.8,9.6,r6_gap),(9.6,12.7,r6_first),
       (12.7,15.0,lambda t: cta(t,"C'est vous ?"))]

# =================== RÉEL 7 — Rentrée (saisonnier) ===================
def r7_hook(t):
    img=text_scene(t,[([("La rentrée,",WHITE)],BOLD(90),0.28,0.0),
                      ([("vos clients reviennent.",WHITE)],BOLD(72),0.44,0.35),
                      ([("Le moment parfait.",GOLD)],BOLD(80),0.60,0.7)])
    emoji_pop(img,"🍂",W//2,int(H*0.80),130,t,0.8); return img
def r7_each(t):
    img=bg_violet()
    para(img,[("Chaque client de septembre",WHITE)],BOLD(60),W//2,int(H*0.12),int(W*0.88))
    para(img,[("= un avis en plus.",GOLD)],BOLD(64),W//2,int(H*0.20),int(W*0.88))
    ws=560; ang=-(360*2.3*ease(clamp(t/0.7))+35); img.alpha_composite(wheel(ws,ang),((W-ws)//2,int(H*0.34)))
    return img
def r7_ahead(t):
    img=bg_violet(int(H*0.40))
    para(img,[("Pendant que vos concurrents attendent…",WHITE)],BOLD(54),W//2,int(H*0.16),int(W*0.86))
    cw=int(W*0.82); cnt=int(12+48*ease(clamp((t-0.1)/0.55)))
    img.alpha_composite(google_card(cw,"Votre commerce",5,f"{cnt} avis",GREEN),((W-cw)//2,int(H*0.34)))
    pop(img,pill("vous prenez de l'avance",BOLD(50),NAVY,GOLD),W//2,int(H*0.60),t,0.55)
    return img
def r7_now(t):
    return text_scene(t,[([("Septembre se joue",WHITE)],BOLD(80),0.34,0.0),
                         ([("maintenant.",GOLD)],BOLD(96),0.50,0.4)])
REEL7=[(0,2.4,r7_hook),(2.4,6.0,r7_each),(6.0,9.6,r7_ahead),(9.6,12.7,r7_now),
       (12.7,15.0,lambda t: cta(t,"Lancez la rentrée avec Kado",q="Votre objectif rentrée ?"))]

# =================== RÉEL 8 — Offre « 1er mois offert » ===================
def r8_hook(t):
    return text_scene(t,[([("Créez votre roue Kado",WHITE)],BOLD(76),0.32,0.0),
                         ([("en 5 minutes.",GOLD)],BOLD(80),0.48,0.4)])
def r8_wheel(t):
    img=bg_violet()
    para(img,[("Vos clients scannent, jouent,",WHITE)],BOLD(52),W//2,int(H*0.13),int(W*0.88))
    para(img,[("et laissent un avis.",GOLD)],BOLD(58),W//2,int(H*0.20),int(W*0.88))
    ws=560; ang=-(360*2.3*ease(clamp(t/0.7))+35); img.alpha_composite(wheel(ws,ang),((W-ws)//2,int(H*0.34)))
    return img
def r8_scar(t):
    img=text_scene(t,[([("Offre de ",WHITE),("lancement",GOLD)],BOLD(80),0.30,0.0)])
    pop(img,pill("réservée aux 10 premiers",BOLD(50),NAVY,GOLD),W//2,int(H*0.50),t,0.4)
    op=int(255*ease(clamp((t-0.6)/0.35)))
    if op>0: para(img,[("1 mois offert pour tout tester.",WHITE)],BOLD(52),W//2,int(H*0.62),int(W*0.86),opacity=op)
    return img
REEL8=[(0,2.4,r8_hook),(2.4,6.0,r8_wheel),(6.0,10.0,r8_scar),
       (10.0,14.0,lambda t: cta(t,"Offre de lancement · 1er mois offert",btn="Commentez OFFRE",sub="offre de lancement · sans carte bancaire"))]

# =================== RÉEL 9 — « Vous perdez des clients » (douleur) ===================
def r9_hook(t):
    return text_scene(t,[([("Un client sur deux",WHITE)],BOLD(78),0.30,0.0),
                         ([("vérifie Google avant de venir.",GOLD)],BOLD(60),0.46,0.4)])
def r9_cards(t):
    img=bg_violet(int(H*0.40))
    para(img,[("Et il choisit le mieux noté :",WHITE)],BOLD(56),W//2,int(H*0.15),int(W*0.85))
    cw=int(W*0.82); a1=ease(clamp(t/0.4))
    c1=google_card(cw,"Le Voisin",5,"312 avis",GREEN); x1=int(lerp((-cw,0,0),((W-cw)//2,0,0),a1)[0])
    img.alpha_composite(c1,(x1,int(H*0.27)))
    a2=ease(clamp((t-0.22)/0.4))
    if a2>0:
        c2=google_card(cw,"Vous",5,"3 avis",RED); x2=int(lerp((W,0,0),((W-cw)//2,0,0),a2)[0])
        img.alpha_composite(c2,(x2,int(H*0.49)))
    pop(img,pill("il prend VOS clients",BOLD(52),WHITE,RED),W//2,int(H*0.70),t,0.55)
    return img
def r9_fix(t):
    img=bg_violet()
    para(img,[("Kado inverse la tendance.",WHITE)],BOLD(70),W//2,int(H*0.13),int(W*0.88))
    ws=560; ang=-(360*2.3*ease(clamp(t/0.7))+35); img.alpha_composite(wheel(ws,ang),((W-ws)//2,int(H*0.34)))
    pop(img,review_card(int(W*0.78)),W//2,int(H*0.80),t,0.6)
    return img
REEL9=[(0,2.4,r9_hook),(2.4,6.6,r9_cards),(6.6,10.2,r9_fix),
       (10.2,14.0,lambda t: cta(t,"Reprenez vos clients",q="Combien d'avis vous avez ?"))]

# =================== RÉEL 10 — « x2 d'avis sans pub » (preuve/curiosité) ===================
def r10_hook(t):
    return text_scene(t,[([("Doubler vos avis Google",WHITE)],BOLD(70),0.30,0.0),
                         ([("sans 1 € de pub ?",GOLD)],BOLD(74),0.46,0.4)])
def r10_count(t):
    img=bg_violet(int(H*0.40))
    para(img,[("Ce commerce l'a fait :",WHITE)],BOLD(58),W//2,int(H*0.16),int(W*0.85))
    cw=int(W*0.82); cnt=int(38+42*ease(clamp((t-0.1)/0.55)))
    img.alpha_composite(google_card(cw,"Votre commerce",5,f"{cnt} avis",GREEN),((W-cw)//2,int(H*0.34)))
    pop(img,pill("x2 sans pub, sans effort",BOLD(50),NAVY,GOLD),W//2,int(H*0.60),t,0.55)
    return img
def r10_how(t):
    img=bg_violet()
    para(img,[("Le secret : un QR + une roue.",WHITE)],BOLD(60),W//2,int(H*0.13),int(W*0.88))
    ws=560; ang=-(360*2.3*ease(clamp(t/0.7))+35); img.alpha_composite(wheel(ws,ang),((W-ws)//2,int(H*0.34)))
    op=int(255*ease(clamp((t-0.55)/0.4)))
    if op>0: para(img,[("Vos clients jouent, l'avis vient tout seul.",WHITE)],BODYB(46),W//2,int(H*0.80),int(W*0.88),opacity=op)
    return img
REEL10=[(0,2.4,r10_hook),(2.4,6.4,r10_count),(6.4,10.0,r10_how),
        (10.0,14.0,lambda t: cta(t,"Doublez vos avis Google",q="Vous en êtes à combien ?"))]

_BASE={"reel2":REEL2,"reel3":REEL3,"reel4":REEL4,"reel5":REEL5,"reel6":REEL6,"reel7":REEL7,"reel8":REEL8,"reel9":REEL9,"reel10":REEL10}
REELS={n:with_cold(n,tl) for n,tl in _BASE.items()}

if __name__=="__main__":
    which=sys.argv[1:] or list(REELS.keys())
    SCALE=1.5   # laisse le temps de lire : ~15 s -> ~22,5 s
    for name in which:
        TL=[(a*SCALE,b*SCALE,fn) for a,b,fn in REELS[name]]
        total=max(b for _,b,_ in TL)
        print(f"→ {name} ({total:.1f}s) …", flush=True)
        n=render(TL,total,f"/tmp/claude-0/-home-user-kado/1bdcc5dd-53b3-5031-82ec-c2fcac50f53b/scratchpad/frames_{name}")
        print(f"   {n} frames OK")
    print("Terminé.")
