"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { subscribeWithCurrentKey } from "@/lib/push-client";

/** Scanner de QR de retrait (caméra + jsQR), rendu dans un volet plein écran. */
function QrScanner({
  onCode,
  onClose,
  result,
  busy,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
  result: string | null;
  busy: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [camErr, setCamErr] = useState(false);
  const [manual, setManual] = useState("");
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        const jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();

        const tick = () => {
          if (stopped) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height, {
              inversionAttempts: "dontInvert",
            });
            const text = found?.data?.trim().toUpperCase();
            if (text && /^[A-Z0-9-]{4,12}$/.test(text)) {
              // anti-rebond : le même code au max toutes les 3 s
              const now = Date.now();
              if (
                text !== lastRef.current.code ||
                now - lastRef.current.at > 3000
              ) {
                lastRef.current = { code: text, at: now };
                if (navigator.vibrate) navigator.vibrate(80);
                onCode(text);
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCamErr(true);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="scan-wrap" onClick={onClose}>
      <div className="scan-box" onClick={(e) => e.stopPropagation()}>
        <div className="scan-head">
          <b>📷 Scanner un bon de retrait</b>
          <button className="btn-mini soft" onClick={onClose}>
            Fermer
          </button>
        </div>
        {camErr ? (
          <p className="muted" style={{ padding: "8px 0" }}>
            Caméra indisponible (autorisez l'accès dans votre navigateur).
            Saisissez le code à la main ci-dessous.
          </p>
        ) : (
          <div className="scan-video-wrap">
            <video ref={videoRef} playsInline muted className="scan-video" />
            <div className="scan-target" />
          </div>
        )}
        {result && <p className="scan-result">{result}</p>}
        <form
          className="scan-manual"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onCode(manual.trim().toUpperCase());
            setManual("");
          }}
        >
          <input
            type="text"
            placeholder="Ou tapez le code (ex. K7XM3)"
            value={manual}
            maxLength={12}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
          />
          <button className="btn-mini ok" disabled={busy || !manual.trim()}>
            Valider
          </button>
        </form>
      </div>
    </div>
  );
}

export type Product = {
  id: string;
  name: string;
  price_cents: number;
  active: boolean;
  image_url?: string | null;
  description?: string | null;
};

export type OrderStats = {
  today: number;
  todayCents: number;
  month: number;
  monthCents: number;
  total: number;
  totalCents: number;
  avgCents: number;
  top: { name: string; qty: number; cents: number }[];
  avgPrepMin?: number | null;
  modes?: { surPlace: number; emporter: number; buzzer: number };
};

export type Order = {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  pickup_at: string | null;
  note: string | null;
  items: { name: string; qty: number; price_cents: number }[];
  total_cents: number;
  status: string;
  created_at: string;
  service_mode?: string | null;
  table_label?: string | null;
  buzzer_no?: number | null;
  paid?: boolean | null;
  refunded?: boolean | null;
};

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtTime(s: string) {
  return new Date(s).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Hours = Record<string, [string, string] | null> | null;

// lundi → dimanche (clés = jour JavaScript, 0 = dimanche)
const HOURS_DAYS: { key: string; label: string }[] = [
  { key: "1", label: "Lundi" },
  { key: "2", label: "Mardi" },
  { key: "3", label: "Mercredi" },
  { key: "4", label: "Jeudi" },
  { key: "5", label: "Vendredi" },
  { key: "6", label: "Samedi" },
  { key: "0", label: "Dimanche" },
];

export default function OrdersClient({
  slug,
  shopName = "",
  products,
  orders,
  stats,
  hours,
  tracking = false,
  payConnected = false,
  payReady = false,
  onlinePayment = false,
}: {
  slug: string;
  shopName?: string;
  products: Product[];
  orders: Order[];
  stats: OrderStats;
  hours: Hours;
  tracking?: boolean;
  payConnected?: boolean;
  payReady?: boolean;
  onlinePayment?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [alertsOn, setAlertsOn] = useState(false);
  // Commande en caisse (POS)
  const [posOpen, setPosOpen] = useState(false);
  const [posQty, setPosQty] = useState<Record<string, number>>({});
  const [posName, setPosName] = useState("");
  const [posMode, setPosMode] = useState<"emporter" | "sur_place">("sur_place");
  const [posTable, setPosTable] = useState("");
  const [posBusy, setPosBusy] = useState(false);
  const [posResult, setPosResult] = useState<{
    code: string;
    total: number;
    url: string;
    qr: string | null;
  } | null>(null);
  const [counterQr, setCounterQr] = useState<{ url: string; qr: string | null } | null>(
    null
  );
  const [numberTicket, setNumberTicket] = useState<{
    number: number;
    code: string;
    qr: string | null;
    time: string;
  } | null>(null);
  const [numberBusy, setNumberBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // « Donner un numéro » : pour un client SANS téléphone. Génère un numéro
  // atomique côté serveur, l'affiche en grand et prépare un ticket imprimable.
  async function giveNumber() {
    setNumberBusy(true);
    try {
      const res = await fetch("/api/dashboard/orders/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && typeof d.number === "number") {
        // QR facultatif vers le suivi (utile si le client a finalement un tel).
        let qr: string | null = null;
        try {
          const { default: QRCode } = await import("qrcode");
          qr = await QRCode.toDataURL(
            `${window.location.origin}/${slug}/suivi/${d.code}`,
            { width: 180, margin: 1 }
          );
        } catch {
          /* QR facultatif */
        }
        setNumberTicket({
          number: d.number,
          code: d.code,
          qr,
          time: new Date().toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
        router.refresh();
      } else {
        setMsg("Impossible de générer un numéro. Réessayez.");
      }
    } catch {
      setMsg("Connexion impossible.");
    } finally {
      setNumberBusy(false);
    }
  }
  const orderLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/${slug}/commander`
      : `https://kado-app.fr/${slug}/commander`;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(orderLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Copie impossible — sélectionnez le lien à la main.");
    }
  }
  const [trackingOn, setTrackingOn] = useState(tracking);
  const [trackingBusy, setTrackingBusy] = useState(false);

  // ---- Paiement en ligne (Stripe Connect) ----
  const [payReadyOn, setPayReadyOn] = useState(payReady);
  const [payOn, setPayOn] = useState(onlinePayment);
  const [payBusy, setPayBusy] = useState(false);
  // Au retour de l'onboarding Stripe (?connect=done), on rafraîchit l'état.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("connect") === "done") {
      (async () => {
        try {
          const r = await fetch("/api/billing/connect");
          const d = await r.json().catch(() => ({}));
          if (d?.ready) {
            setPayReadyOn(true);
            setMsg("✅ Compte Stripe connecté — vous pouvez encaisser en ligne.");
          } else {
            setMsg("Compte Stripe presque prêt — finalisez la configuration.");
          }
        } catch {
          /* ignore */
        }
      })();
      // nettoie l'URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  async function connectStripe() {
    setPayBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/billing/connect", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) {
        window.location.href = d.url;
      } else {
        setMsg(
          d.error === "not_ready"
            ? "Lancez d'abord la migration SQL (paiement) dans Supabase."
            : d.detail
            ? "Stripe : " + d.detail
            : "Stripe indisponible. Réessayez."
        );
        setPayBusy(false);
      }
    } catch {
      setMsg("Erreur réseau. Réessayez.");
      setPayBusy(false);
    }
  }
  async function toggleOnlinePayment(next: boolean) {
    setPayBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/dashboard/online-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setPayOn(next);
        setMsg(
          next
            ? "✅ Encaissement en ligne activé."
            : "Encaissement en ligne désactivé (paiement sur place)."
        );
      } else {
        setMsg(
          d.error === "connect_first"
            ? "Connectez d'abord votre compte Stripe."
            : "Impossible de modifier. Réessayez."
        );
      }
    } catch {
      setMsg("Erreur réseau. Réessayez.");
    } finally {
      setPayBusy(false);
    }
  }
  // Choix « paiement en ligne » : active si Stripe est prêt, sinon lance la
  // connexion Stripe (l'onboarding). Le mode « en caisse » = online_payment off.
  function chooseOnline() {
    if (payOn) return; // déjà en ligne
    if (payReadyOn) toggleOnlinePayment(true);
    else connectStripe();
  }
  async function toggleTracking(next: boolean) {
    setTrackingBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/comptoir-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setTrackingOn(next);
        if (!next) {
          setPosOpen(false);
          setCounterQr(null);
        }
        if (next && d.billed) {
          setMsg("✅ Option activée (+12 €/mois, facturée au prorata).");
        }
      } else {
        setMsg(
          d.error === "subscribe_first"
            ? "Abonnez-vous d'abord, puis ajoutez l'option (+12 €/mois)."
            : d.error === "addon_not_configured"
            ? "Option pas encore disponible — réessayez plus tard."
            : d.error === "not_ready"
            ? "Lancez d'abord la migration SQL (order_tracking) dans Supabase."
            : "Impossible de modifier l'option. Réessayez."
        );
      }
    } catch {
      setMsg("Erreur réseau. Réessayez.");
    } finally {
      setTrackingBusy(false);
    }
  }
  const [hoursDraft, setHoursDraft] = useState<
    Record<string, { open: boolean; from: string; to: string }>
  >(() => {
    const out: Record<string, { open: boolean; from: string; to: string }> = {};
    for (const { key } of HOURS_DAYS) {
      const v = hours?.[key];
      out[key] = Array.isArray(v)
        ? { open: true, from: v[0], to: v[1] }
        : { open: false, from: "09:00", to: "18:00" };
    }
    return out;
  });
  const [hoursMsg, setHoursMsg] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const pollInitRef = useRef(false);

  // Refresh périodique (sync multi-appareils des changements de statut), mais
  // UNIQUEMENT quand l'onglet est visible : un onglet en arrière-plan ne
  // rechargeait la page serveur (requête stats lourde) pour rien. (Perf P2)
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) router.refresh();
    }, 60000);
    return () => clearInterval(t);
  }, [router]);

  // Alertes déjà activées lors d'une visite précédente ?
  useEffect(() => {
    if (localStorage.getItem("kado-order-alerts") === "1") setAlertsOn(true);
  }, []);

  /** « Ding » de caisse généré par le navigateur (aucun fichier audio). */
  function chime() {
    try {
      const ctx =
        audioCtxRef.current ??
        new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume();
      const play = (freq: number, at: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + at + 0.6
        );
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.65);
      };
      play(880, 0); // la
      play(1318.5, 0.18); // mi aigu — carillon « nouvelle commande »
    } catch {
      /* audio indisponible */
    }
  }

  /** Abonne cet appareil aux notifications push (téléphone verrouillé). */
  async function subscribePush(reg: ServiceWorkerRegistration) {
    try {
      if (!("PushManager" in window)) return;
      if (Notification.permission !== "granted") return;
      const res = await fetch("/api/dashboard/push");
      const { key } = await res.json();
      if (!key) return; // clés VAPID pas encore configurées
      const sub = await subscribeWithCurrentKey(reg, key);
      const json = sub.toJSON();
      await fetch("/api/dashboard/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
    } catch {
      /* push indisponible (iPhone non installé en app, etc.) */
    }
  }

  /** Active son + notifications (nécessite le clic = déblocage audio). */
  async function enableAlerts() {
    chime(); // débloque l'audio et fait entendre le son au commerçant
    try {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        await subscribePush(reg);
      }
    } catch {
      /* notifications indisponibles : le son reste actif */
    }
    localStorage.setItem("kado-order-alerts", "1");
    setAlertsOn(true);
  }

  // Ré-abonne discrètement l'appareil à chaque visite (clés ajoutées après
  // coup, abonnement expiré…) — sans demander de permission.
  useEffect(() => {
    if (!alertsOn) return;
    if (!("serviceWorker" in navigator)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        await subscribePush(reg);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsOn]);

  // Sondage léger toutes les 15 s : son + notification à chaque nouvelle commande
  useEffect(() => {
    let stop = false;
    async function poll() {
      // Onglet en arrière-plan : on ne sonde pas (économie serveur, Perf P2).
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/dashboard/orders", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (stop) return;
        // Titre d'onglet : nombre de commandes à préparer
        const base = "Commandes — Kado";
        document.title = d.pending > 0 ? `(${d.pending}) 🛒 ${base}` : base;
        if (!pollInitRef.current) {
          pollInitRef.current = true;
          lastIdRef.current = d.latestId;
          return;
        }
        if (d.latestId && d.latestId !== lastIdRef.current) {
          lastIdRef.current = d.latestId;
          if (alertsOn) {
            chime();
            if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
            try {
              if (
                "Notification" in window &&
                Notification.permission === "granted" &&
                "serviceWorker" in navigator
              ) {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification("🛒 Nouvelle commande !", {
                  body: `${d.latestCode} — ${d.latestName ?? "client"} · ${euros(
                    d.latestTotal ?? 0
                  )} €`,
                  tag: "kado-order",
                  icon: "/logo.svg",
                });
              }
            } catch {
              /* notification indisponible : le son a suffi */
            }
          }
          router.refresh();
        }
      } catch {
        /* réseau : on retentera au prochain tour */
      }
    }
    poll();
    const t = setInterval(poll, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [alertsOn, router]);

  async function productAction(payload: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg("❌ " + (d.detail || d.error || "Échec."));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim() || !pPrice.trim()) return;
    await productAction({
      action: "create",
      name: pName,
      price: pPrice,
      description: pDesc,
    });
    setPName("");
    setPPrice("");
    setPDesc("");
  }

  /** Upload de la photo d'un produit (déclenché par l'input fichier caché). */
  async function uploadImage(id: string, file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("id", id);
      form.append("file", file);
      const res = await fetch("/api/dashboard/products/image", {
        method: "POST",
        body: form,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(
          "❌ " +
            (d.error === "too_large"
              ? "Image trop lourde (4 Mo max)."
              : d.error === "not_an_image"
              ? "Le fichier doit être une image."
              : "Échec de l'envoi de la photo.")
        );
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string, paid?: boolean | null) {
    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const d = await res.json().catch(() => ({}));
      // Quand on passe une commande « prête », on montre au commerçant si le
      // client a bien été prévenu (e-mail + notification), pour lever le doute.
      if (status === "ready" && d?.notified) {
        const bits: string[] = [];
        if (d.notified.email === "sent") bits.push("e-mail envoyé");
        if (d.notified.push === "sent") bits.push("notification envoyée 📲");
        else if (d.notified.push === "failed")
          bits.push(
            "notification impossible" +
              (d.notified.reason ? " [" + d.notified.reason + "]" : "")
          );
        if (d.notified.push === "none" && d.notified.email === "none")
          bits.push("client non abonné aux alertes");
        setMsg(bits.length ? "Client prévenu : " + bits.join(" · ") : null);
      }
      // À l'annulation, on résume au commerçant le sort du remboursement (si la
      // commande était payée en ligne) et la notification client. Un refund en
      // échec n'a PAS empêché l'annulation : on invite à réessayer via le bouton
      // « Rembourser » resté disponible.
      if (status === "cancelled") {
        const bits: string[] = [];
        const r = d?.refund;
        if (r?.status === "refunded") bits.push("remboursement déclenché ↩️");
        else if (r?.status === "failed")
          bits.push(
            "remboursement échoué — réessayez via « ↩️ Rembourser »"
          );
        else if (r?.status === "record_failed")
          bits.push("remboursement Stripe effectué (état non enregistré)");
        else if (r?.status === "no_payment_intent")
          bits.push("remboursement impossible (paiement Stripe introuvable)");
        else if (r?.status === "skipped" && r.code === "already_refunded")
          bits.push("déjà remboursée");
        // Payée en ligne mais AUCUN refund tenté (ex. colonnes 0047 illisibles) :
        // ne pas laisser croire que le client a été remboursé — l'inviter à
        // vérifier via le bouton « Rembourser ».
        else if (!r && paid)
          bits.push(
            "⚠️ remboursement non tenté — vérifiez via « ↩️ Rembourser »"
          );
        if (d?.notified?.email === "sent") bits.push("e-mail envoyé");
        if (d?.notified?.push === "sent") bits.push("notification envoyée 📲");
        else if (d?.notified?.push === "failed")
          bits.push("notification impossible");
        setMsg(
          bits.length
            ? "Commande annulée · " + bits.join(" · ")
            : "Commande annulée."
        );
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** Rembourse une commande payée en ligne (refund Stripe + drapeau). */
  async function refundOrder(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/dashboard/orders/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setMsg("✅ Commande remboursée — l'argent est repris au commerçant.");
      } else if (d.error === "already_refunded") {
        setMsg("Cette commande a déjà été remboursée.");
      } else if (d.error === "not_online_paid") {
        setMsg("Cette commande n'a pas été payée en ligne.");
      } else if (d.error === "not_found") {
        setMsg("Commande introuvable.");
      } else {
        setMsg("❌ " + (d.detail || "Remboursement impossible. Réessayez."));
      }
      router.refresh();
    } catch {
      setMsg("Erreur réseau. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  /** Enregistre les horaires de commande. */
  async function saveHours() {
    setBusy(true);
    setHoursMsg(null);
    const payload: Record<string, [string, string] | null> = {};
    for (const { key } of HOURS_DAYS) {
      const d = hoursDraft[key];
      // from ≠ to : autorise un créneau à cheval sur minuit (ex. 18:00–01:00).
      payload[key] = d.open && d.from !== d.to ? [d.from, d.to] : null;
    }
    try {
      const res = await fetch("/api/dashboard/order-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: payload }),
      });
      const d = await res.json().catch(() => ({}));
      setHoursMsg(
        res.ok
          ? "✅ Horaires enregistrés."
          : "❌ " + (d.detail || "Échec — la migration 0022 est-elle passée ?")
      );
      router.refresh();
    } catch {
      setHoursMsg("❌ Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  /** Validation d'un bon scanné (ou saisi) : passe la commande en retirée. */
  async function validateCode(code: string) {
    setBusy(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/dashboard/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, status: "done" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.order) {
        setScanResult(
          `✅ ${d.order.code} — ${d.order.customer_name} · ${euros(
            d.order.total_cents
          )} € encaissés. Bonne journée !`
        );
        router.refresh();
      } else if (d.error === "already_done") {
        setScanResult(
          `⚠️ ${d.order?.code ?? code} : déjà retirée — ne la remettez pas !`
        );
      } else if (d.error === "already_cancelled") {
        setScanResult(`⚠️ ${d.order?.code ?? code} : commande annulée.`);
      } else if (d.error === "not_found") {
        setScanResult(`❌ Code « ${code} » introuvable pour votre commerce.`);
      } else {
        setScanResult("❌ Validation impossible. Réessayez.");
      }
    } catch {
      setScanResult("❌ Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  const fresh = orders.filter((o) => o.status === "new");
  const ready = orders.filter((o) => o.status === "ready");
  const past = orders.filter((o) => o.status === "done" || o.status === "cancelled");

  // ---- Commande en caisse (POS) ----
  const posLines = products.filter((p) => (posQty[p.id] ?? 0) > 0);
  const posTotal = posLines.reduce(
    (s, p) => s + (posQty[p.id] ?? 0) * p.price_cents,
    0
  );
  function posBump(id: string, delta: number) {
    setPosQty((q) => {
      const n = Math.max(0, Math.min(30, (q[id] ?? 0) + delta));
      return { ...q, [id]: n };
    });
  }
  async function openCounterQr() {
    const url = `${window.location.origin}/${slug}/suivi`;
    let qr: string | null = null;
    try {
      const { default: QRCode } = await import("qrcode");
      qr = await QRCode.toDataURL(url, { width: 320, margin: 1 });
    } catch {
      /* QR facultatif */
    }
    setCounterQr({ url, qr });
  }

  async function submitPos() {
    if (posLines.length === 0) return;
    setPosBusy(true);
    try {
      const res = await fetch("/api/dashboard/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: posName,
          mode: posMode,
          table: posTable,
          items: posLines.map((p) => ({ id: p.id, qty: posQty[p.id] })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.code) {
        const url = `${window.location.origin}/${slug}/suivi/${d.code}`;
        let qr: string | null = null;
        try {
          const { default: QRCode } = await import("qrcode");
          qr = await QRCode.toDataURL(url, { width: 240, margin: 1 });
        } catch {
          /* QR facultatif */
        }
        setPosResult({ code: d.code, total: d.total_cents ?? posTotal, url, qr });
        setPosQty({});
        setPosName("");
        setPosTable("");
        setPosOpen(false);
        router.refresh();
      } else {
        setMsg("Impossible de créer la commande. Réessayez.");
      }
    } catch {
      setMsg("Erreur réseau. Réessayez.");
    } finally {
      setPosBusy(false);
    }
  }

  function OrderCard({ o }: { o: Order }) {
    const isBuzzer = o.service_mode === "buzzer" || o.buzzer_no != null;
    return (
      <li className={`order-card is-${o.status}${isBuzzer ? " is-buzzer" : ""}`}>
        <div className="order-head">
          {isBuzzer && o.buzzer_no != null ? (
            <span className="order-buzznum">N° {o.buzzer_no}</span>
          ) : (
            <span className="order-code">{o.code}</span>
          )}
          <b>{isBuzzer ? "Suivi client" : o.customer_name}</b>
          {o.customer_phone.trim() && (
            <a href={`tel:${o.customer_phone.replace(/\s/g, "")}`}>
              📞 {o.customer_phone}
            </a>
          )}
          <span className="order-time">{fmtTime(o.created_at)}</span>
        </div>
        <div className="order-body">
          {isBuzzer ? (
            <span className="order-mode onsite">
              🎫 Suivi client — commande encaissée sur votre caisse
            </span>
          ) : (
            <>
              {o.service_mode === "sur_place" ? (
                <span className="order-mode onsite">
                  🍽️ Sur place
                  {o.table_label ? ` · Table ${o.table_label}` : ""}
                </span>
              ) : (
                <span>
                  🥡 À emporter · <b>{o.pickup_at || "dès que possible"}</b>
                </span>
              )}
              {o.note && <span>📝 {o.note}</span>}
              <ul className="order-items">
                {o.items.map((l, i) => (
                  <li key={i}>
                    {l.qty} × {l.name}
                    <span>{euros(l.price_cents * l.qty)} €</span>
                  </li>
                ))}
              </ul>
              <div className="order-total">
                {o.paid ? (
                  <>✅ Payé en ligne : <b>{euros(o.total_cents)} €</b></>
                ) : (
                  <>Total à encaisser : <b>{euros(o.total_cents)} €</b></>
                )}
              </div>
              {o.paid && o.refunded && (
                <span className="order-refunded">↩️ Remboursée</span>
              )}
              {o.paid && !o.refunded && (
                <button
                  className="btn-mini soft order-refund-btn"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `Rembourser la commande ${o.code} (${euros(
                          o.total_cents
                        )} €) ? L'argent sera repris au commerçant.`
                      )
                    )
                      refundOrder(o.id);
                  }}
                >
                  ↩️ Rembourser
                </button>
              )}
            </>
          )}
        </div>
        {(o.status === "new" || o.status === "ready") && (
          <div className="order-actions">
            {o.status === "new" && (
              <button
                className="btn-mini ok"
                disabled={busy}
                onClick={() => setStatus(o.id, "ready")}
              >
                <Icon name="check" size={15} /> Prête
              </button>
            )}
            {o.status === "ready" && (
              <button
                className="btn-mini ok"
                disabled={busy}
                onClick={() => setStatus(o.id, "done")}
              >
                <Icon name="check" size={15} /> Retirée &amp; payée
              </button>
            )}
            <button
              className="btn-mini danger"
              disabled={busy}
              onClick={() => {
                const question =
                  o.paid && !o.refunded
                    ? `Annuler la commande ${o.code} ? Elle a été payée en ligne : le client sera remboursé (${euros(
                        o.total_cents
                      )} €).`
                    : `Annuler la commande ${o.code} ?`;
                if (confirm(question)) setStatus(o.id, "cancelled", o.paid);
              }}
            >
              Annuler
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <>
      <h1 className="dash-h1">Commandes — Click &amp; collect</h1>
      <p className="dash-sub">
        Vos clients commandent sur{" "}
        <a href={`/${slug}/commander`} target="_blank" className="admin-slug">
          kado-app.fr/{slug}/commander ↗
        </a>{" "}
        et <b>paient sur place</b> au retrait. Vous recevez un e-mail à chaque
        commande.
      </p>

      {msg && <p className="save-msg is-err">{msg}</p>}

      <div className="orders-toolbar">
        {trackingOn && (
          <>
            <button className="btn scan-open" onClick={openCounterQr}>
              🎫 QR de suivi (comptoir)
            </button>
            <button
              className="btn scan-open"
              onClick={giveNumber}
              disabled={numberBusy}
            >
              {numberBusy ? "…" : "🔢 Donner un numéro (sans téléphone)"}
            </button>
            <button
              className="btn scan-open"
              onClick={() => {
                setPosResult(null);
                setPosOpen((v) => !v);
              }}
            >
              🧾 Nouvelle commande (caisse)
            </button>
          </>
        )}
        <button
          className="btn scan-open"
          onClick={() => {
            setScanResult(null);
            setScanning(true);
          }}
        >
          📷 Scanner un bon de retrait
        </button>
        {alertsOn ? (
          <span className="alerts-on">
            🔔 Alertes sonores activées — laissez cette page ouverte pendant le
            service.
          </span>
        ) : (
          <button className="btn-mini ok alerts-btn" onClick={enableAlerts}>
            🔔 Activer les alertes sonores
          </button>
        )}
      </div>

      {scanning && (
        <QrScanner
          onCode={validateCode}
          onClose={() => setScanning(false)}
          result={scanResult}
          busy={busy}
        />
      )}

      {/* ---- Commande en caisse (POS) ---- */}
      {posOpen && (
        <div className="dash-card pos-card">
          <h2>🧾 Nouvelle commande (caisse)</h2>
          <p className="muted" style={{ marginTop: -4 }}>
            Saisissez la commande d'un client au comptoir. Il pourra scanner un
            QR de suivi pour être prévenu quand c'est prêt.
          </p>
          <div className="pos-modes">
            <button
              type="button"
              className={posMode === "sur_place" ? "on" : ""}
              onClick={() => setPosMode("sur_place")}
            >
              🍽️ Sur place
            </button>
            <button
              type="button"
              className={posMode === "emporter" ? "on" : ""}
              onClick={() => setPosMode("emporter")}
            >
              🥡 À emporter
            </button>
          </div>
          <div className="pos-fields">
            <input
              type="text"
              placeholder="Nom du client (facultatif)"
              value={posName}
              onChange={(e) => setPosName(e.target.value)}
            />
            {posMode === "sur_place" && (
              <input
                type="text"
                placeholder="N° de table (facultatif)"
                value={posTable}
                onChange={(e) => setPosTable(e.target.value)}
              />
            )}
          </div>
          <ul className="pos-products">
            {products
              .filter((p) => p.active)
              .map((p) => (
                <li key={p.id}>
                  <span className="pos-p-name">{p.name}</span>
                  <span className="pos-p-price">{euros(p.price_cents)} €</span>
                  <span className="pos-stepper">
                    <button type="button" onClick={() => posBump(p.id, -1)}>
                      −
                    </button>
                    <b>{posQty[p.id] ?? 0}</b>
                    <button type="button" onClick={() => posBump(p.id, 1)}>
                      +
                    </button>
                  </span>
                </li>
              ))}
          </ul>
          <div className="pos-foot">
            <span>
              Total : <b>{euros(posTotal)} €</b>
            </span>
            <button
              className="btn"
              disabled={posBusy || posLines.length === 0}
              onClick={submitPos}
            >
              {posBusy ? "Création…" : "Créer la commande →"}
            </button>
          </div>
        </div>
      )}

      {/* ---- QR « Suivez votre commande » à poser au comptoir ---- */}
      {counterQr && (
        <div className="pos-modal" onClick={() => setCounterQr(null)}>
          <div className="pos-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="counter-print">
              <div className="uber-done-emoji">🎫</div>
              <h2>Suivez votre commande</h2>
              {counterQr.qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={counterQr.qr} alt="QR de suivi" className="pos-qr" />
              )}
              <p>
                Scannez, prenez votre numéro, et soyez prévenu quand c'est prêt.
              </p>
            </div>
            <p className="muted" style={{ fontSize: 12.5 }}>
              Posez cette affichette sur votre comptoir. Le client scanne, reçoit
              un numéro à vous donner, puis une alerte quand c'est prêt.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => window.print()}>
                🖨️ Imprimer
              </button>
              <button className="btn-secondary" onClick={() => setCounterQr(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Numéro donné à un client sans téléphone (ticket imprimable) ---- */}
      {numberTicket != null && (
        <div className="pos-modal" onClick={() => setNumberTicket(null)}>
          <div className="pos-modal-box" onClick={(e) => e.stopPropagation()}>
            {/* Ticket : format étroit type imprimante thermique (58/80 mm). */}
            <div className="num-ticket">
              {shopName && <div className="num-ticket-shop">{shopName}</div>}
              <div className="num-ticket-label">Votre numéro</div>
              <div className="num-ticket-no">{numberTicket.number}</div>
              {numberTicket.qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={numberTicket.qr}
                  alt="Suivi"
                  className="num-ticket-qr"
                />
              )}
              <div className="num-ticket-foot">
                {numberTicket.time} · suivez en scannant le QR
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12.5, textAlign: "center" }}>
              Communiquez ce numéro au client et appelez-le à voix haute quand
              c'est prêt. Vous pouvez imprimer le ticket sur une imprimante
              thermique.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => window.print()}>
                🖨️ Imprimer le ticket
              </button>
              <button
                className="btn-secondary"
                onClick={() => setNumberTicket(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- QR de suivi à faire scanner au client ---- */}
      {posResult && (
        <div className="pos-modal" onClick={() => setPosResult(null)}>
          <div className="pos-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="uber-done-emoji">✅</div>
            <h2>Commande créée !</h2>
            <div className="uber-done-code">{posResult.code}</div>
            {posResult.qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posResult.qr} alt="QR de suivi" className="pos-qr" />
            )}
            <p>
              📱 <b>Faites scanner ce QR au client</b> : il suit sa commande en
              direct et peut activer une alerte quand c'est prêt.
            </p>
            <p className="muted" style={{ fontSize: 12.5, wordBreak: "break-all" }}>
              {posResult.url}
            </p>
            <button className="btn" onClick={() => setPosResult(null)}>
              Terminé
            </button>
          </div>
        </div>
      )}

      {/* ---- Commandes en cours ---- */}
      <div className="dash-card">
        <h2>
          🔔 À préparer{" "}
          {fresh.length > 0 && (
            <span className="setup-badge-todo">{fresh.length}</span>
          )}
        </h2>
        {fresh.length === 0 ? (
          <p className="muted">Aucune nouvelle commande pour l'instant.</p>
        ) : (
          <ul className="order-list">
            {fresh.map((o) => (
              <OrderCard key={o.id} o={o} />
            ))}
          </ul>
        )}

        {ready.length > 0 && (
          <>
            <h2 style={{ marginTop: 18 }}>✅ Prêtes — en attente de retrait</h2>
            <ul className="order-list">
              {ready.map((o) => (
                <OrderCard key={o.id} o={o} />
              ))}
            </ul>
          </>
        )}

        {past.length > 0 && (
          <details className="setup-history">
            <summary>
              📦 Historique — {past.length} commande{past.length > 1 ? "s" : ""}
            </summary>
            <ul className="order-list">
              {past.map((o) => (
                <li key={o.id} className={`order-card is-${o.status} muted-card`}>
                  <div className="order-head">
                    <span className="order-code">{o.code}</span>
                    <b>{o.customer_name}</b>
                    <span>{euros(o.total_cents)} €</span>
                    <span className="order-time">
                      {o.status === "cancelled" ? "✖ annulée" : "✔ retirée"} ·{" "}
                      {fmtTime(o.created_at)}
                    </span>
                    {o.paid && o.refunded && (
                      <span className="order-refunded">↩️ Remboursée</span>
                    )}
                    {o.paid && !o.refunded && (
                      <button
                        className="btn-mini soft order-refund-btn"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `Rembourser la commande ${o.code} (${euros(
                                o.total_cents
                              )} €) ? L'argent sera repris au commerçant.`
                            )
                          )
                            refundOrder(o.id);
                        }}
                      >
                        ↩️ Rembourser
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* ---- Partagez votre lien de commande (commander à distance) ---- */}
      <div className="dash-card share-card">
        <h2>🔗 Votre lien de commande</h2>
        <p className="muted" style={{ margin: "2px 0 10px" }}>
          Vos clients commandent à distance (retrait sur place) — partagez ce
          lien, aucune inscription pour eux.
        </p>
        <div className="share-row">
          <input readOnly value={orderLink} onFocus={(e) => e.currentTarget.select()} />
          <button className="btn" onClick={copyLink}>
            {copied ? "✓ Copié" : "Copier"}
          </button>
        </div>
        <div className="share-where">
          <span>Où le mettre&nbsp;:</span>
          <b>🔎 Fiche Google</b> (champ « Commander en ligne »)
          <b>📸 Bio Instagram</b>
          <b>💬 WhatsApp / SMS</b>
          <b>🌐 Votre site</b>
        </div>
      </div>

      {/* ---- Option : Suivi client au comptoir (bipeur digital) ---- */}
      <div className={`dash-card opt-card${trackingOn ? " on" : ""}`}>
        <div className="opt-head">
          <div>
            <h2>🎫 Suivi client au comptoir {trackingOn && <span className="opt-badge">Activé</span>}</h2>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              Le <b>bipeur digital</b> : le client scanne un QR, prend un numéro
              et reçoit une alerte quand c'est prêt. Compatible avec votre caisse
              actuelle — vous pouvez aussi saisir une commande au comptoir.
              {!trackingOn && (
                <>
                  {" "}
                  <b>+12 €/mois</b> (inclus pendant l'essai et dans la formule
                  Comptoir).
                </>
              )}
            </p>
          </div>
          <button
            className={trackingOn ? "btn-secondary" : "btn"}
            disabled={trackingBusy}
            onClick={() => toggleTracking(!trackingOn)}
          >
            {trackingBusy
              ? "…"
              : trackingOn
              ? "Désactiver"
              : "Activer l'option"}
          </button>
        </div>
        {trackingOn && (
          <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            👉 Utilisez les boutons <b>« 🎫 QR de suivi (comptoir) »</b> et
            <b> « 🧾 Nouvelle commande (caisse) »</b> tout en haut.
          </p>
        )}
      </div>

      {/* ---- Mode de paiement (en caisse / en ligne via Stripe) ---- */}
      <div className={`dash-card opt-card${payOn ? " on" : ""}`}>
        <div className="opt-head">
          <div>
            <h2>
              💳 Mode de paiement{" "}
              {payOn && <span className="opt-badge">En ligne</span>}
            </h2>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              Choisissez comment vos clients règlent leur commande click&amp;collect.
            </p>
          </div>
        </div>

        <div className="pay-choice">
          {/* En caisse / sur place */}
          <button
            type="button"
            className={`pay-opt${!payOn ? " sel" : ""}`}
            disabled={payBusy}
            onClick={() => payOn && toggleOnlinePayment(false)}
          >
            {!payOn && <span className="pay-opt-tag">Actif</span>}
            <span className="pay-opt-emoji">🏪</span>
            <span className="pay-opt-title">En caisse / sur place</span>
            <span className="pay-opt-desc">
              Le client règle au comptoir, au retrait. Rien à configurer, ça
              marche tout de suite.
            </span>
          </button>

          {/* En ligne (Stripe) */}
          <button
            type="button"
            className={`pay-opt${payOn ? " sel" : ""}`}
            disabled={payBusy}
            onClick={chooseOnline}
          >
            {payOn && <span className="pay-opt-tag">Actif</span>}
            <span className="pay-opt-emoji">💳</span>
            <span className="pay-opt-title">En ligne (Stripe)</span>
            <span className="pay-opt-desc">
              Le client <b>paie d'avance</b> — fini les no-shows. L'argent arrive{" "}
              <b>directement sur votre compte</b>.
            </span>
            {!payReadyOn && (
              <span className="pay-opt-note">⚠️ Nécessite de connecter Stripe</span>
            )}
          </button>
        </div>

        {!payReadyOn && (
          <div className="pay-connect">
            <button className="btn" disabled={payBusy} onClick={connectStripe}>
              {payBusy
                ? "…"
                : payConnected
                ? "Terminer la configuration Stripe"
                : "Connecter Stripe pour encaisser en ligne"}
            </button>
            <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              Gratuit à mettre en place. Vous restez en « sur place » tant que
              vous n'avez pas terminé.
            </p>
          </div>
        )}
        {payReadyOn && (
          <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            ✅ Compte Stripe connecté — vous pouvez basculer d'un mode à l'autre
            quand vous voulez.
          </p>
        )}
      </div>

      {/* ---- Horaires de commande ---- */}
      <div className="dash-card">
        <h2>🕒 Horaires de commande</h2>
        <p className="muted">
          En dehors de ces créneaux, votre page de commande affiche «&nbsp;Fermé&nbsp;»
          et indique la prochaine ouverture. Aucun jour coché = commandes
          acceptées en permanence.
        </p>
        <div className="hours-grid">
          {HOURS_DAYS.map(({ key, label }) => {
            const d = hoursDraft[key];
            return (
              <div key={key} className={`hours-row${d.open ? "" : " is-closed"}`}>
                <label className="hours-day">
                  <input
                    type="checkbox"
                    checked={d.open}
                    onChange={(e) =>
                      setHoursDraft((h) => ({
                        ...h,
                        [key]: { ...h[key], open: e.target.checked },
                      }))
                    }
                  />
                  {label}
                </label>
                {d.open ? (
                  <span className="hours-times">
                    <input
                      type="time"
                      value={d.from}
                      onChange={(e) =>
                        setHoursDraft((h) => ({
                          ...h,
                          [key]: { ...h[key], from: e.target.value },
                        }))
                      }
                    />
                    →
                    <input
                      type="time"
                      value={d.to}
                      onChange={(e) =>
                        setHoursDraft((h) => ({
                          ...h,
                          [key]: { ...h[key], to: e.target.value },
                        }))
                      }
                    />
                  </span>
                ) : (
                  <span className="hours-closed-label">Fermé</span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
          <button className="btn" style={{ width: "auto", padding: "12px 22px" }} disabled={busy} onClick={saveHours}>
            Enregistrer les horaires
          </button>
          {hoursMsg && <span className="save-msg">{hoursMsg}</span>}
        </div>
      </div>

      {/* ---- Statistiques ---- */}
      {stats.total > 0 && (
        <div className="dash-card">
          <h2>📊 Mes ventes Click &amp; collect</h2>
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="stat-icon"><Icon name="event" size={22} /></div>
              <div>
                <div className="stat-n">{euros(stats.todayCents)} €</div>
                <div className="stat-l">
                  Aujourd'hui · {stats.today} commande{stats.today > 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon"><Icon name="trending" size={22} /></div>
              <div>
                <div className="stat-n">{euros(stats.monthCents)} €</div>
                <div className="stat-l">
                  Ce mois-ci · {stats.month} commande{stats.month > 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon"><Icon name="chart" size={22} /></div>
              <div>
                <div className="stat-n">{euros(stats.totalCents)} €</div>
                <div className="stat-l">
                  Total · {stats.total} commande{stats.total > 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <div className="stat">
              <div className="stat-icon"><Icon name="cart" size={22} /></div>
              <div>
                <div className="stat-n">{euros(stats.avgCents)} €</div>
                <div className="stat-l">Panier moyen</div>
              </div>
            </div>
            {stats.avgPrepMin != null && (
              <div className="stat">
                <div className="stat-icon"><Icon name="event" size={22} /></div>
                <div>
                  <div className="stat-n">{stats.avgPrepMin} min</div>
                  <div className="stat-l">Temps moyen de préparation</div>
                </div>
              </div>
            )}
          </div>

          {stats.modes &&
            stats.modes.surPlace + stats.modes.emporter + stats.modes.buzzer >
              0 && (
              <div className="mode-split">
                <span>🍽️ Sur place <b>{stats.modes.surPlace}</b></span>
                <span>🥡 À emporter <b>{stats.modes.emporter}</b></span>
                <span>🎫 Bipeur <b>{stats.modes.buzzer}</b></span>
              </div>
            )}

          {stats.top.length > 0 && (
            <>
              <h3 className="top-sales-h">🏆 Meilleures ventes</h3>
              <ol className="top-sales">
                {stats.top.map((t, i) => {
                  const max = stats.top[0]?.qty || 1;
                  return (
                    <li key={t.name}>
                      <span className="top-rank">{i + 1}</span>
                      <div className="top-info">
                        <b>{t.name}</b>
                        <div className="top-bar">
                          <div
                            className="top-bar-fill"
                            style={{ width: `${Math.max(8, (t.qty / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="top-qty">
                        {t.qty} vendus · {euros(t.cents)} €
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      )}

      {/* ---- Catalogue ---- */}
      <div className="dash-card">
        <h2>🧺 Mon catalogue</h2>
        <p className="muted">
          Les produits affichés sur votre page de commande. Masquez un produit
          en rupture plutôt que de le supprimer.
        </p>
        <form onSubmit={addProduct} className="product-form">
          <div className="product-form-row">
            <input
              type="text"
              required
              placeholder="Nom du produit (ex. Formule sandwich + boisson)"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
            />
            <input
              type="text"
              required
              inputMode="decimal"
              placeholder="Prix en € (ex. 8,50)"
              style={{ maxWidth: 140 }}
              value={pPrice}
              onChange={(e) => setPPrice(e.target.value)}
            />
          </div>
          <div className="product-form-row">
            <input
              type="text"
              placeholder="Description courte (facultatif — ex. Pain frais, jambon, crudités)"
              maxLength={200}
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
            />
            <button className="btn" disabled={busy}>
              <Icon name="add" size={18} /> Ajouter
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>
            💡 Ajoutez ensuite une photo à chaque produit : les produits en
            photo se vendent beaucoup mieux.
          </p>
        </form>

        {products.length > 0 && (
          <ul className="product-list">
            {products.map((p) => (
              <li key={p.id} className={p.active ? "" : "is-off"}>
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                  src={p.image_url}
                  alt=""
                  className="product-thumb"
                  loading="lazy"
                  decoding="async"
                />
                ) : (
                  <span className="product-thumb product-thumb-empty">🍽️</span>
                )}
                <div className="product-info">
                  <b>{p.name}</b>
                  {p.description && <small>{p.description}</small>}
                </div>
                <span className="product-price">{euros(p.price_cents)} €</span>
                <div className="product-actions">
                  <label className={`btn-mini soft product-photo-btn${busy ? " is-disabled" : ""}`}>
                    📷 {p.image_url ? "Changer" : "Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(p.id, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {p.image_url && (
                    <button
                      className="btn-mini soft"
                      disabled={busy}
                      onClick={() =>
                        productAction({ action: "remove_image", id: p.id })
                      }
                    >
                      Sans photo
                    </button>
                  )}
                  <button
                    className="btn-mini soft"
                    disabled={busy}
                    onClick={() => productAction({ action: "toggle", id: p.id })}
                  >
                    {p.active ? "Masquer" : "Afficher"}
                  </button>
                  <button
                    className="btn-mini danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Supprimer « ${p.name} » ?`))
                        productAction({ action: "delete", id: p.id });
                    }}
                  >
                    <Icon name="delete" size={15} /> Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
