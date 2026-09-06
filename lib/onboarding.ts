// Checklist de première configuration du commerçant (roadmap G3) — logique PURE,
// testable sans base ni React. La page tableau de bord fournit les signaux réels
// (logo, liens, affiche déployée, etc.) ; ici on assemble les étapes + l'état.

export type OnboardingSignals = {
  /** Un logo a été ajouté (`business.logo_url`). */
  hasLogo: boolean;
  /** Au moins un lien Instagram ou avis Google renseigné. */
  hasLinks: boolean;
  /** La formule inclut la carte de fidélité (module disponible). */
  loyaltyAvailable: boolean;
  /** La carte de fidélité est réellement activée. */
  loyaltyActive: boolean;
  /** L'affiche/QR est déployée : proxy = des clients scannent ou jouent déjà. */
  afficheDeployed: boolean;
  /** Au moins un tour a été joué. */
  hasPlays: boolean;
  /** Slug de l'établissement (lien « tester ma roue »). */
  slug: string;
};

export type OnboardingStep = {
  key: string;
  done: boolean;
  title: string;
  desc: string;
  href: string;
  cta: string;
  /** Ouvrir dans un nouvel onglet (page de jeu en aperçu). */
  external?: boolean;
};

/**
 * Étapes de première configuration, chacune avec un VRAI signal de complétion
 * (plus de case « toujours à faire » qui bloquait la barre). L'étape fidélité
 * n'apparaît que si la formule l'inclut (`loyaltyAvailable`).
 */
export function onboardingSteps(sig: OnboardingSignals): OnboardingStep[] {
  const steps: OnboardingStep[] = [
    {
      key: "logo",
      done: sig.hasLogo,
      title: "Ajoutez votre logo",
      desc: sig.hasLogo
        ? "Votre logo s'affiche en haut de votre page de jeu."
        : "Il s'affiche en haut de votre page de jeu — plus pro et rassurant.",
      href: "/dashboard/wheel",
      cta: sig.hasLogo ? "Changer mon logo" : "Ajouter mon logo",
    },
    {
      key: "links",
      done: sig.hasLinks,
      title: "Ajoutez vos liens Instagram & Google",
      desc: "Pour rediriger vos clients vers votre profil et vos avis.",
      href: "/dashboard/wheel",
      cta: sig.hasLinks ? "Modifier mes liens" : "Ajouter mes liens",
    },
  ];

  if (sig.loyaltyAvailable) {
    steps.push({
      key: "loyalty",
      done: sig.loyaltyActive,
      title: "Activez votre carte de fidélité",
      desc: sig.loyaltyActive
        ? "Vos clients cumulent des tampons à chaque visite."
        : "Incluse dans votre formule : fidélisez vos clients à chaque passage.",
      href: "/dashboard/wheel",
      cta: sig.loyaltyActive ? "Configurer la fidélité" : "Activer la fidélité",
    });
  }

  steps.push(
    {
      key: "affiche",
      done: sig.afficheDeployed,
      title: "Imprimez et posez votre affiche QR",
      desc: sig.afficheDeployed
        ? "Vos clients scannent déjà — parfait !"
        : "À poser sur vos tables, votre comptoir ou votre vitrine.",
      href: "/dashboard/qr",
      cta: "Voir mon affiche",
    },
    {
      key: "play",
      done: sig.hasPlays,
      title: "Recevez votre premier tour de roue",
      desc: sig.hasPlays
        ? "Bravo, vos clients jouent déjà !"
        : "Testez votre roue, puis lancez-vous en boutique.",
      href: `/${sig.slug}?preview=1`,
      cta: "Tester ma roue",
      external: true,
    }
  );

  return steps;
}

/** Avancement de la checklist (nombre fait / total, et tout terminé ?). */
export function onboardingProgress(steps: OnboardingStep[]): {
  done: number;
  total: number;
  allDone: boolean;
} {
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  return { done, total, allDone: total > 0 && done === total };
}
