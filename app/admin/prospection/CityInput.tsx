"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { splitActiveToken, applyPickedCity } from "@/lib/prospection/city-token";

/**
 * Champ de saisie de ville(s) avec autocomplétion « au fil de la frappe ».
 *
 * - Suggère des communes françaises dès les premières lettres via l'API
 *   gouvernementale gratuite geo.api.gouv.fr (aucune clé requise).
 * - Conserve la saisie multi-villes : on complète uniquement le « jeton »
 *   courant (le texte après la dernière virgule/point-virgule/retour ligne),
 *   sans écraser les villes déjà saisies.
 */

const MIN_CHARS = 2;
const GEO_URL =
  "https://geo.api.gouv.fr/communes?nom=%Q%&fields=nom,departement&boost=population&limit=6";

type Commune = { nom: string; departement?: { code?: string; nom?: string } };

export default function CityInput({
  value,
  onChange,
  placeholder,
  title,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  title?: string;
  style?: React.CSSProperties;
}) {
  const [suggestions, setSuggestions] = useState<Commune[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Ne suggère pas juste après un clic sur une suggestion (évite la réouverture).
  const justPicked = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const token = useMemo(() => splitActiveToken(value)[1].trim(), [value]);

  // Recherche débouncée dès MIN_CHARS caractères sur le jeton courant.
  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    if (token.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(GEO_URL.replace("%Q%", encodeURIComponent(token)), {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data: Commune[] = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setActive(-1);
        setOpen(true);
      } catch {
        /* réseau/abandon : on ignore silencieusement */
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [token]);

  // Ferme le menu au clic à l'extérieur.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(c: Commune) {
    justPicked.current = true;
    onChange(applyPickedCity(value, c.nom));
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (active >= 0 && active < suggestions.length) {
        e.preventDefault();
        pick(suggestions[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", ...(style?.minWidth ? { minWidth: style.minWidth } : {}) }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        title={title}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        style={style}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {suggestions.map((c, i) => (
            <li
              key={`${c.nom}-${c.departement?.code ?? i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                // mousedown (avant blur) pour que le clic soit pris en compte.
                e.preventDefault();
                pick(c);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                cursor: "pointer",
                background: i === active ? "#f1f5f9" : "transparent",
                fontSize: 14,
              }}
            >
              {c.nom}
              {c.departement?.code ? (
                <span style={{ color: "#888", marginLeft: 6, fontSize: 12 }}>
                  ({c.departement.code}
                  {c.departement.nom ? ` — ${c.departement.nom}` : ""})
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
