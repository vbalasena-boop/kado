# Roadmap d'améliorations — Kado

> Document produit selon la **BMAD Method** · Rôles : **Analyste + PM** · v0.1 · 2026-08-14

Analyse du produit **en production** et backlog d'améliorations priorisé
(valeur business × effort). Objectif : décider la prochaine étape.

---

## État actuel (livré ✅)

- Jeu public (roue, 2 tours, anti-triche serveur, plafond de cadeaux/jour)
- Thème par commerce (couleurs, logo, image de fond), mode test illimité
- Espace commerçant (éditeur de roue, QR, stats, uploads)
- Espace admin (créer/supprimer, suspendre, abonnement essai/+1/+6 mois, expiration auto)
- Connexion par code (OTP) + e-mails Resend
- Design : back-office Material (Google), page de jeu premium
- Hébergement gratuit Vercel + Supabase

---

## Backlog priorisé

Légende — Valeur : 🟢 forte / 🟡 moyenne. Effort : ● petit / ●● moyen / ●●● gros.

### 💳 Monétisation
| # | Amélioration | Valeur | Effort |
|---|---|---|---|
| M1 | **Stripe** : abonnement self-service, encaissement auto, suspension si non-payé | 🟢 | ●●● |
| M2 | Page **Tarifs / plans** (mensuel, annuel) | 🟢 | ● |
| M3 | Relance auto **avant expiration** (e-mail au commerçant) | 🟢 | ●● |

### 🎁 Anti-fraude & valeur terrain
| # | Amélioration | Valeur | Effort |
|---|---|---|---|
| F1 | **Validation des cadeaux en caisse** : marquer un code « utilisé » (page staff / scan) pour éviter la réutilisation des captures d'écran | 🟢 | ●● |
| F2 | Expiration des codes cadeaux (ex. 30 j) affichée et vérifiée | 🟡 | ● |
| F3 | Verrou joueur plus robuste (au-delà du cookie) | 🟡 | ●● |

### 📈 Croissance & données
| # | Amélioration | Valeur | Effort |
|---|---|---|---|
| G1 | **Capture d'e-mail / téléphone opt-in** avant le tour → le commerçant se constitue une base clients (RGPD) | 🟢 | ●● |
| G2 | **Site vitrine Kado** pour vendre le produit aux commerces | 🟢 | ●● |
| G3 | Onboarding guidé du commerçant (checklist 1re config) | 🟡 | ●● |
| G4 | Analytics avancées (entonnoir scans→jeux→avis, courbes, export CSV) | 🟡 | ●● |

### 🔒 Sécurité & conformité
| # | Amélioration | Valeur | Effort |
|---|---|---|---|
| S1 | **Durcir la sécurité base** : aujourd'hui la lecture publique est ouverte (les codes cadeaux sont lisibles via la clé publique). Repasser les lectures/écritures sensibles côté serveur uniquement | 🟢 | ●● |
| S2 | **Anti-abus /api/play** (limite de requêtes, protection bot) | 🟡 | ● |
| S3 | **RGPD** : bandeau cookies, mentions légales, CGU, politique de confidentialité, règlement du jeu | 🟢 | ●● |

### ✨ Produit & expérience
| # | Amélioration | Valeur | Effort |
|---|---|---|---|
| P1 | **QR code stylé** (logo au centre, couleurs de marque) | 🟡 | ● |
| P2 | Nouveaux formats de jeu (carte à gratter, boîte mystère) | 🟡 | ●●● |
| P3 | Canaux supplémentaires (TripAdvisor, TikTok, Facebook…) | 🟡 | ● |
| P4 | Multi-langues de la page de jeu | 🟡 | ●● |
| P5 | Envoi du cadeau par e-mail/SMS au joueur | 🟡 | ●● |
| P6 | **Domaine + SMTP vérifié** : e-mails de connexion à tous les commerçants (pas seulement toi) | 🟢 | ● |

---

## Épics recommandés (regroupement)

- **Épic A — Encaisser (Stripe)** : M1 + M2 + M3. *Passe le produit de « gratuit » à « revenus ».*
- **Épic B — Anti-fraude terrain** : F1 + F2 + P1. *Crédibilité en boutique, valeur perçue.*
- **Épic C — Croissance & base clients** : G1 + G2. *Acquisition + rétention.*
- **Épic D — Sécurité & conformité** : S1 + S3 + P6. *Indispensable avant de vendre largement (RGPD + fuite de codes).*

## Recommandation BMAD

Ordre conseillé, du plus structurant au moins urgent :

1. **Épic D (Sécurité & conformité)** — à faire **avant** d'avoir beaucoup de clients : corrige la lecture publique trop ouverte, ajoute le cadre légal (RGPD), fiabilise les e-mails. *C'est la fondation d'un produit vendable sérieusement.*
2. **Épic A (Stripe)** — pour encaisser automatiquement.
3. **Épic B (Anti-fraude)** — pour la valeur terrain (validation des cadeaux).
4. **Épic C (Croissance)** — quand le socle est prêt.

> Prochaine étape : choisir un épic → passage en mode **PM (stories détaillées)** puis **Dev**.
