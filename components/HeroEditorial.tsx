import { ArrowUpRight, Play } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/Logo";

/**
 * Une affiche de comptoir dessinée en CSS, avec le vrai jeu au centre.
 * Elle reprend les codes d'une carte cadeau imprimée, sans banque de photos
 * ni visuel de stock : l'objet est propre à Kado.
 */
export default function HeroEditorial() {
  return (
    <section className="v-hero hero-editorial">
      <div className="hero-copy">
        <p className="hero-eyebrow">
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          Le petit jeu des commerces de quartier
        </p>
        <h1>
          Un petit jeu.
          <br />
          <em>Une vraie raison</em>
          <br />
          de revenir.
        </h1>
        <p className="v-lede">
          Un QR code sur le comptoir, quelques secondes de jeu, et un cadeau
          qui donne envie de repasser. Kado rend chaque visite un peu plus
          mémorable.
        </p>
        <div className="v-cta hero-actions">
          <a className="v-btn primary" href="/login?signup=1">
            Commencer l'essai gratuit <ArrowUpRight size={18} weight="bold" />
          </a>
          <a className="v-btn ghost" href="/cafe-lumiere">
            <Play size={16} weight="fill" /> Voir le jeu en vrai
          </a>
        </div>
        <div className="hero-footnote">
          <span className="hero-trial">14 jours offerts</span>
          <span className="hero-footnote-sep" aria-hidden="true">·</span>
          <span>Sans carte bancaire</span>
          <span className="hero-footnote-sep" aria-hidden="true">·</span>
          <span>Prêt en quelques minutes</span>
        </div>
      </div>

      <div className="hero-art" aria-hidden="true">
        <span className="hero-art-sun" aria-hidden="true" />
        <span className="hero-art-spark hero-art-spark-one" aria-hidden="true">✳</span>
        <span className="hero-art-spark hero-art-spark-two" aria-hidden="true">✴</span>

        <div className="hero-note hero-note-left">
          <span>On scanne</span>
          <b>On joue</b>
        </div>

        <article className="hero-game-card">
          <header className="hero-game-head">
            <Logo size={32} />
            <span className="hero-edition">ÉDITION COMPTOIR<br />PARIS · Nº 001</span>
          </header>
          <div className="hero-wheel" role="img" aria-label="Roue de jeu colorée">
            <span className="hero-wheel-pointer" aria-hidden="true" />
            <span className="hero-wheel-emoji one" aria-hidden="true">☕</span>
            <span className="hero-wheel-emoji two" aria-hidden="true">🎁</span>
            <span className="hero-wheel-emoji three" aria-hidden="true">🍰</span>
            <span className="hero-wheel-emoji four" aria-hidden="true">✨</span>
            <span className="hero-wheel-center" aria-hidden="true">K</span>
          </div>
          <div className="hero-game-caption">
            <span className="hero-caption-overline">LE TICKET DU JOUR</span>
            <strong>À vous la chance.</strong>
            <span>Un petit cadeau, juste là.</span>
          </div>
          <div className="hero-game-action" aria-hidden="true">
            <span>Tourner la roue</span><span>↗</span>
          </div>
        </article>

        <div className="hero-ticket">
          <span className="hero-ticket-icon" aria-hidden="true">✳</span>
          <span>À garder près de soi<br /><b>et à faire tourner.</b></span>
        </div>
      </div>
    </section>
  );
}
