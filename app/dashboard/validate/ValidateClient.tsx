"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";

type Result = {
  status: string;
  prize?: string;
  redeemed_at?: string;
} | null;

const LABELS: Record<string, { txt: string; cls: string }> = {
  valid: { txt: "✅ Code valide — cadeau à remettre", cls: "ok" },
  redeemed: { txt: "✅ Cadeau remis et marqué comme utilisé", cls: "ok" },
  already: { txt: "⚠️ Code déjà utilisé", cls: "warn" },
  expired: { txt: "⏰ Code expiré", cls: "warn" },
  no_win: { txt: "❌ Ce tour n'a rien gagné", cls: "bad" },
  not_found: { txt: "❌ Code introuvable", cls: "bad" },
};

export default function ValidateClient() {
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
              setCode(val.toUpperCase());
              stopScan();
              call("check", val);
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

  return (
    <>
      <h1 className="dash-h1">Valider un cadeau</h1>
      <p className="dash-sub">
        Scannez le QR code du client, ou saisissez son code, pour vérifier puis
        marquer le cadeau comme utilisé.
      </p>

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
    </>
  );
}
