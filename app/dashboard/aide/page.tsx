export const dynamic = "force-dynamic";
export const metadata = { title: "Aide — Kado" };

type QA = { q: string; a: React.ReactNode };

const GUIDE: { t: string; items: QA[] }[] = [
  {
    t: "🚀 Démarrer",
    items: [
      {
        q: "Comment mettre Kado en place dans mon commerce ?",
        a: (
          <>
            Dans <b>Mon jeu</b>, choisissez vos cadeaux et vos couleurs, puis
            allez dans <b>QR code</b> : imprimez l'affiche et posez-la sur vos
            tables, votre comptoir ou votre vitrine. C'est prêt — vos clients
            scannent et jouent, sans aucune application à installer.
          </>
        ),
      },
      {
        q: "Comment tester avant de me lancer ?",
        a: (
          <>
            Cliquez sur <b>Tester mon jeu</b> (menu de gauche) : vous jouez en
            illimité, rien n'est enregistré. C'est exactement ce que verront
            vos clients.
          </>
        ),
      },
      {
        q: "Installer Kado sur mon téléphone",
        a: (
          <>
            Ouvrez <b>kado-app.fr</b> dans <b>Chrome</b> → menu ⋮ en haut à
            droite → <b>« Installer l'application »</b>. L'icône Kado apparaît
            sur votre écran d'accueil.
            <br />
            <i>
              Sur Samsung, utilisez bien Chrome (pas le navigateur Samsung) pour
              éviter un avertissement de sécurité.
            </i>
          </>
        ),
      },
    ],
  },
  {
    t: "🎡 Le jeu & les cadeaux",
    items: [
      {
        q: "Comment modifier mes cadeaux et leurs chances de sortie ?",
        a: (
          <>
            Dans <b>Mon jeu → onglet Jeu</b>. Chaque lot a un « poids » : plus
            il est élevé, plus le lot sort souvent. Ajoutez un lot « Rien cette
            fois » pour maîtriser vos coûts.
          </>
        ),
      },
      {
        q: "Comment valider un cadeau en caisse ?",
        a: (
          <>
            Le client vous montre son <b>code à 5 caractères</b> (ou son
            QR de gain). Allez dans <b>Valider en caisse</b>, saisissez le code
            ou scannez : le cadeau est marqué comme récupéré et ne peut pas
            être réutilisé.
          </>
        ),
      },
      {
        q: "Puis-je limiter le nombre de cadeaux par jour ?",
        a: (
          <>
            Oui, dans <b>Mon jeu</b> vous fixez un plafond quotidien. Une fois
            atteint, les joueurs suivants tombent sur « Rien cette fois » — vos
            coûts restent sous contrôle.
          </>
        ),
      },
    ],
  },
  {
    t: "⭐ Avis, abonnés & clients",
    items: [
      {
        q: "Puis-je offrir un cadeau en échange d'un avis Google ?",
        a: (
          <>
            <b>Non — et c'est voulu.</b> Conditionner un avantage à un avis est
            interdit par Google et par le droit français. Sur Kado, le cadeau
            récompense la <b>participation au jeu</b> (débloquée par des actions
            comme suivre votre Instagram ou s'inscrire à la fidélité), <b>jamais
            un avis</b>. Le lien « Avis Google » proposé au client reste
            <b> purement facultatif</b> : il n'est lié à aucun cadeau ni tour, et
            le client est libre de laisser son avis (ou non).
          </>
        ),
      },
      {
        q: "Où sont les e-mails de mes clients ?",
        a: (
          <>
            Dans <b>Clients</b>. Vous pouvez les exporter, et leur envoyer des
            offres depuis <b>Campagnes</b> (e-mail + notification).
          </>
        ),
      },
    ],
  },
  {
    t: "🔔 Commandes & notifications",
    items: [
      {
        q: "Comment le client est-il prévenu quand sa commande est prête ?",
        a: (
          <>
            Quand vous marquez une commande <b>« Prête »</b>, le client reçoit
            automatiquement une <b>notification</b> sur son téléphone (s'il l'a
            acceptée) <b>et/ou un e-mail</b>. Il suit aussi l'avancement en
            direct sur la page de sa commande.
          </>
        ),
      },
      {
        q: "Les notifications marchent-elles sur iPhone ?",
        a: (
          <>
            Oui, mais Apple demande une étape&nbsp;: le client doit d'abord
            <b> « Ajouter à l'écran d'accueil »</b> (bouton Partager de Safari →
            « Sur l'écran d'accueil »), puis rouvrir depuis l'icône. Sans ça,
            iPhone bloque les notifications web. <b>Astuce</b>&nbsp;: incitez vos
            clients à laisser leur <b>e-mail</b> — il prend le relais
            automatiquement et fonctionne sur tous les téléphones.
          </>
        ),
      },
      {
        q: "C'est quoi le « bipeur digital » ?",
        a: (
          <>
            Le client scanne un QR posé sur votre comptoir, Kado lui donne un
            <b> numéro</b>, et il est prévenu quand c'est prêt — comme un bipeur,
            mais sur son propre téléphone. Activez l'option dans{" "}
            <b>Commandes</b> → <b>« Suivi client au comptoir »</b>.
          </>
        ),
      },
    ],
  },
  {
    t: "💳 Abonnement & options",
    items: [
      {
        q: "Que comprend l'essai gratuit ?",
        a: (
          <>
            <b>14 jours</b>, toutes les fonctionnalités ouvertes (jeu,
            fidélité, campagnes, commande en ligne), sans carte bancaire. À la
            fin, vous choisissez votre formule — ou vous ne faites rien et
            l'accès se met simplement en pause.
          </>
        ),
      },
      {
        q: "Comment changer de formule ou résilier ?",
        a: (
          <>
            Dans <b>Abonnement</b>. Tout est sans engagement : vous pouvez
            changer ou arrêter à tout moment.
          </>
        ),
      },
    ],
  },
];

export default function AidePage() {
  return (
    <>
      <h1 className="dash-h1">Aide</h1>
      <p className="dash-sub">
        Les réponses aux questions les plus fréquentes. Une question qui n'est
        pas ici ? Utilisez le bouton <b>« ❓ Assistance »</b> en bas à droite —
        on vous répond vite.
      </p>

      <div className="dash-card">
        <h2>▶️ Démarrer en 3 minutes</h2>
        <p style={{ marginBottom: 14 }}>
          Une courte vidéo qui vous montre comment mettre Kado en place, étape
          par étape.
        </p>
        <video
          className="tuto-video"
          controls
          preload="metadata"
          playsInline
          poster="/tutoriel-kado-poster.jpg"
        >
          <source src="/tutoriel-kado.mp4" type="video/mp4" />
          Votre navigateur ne peut pas lire cette vidéo.
        </video>
      </div>

      {GUIDE.map((section) => (
        <div className="dash-card" key={section.t}>
          <h2>{section.t}</h2>
          {section.items.map((qa, i) => (
            <details className="faq-item" key={i}>
              <summary>{qa.q}</summary>
              <div className="faq-a">{qa.a}</div>
            </details>
          ))}
        </div>
      ))}

      <div className="dash-card">
        <h2>📩 Toujours besoin d'aide ?</h2>
        <p>
          Écrivez-nous, on répond vite (souvent en quelques minutes) :
        </p>
        <p>
          <a
            className="btn-mini soft"
            href="https://wa.me/33667797464?text=Bonjour%2C%20j'ai%20une%20question%20sur%20Kado%20%3A"
            target="_blank"
            rel="noreferrer"
          >
            💬 WhatsApp
          </a>{" "}
          <a
            className="btn-mini soft"
            href="mailto:bonjour@kado-app.fr?subject=Aide%20Kado"
          >
            ✉️ bonjour@kado-app.fr
          </a>
        </p>
      </div>
    </>
  );
}
