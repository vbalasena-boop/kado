"use client";
import { useEffect, useRef, useState } from "react";
import { BEEPER_LABELS, type BeeperOrder } from "@/lib/beeper";

export default function BeeperClient({ slug, name, reviewUrl }: { slug: string; name: string; reviewUrl: string | null }) {
  const [order, setOrder] = useState<BeeperOrder | null>(null);
  const [error, setError] = useState("");
  const [alertMessage, setAlertMessage] = useState("Activez le son et gardez cette page ouverte pour recevoir l’alerte. En arrière-plan, elle n’est pas garantie.");
  const audio = useRef<AudioContext | null>(null);
  const previous = useRef<string | null>(null);
  const initialRequest = useRef<Promise<Response> | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh(create: boolean) {
      try {
        const url = `/api/beeper/${encodeURIComponent(slug)}`;
        // React StrictMode peut relancer cet effet : une seule création en vol.
        if (create) initialRequest.current ??= fetch(url, { method: "POST", cache: "no-store" });
        const response = create ? (await initialRequest.current!).clone() : await fetch(url, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (stopped) return;
        const next = body.order as BeeperOrder | null;
        if (!next) { setError("Ce beeper a expiré. Demandez un nouveau numéro au comptoir."); return; }
        setOrder(next);
        setError("");
        if (next.status === "ready" && previous.current !== "ready") {
          const vibrated = typeof navigator.vibrate === "function" && navigator.vibrate([300, 100, 300]);
          const ctx = audio.current;
          if (ctx?.state === "running") {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.15;
            oscillator.frequency.value = 880;
            oscillator.connect(gain).connect(ctx.destination);
            oscillator.start(); oscillator.stop(ctx.currentTime + 0.8);
          }
          if (!vibrated || ctx?.state !== "running") setAlertMessage("Votre appareil ne permet pas toutes les alertes (son ou vibration). Votre commande est prête : présentez votre numéro au comptoir.");
        }
        previous.current = next.status;
        if (next.status === "collected") return;
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "Connexion interrompue.");
        if (create) return; // Une erreur de création nécessite une relance explicite.
      }
      if (!stopped) timer = setTimeout(() => void refresh(false), 5000);
    }
    void refresh(true);
    return () => { stopped = true; clearTimeout(timer); };
  }, [slug, retry]);

  useEffect(() => {
    if (!order || order.status === "collected") return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    async function keepAwake() {
      if (document.visibilityState !== "visible") return;
      try {
        if (!("wakeLock" in navigator)) throw new Error("unsupported");
        const acquired = await navigator.wakeLock.request("screen");
        if (stopped) { await acquired.release(); return; }
        lock = acquired;
      } catch {
        if (!stopped) setAlertMessage("Le maintien de l’écran allumé est indisponible. Gardez la page visible et surveillez votre numéro ; les alertes dépendent de votre appareil.");
      }
    }
    void keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    return () => { stopped = true; document.removeEventListener("visibilitychange", keepAwake); void lock?.release(); };
  }, [order?.id, order?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { void audio.current?.close(); }, []);

  async function enableSound() {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      if (audio.current.state !== "running") throw new Error("blocked");
      setAlertMessage("Son activé. Gardez cette page visible ; la vibration dépend de votre appareil.");
    } catch { setAlertMessage("Son indisponible sur cet appareil. Gardez cette page visible pour suivre votre commande."); }
  }
  return <main className="landing" id="main-content"><div className="landing-card">
    <h1>{name}</h1>
    <div role="status" aria-live="polite">
      {order ? <><p>Votre beeper</p><strong style={{ fontSize: "5rem" }}>N° {order.number}</strong><h2>{BEEPER_LABELS[order.status]}</h2></> : <p>Attribution de votre numéro…</p>}
    </div>
    {error && <p role="alert">{error}</p>}
    {error && !order && <button className="btn" onClick={() => { initialRequest.current = null; setRetry(r => r + 1); }}>Réessayer</button>}
    {order?.status !== "collected" && <><button className="btn" onClick={enableSound}>Activer le son</button><p>{alertMessage}</p></>}
    {order?.status === "preparing" && <nav aria-label="Pendant l’attente"><a href={`/${slug}`} target="_blank" rel="noopener noreferrer">Jouer</a>{" · "}{reviewUrl && <a href={reviewUrl} target="_blank" rel="noopener noreferrer">Laisser un avis Google</a>}<p>Revenez sur cette page pour suivre votre commande.</p></nav>}
  </div></main>;
}
