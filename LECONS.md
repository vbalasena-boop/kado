# Leçons (alimenté par les agents en fin de tâche)

Format : `date — sujet — ce qui a marché / piège / décision` (3 lignes max par entrée).


2026-10-21 — audit SEO vitrine — l'ancien message « avis Google » survivait dans le corps de page, le JSON-LD, le blog et /tarifs, pas dans layout/og.
2026-10-21 — piège — `publicMetadata` n'avait pas d'image og/twitter ; `lastModified: now` du sitemap changeait à chaque build. Corrigé en 13-8 (dates fixes). Un worktree `codex-session.sh` part de HEAD : commiter la fiche avant de lancer.
2026-10-21 — décision — un changement de positionnement se fait en une passe : grep « avis » dans app/, lib/blog et JSON-LD avant de clore la story métadonnées.
