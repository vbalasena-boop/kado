# La Table d'Alice — Automatisation Kizomba x Meta

Kit **n8n** pour convertir gratuitement les prospects venus des pubs **Meta (Facebook/Instagram)** en élèves de **cours de Kizomba**.

## Contenu

- 📘 **[docs/guide-n8n-meta-kizomba.md](docs/guide-n8n-meta-kizomba.md)** — le guide complet, pas à pas, en français (installation gratuite de n8n, connexion Meta Lead Ads, configuration).
- ⚙️ **[workflows/meta-kizomba-lead-conversion.json](workflows/meta-kizomba-lead-conversion.json)** — le workflow n8n prêt à importer.

## Démarrage rapide

1. Installe n8n gratuitement (voir le guide, section 1).
2. Dans n8n : **Import from File** → `workflows/meta-kizomba-lead-conversion.json`.
3. Remplace les valeurs `REMPLACE_PAR_...` (Google Sheets, SMTP, Telegram, lien de réservation).
4. Active le workflow. ✅

## Ce que fait le workflow

Nouveau prospect Meta → enregistré dans Google Sheets → email de bienvenue instantané avec lien de réservation → alerte Telegram à l'équipe (rappel sous 5 min) → relance automatique à J+2.

**Coût total : ≈ 0 €** (hors budget publicitaire Meta).
