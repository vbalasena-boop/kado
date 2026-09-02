"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";

type Result = {
  status: string;
  prize?: string;
  redeemed_at?: string;
} | null;

type LoyaltyView = {
  email: string;
  code: string;
  stamps: number;
  goal: number;
  rewardsEarned: number;
  rewardReady: boolean;
  reward: string;
  rewardEmoji: string;
};
type LoyaltyResult = { status: string; card?: LoyaltyView } | null;

const LABELS: Record<string, { txt: string; cls: string }> = {
  valid: { txt: "✅ Code valide — cadeau à remettre", cls: "ok" },
  redeemed: { txt: "✅ Cadeau remis et marqué comme utilisé", cls: "ok" },
  already: { txt: "⚠️ Code déjà utilisé", cls: "warn" },
  daily_limit: {
    txt: "⚠️ Ce client a déjà récupéré un cadeau aujourd'hui",
    cls: "warn",
  },
  expired: { txt: "⏰ Code expiré", cls: "warn" },
  no_win: { txt: "❌ Ce tour n'a rien gagné", cls: "bad" },
  not_found: { txt: "❌ Code introuvable", cls: "bad" },
};

const FID_LABELS: Record<string, { txt: string; cls: string }> = {
  stamped: { txt: "✅ Tampon ajouté", cls: "ok" },
  completed: { txt: "🎉 Carte complète — récompense débloquée !", cls: "ok" },
  reward_pending: {
    txt: "⚠️ Récompense en attente — remettez-la avant d'ajouter un nouveau tampon.",
    cls: "warn",
  },
  collected: { txt: "✅ Récompense remise", cls: "ok" },
  nothing_to_collect: { txt: "Aucune récompense à remettre.", cls: "warn" },
  not_found: { txt: "❌ Carte introuvable", cls: "bad" },
  loyalty_off: {
    txt: "La carte de fidélité n'est pas activée. Activez-la dans « Mon jeu ».",
    cls: "warn",
  },
};

export default function ValidateClient() {
  const [tab, setTab] = useState<"gift" | "loyalty">("gift");
  const [fidQuery, setFidQuery] = useState("");
  const [fidResult, setFidResult] = useState<LoyaltyResult>(null);
  const [fidLoading, setFidLoading] = useState(false);

  async function fidCall(action: "stamp" | "collect", queryArg?: string) {
    const q = (queryArg ?? fidQuery).trim();
    if (!q) return;
    setFidLoading(true);
    try {
      const res = await fetch("/api/dashboard/loyalty/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, action }),
      });
      setFidResult(await res.json());
    } catch {
      setFidResult({ status: "not_found" });
    } finally {
      setFidLoading(false);
    }
  }

  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  async function call(action: "check" | "redeem", codeArg?: string) {
    const c = (codeArg ?? code).trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, action }),
      });
      setResult(await res.json());
    } catch {
      setResult({ status: "not_found" });
    } finally {
      setLoading(false);
    }
  }

  function stopScan() {
    scanningRef.current = false;
    setScanning(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startScan() {
    setScanErr(null);
    setResult(null);
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setScanErr(
        "Votre navigateur ne gère pas le scan. Utilisez Chrome (Android) ou saisissez le code à la main."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanning(true);
      scanningRef.current = true;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!scanningRef.current) return;
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length) {
            const val = String(codes[0].rawValue || "").trim();
            if (val) {
              stopScan();
              // Un QR "FID-…" est une carte de fidélité → onglet fidélité
              if (/^fid-/i.test(val)) {
                setTab("loyalty");
                setFidQuery(val.toUpperCase());
                fidCall("stamp", val);
              } else {
                setCode(val.toUpperCase());
                call("check", val);
              }
              return;
            }
          }
        } catch {
          /* ignore frame errors */
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      setScanErr("Accès à la caméra refusé.");
      stopScan();
    }
  }

  const r = result ? LABELS[result.status] : null;
  const fr = fidResult ? FID_LABELS[fidResult.status] : null;

  return (
    <>
      <h1 className="dash-h1">Valider en caisse</h1>
      <p className="dash-sub">
        Scannez le QR code du client, ou saisissez son code : un{" "}
        <b>cadeau roue</b> (KD-…) est marqué comme remis, une{" "}
        <b>carte de fidélité</b> (FID-…) reçoit un tampon.
      </p>

      <div className="val-tabs">
        <button
          className={`val-tab${tab === "gift" ? " on" : ""}`}
          onClick={() => setTab("gift")}
        >
          🎁 Cadeau (roue)
        </button>
        <button
          className={`val-tab${tab === "loyalty" ? " on" : ""}`}
          onClick={() => setTab("loyalty")}
        >
          🎟️ Fidélité
        </button>
      </div>

      {tab === "gift" ? (
      <div className="dash-card" style={{ maxWidth: 520 }}>
        {scanning ? (
          <div className="scan-box">
            <video ref={videoRef} playsInline muted className="scan-video" />
            <button className="btn-secondary" onClick={stopScan}>
              Arrêter le scan
            </button>
          </div>
        ) : (
          <button className="btn" onClick={startScan} disabled={loading}>
            <Icon name="qr" size={18} /> Scanner un QR code
          </button>
        )}
        {scanErr && <p className="err" style={{ marginTop: 10 }}>{scanErr}</p>}

        <div className="scan-sep">ou saisir le code</div>

        <label className="field">
          <span>Code cadeau (ex. KD-4K9Q2)</span>
          <input
            type="text"
            placeholder="KD-XXXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setResult(null);
            }}
            style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
          />
        </label>

        <button
          className="btn"
          onClick={() => call("check")}
          disabled={loading || !code.trim()}
        >
          {loading ? "Vérification…" : "Vérifier"}
        </button>

        {r && (
          <div className={`redeem-result ${r.cls}`}>
            <b>{r.txt}</b>
            {result?.prize && <div className="redeem-prize">🎁 {result.prize}</div>}
            {result?.status === "already" && result.redeemed_at && (
              <div className="muted">
                Utilisé le{" "}
                {new Date(result.redeemed_at).toLocaleString("fr-FR")}
              </div>
            )}
            {result?.status === "valid" && (
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => call("redeem")}
                disabled={loading}
              >
                Marquer comme utilisé
              </button>
            )}
          </div>
        )}
      </div>
      ) : (
      <div className="dash-card" style={{ maxWidth: 520 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Scannez le QR de la carte du client, saisissez son <b>code de
          carte</b> (FID-…) ou son <b>e-mail</b> pour ajouter un tampon.
        </p>

        {!scanning && (
          <button className="btn" onClick={startScan} disabled={fidLoading}>
            <Icon name="qr" size={18} /> Scanner un QR code
          </button>
        )}

        <div className="scan-sep">ou saisir</div>

        <label className="field">
          <span>Code de carte (FID-…) ou e-mail du client</span>
          <input
            type="text"
            placeholder="FID-XXXXX ou client@email.fr"
            value={fidQuery}
            onChange={(e) => {
              setFidQuery(e.target.value);
              setFidResult(null);
            }}
          />
        </label>

        <div className="sub-actions">
          <button
            className="btn"
            onClick={() => fidCall("stamp")}
            disabled={fidLoading || !fidQuery.trim()}
          >
            {fidLoading ? "…" : "+ Ajouter un tampon"}
          </button>
          <button
            className="btn-secondary"
            onClick={() => fidCall("collect")}
            disabled={fidLoading || !fidQuery.trim()}
          >
            🎁 Remettre la récompense
          </button>
        </div>

        {fr && (
          <div className={`redeem-result ${fr.cls}`}>
            <b>{fr.txt}</b>
            {fidResult?.card && (
              <div className="fid-recap">
                <div className="fid-recap-line">
                  Client&nbsp;: <b>{fidResult.card.email}</b>
                </div>
                <div className="fid-recap-line">
                  Progression&nbsp;:{" "}
                  <b>
                    {fidResult.card.stamps} / {fidResult.card.goal}
                  </b>{" "}
                  tampons
                  {fidResult.card.rewardsEarned > 0 && (
                    <> · déjà gagné {fidResult.card.rewardsEarned}×</>
                  )}
                </div>
                {fidResult.card.rewardReady && (
                  <div className="fid-recap-reward">
                    🎁 Récompense à remettre&nbsp;:{" "}
                    <b>
                      {fidResult.card.rewardEmoji} {fidResult.card.reward}
                    </b>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </>
  );
}
