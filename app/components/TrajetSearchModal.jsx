"use client";

// Full-screen trip search modal (native-app style, slides up from bottom)
// Holds Départ + Destination fields with a shared suggestions list below.

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlaces, useRemoteSuggestions, buildSuggestions, normName } from "../lib/places";
import { useToast } from "./ToastProvider";

// ~km between two {lat, lon} points (haversine)
const kmBetween = (a, b) => {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const fmtDist = (km) => {
  if (km == null || !Number.isFinite(km)) return null;
  return km < 1 ? `${Math.max(1, Math.round(km * 1000))} m` : `${km.toFixed(1)} km`;
};

// Common Nominatim category/type values → French labels
const PLACE_LABELS = {
  quartier: "Quartier",
  poi: "Lieu",
  amenity: "Établissement",
  shop: "Commerce",
  tourism: "Tourisme",
  leisure: "Loisir",
  office: "Bureau",
  building: "Bâtiment",
  highway: "Route",
  place: "Lieu",
  hamlet: "Hameau",
  village: "Village",
  suburb: "Quartier",
  neighbourhood: "Quartier",
  town: "Ville",
  city: "Ville",
  restaurant: "Restaurant",
  pharmacy: "Pharmacie",
  hospital: "Hôpital",
  clinic: "Clinique",
  school: "École",
  college: "Collège",
  university: "Université",
  hotel: "Hôtel",
  fuel: "Station-service",
  bank: "Banque",
  marketplace: "Marché",
  bus_station: "Gare routière",
  parking: "Parking",
  church: "Église",
  mosque: "Mosquée",
  place_of_worship: "Lieu de culte",
};

const placeLabel = (p) => {
  if (p.source === "quartier") return "Quartier";
  if (p.source === "nominatim") {
    return PLACE_LABELS[p.type] || PLACE_LABELS[p.category] || "Adresse";
  }
  return PLACE_LABELS[p.source] || "Lieu";
};

export default function TrajetSearchModal({
  open,
  onClose,
  onDone,
  trip,        // { startText, startPoint, destText, destPoint }
  onChange,    // (patch) => void — patch keys: startText, startPoint, destText, destPoint
}) {
  const toast = useToast();
  const { startText, startPoint, destText, destPoint } = trip;

  // Mount lazily on first open, then stay mounted (state + dataset preserved)
  const [everOpened, setEverOpened] = useState(false);
  const [shown, setShown] = useState(false);
  const [activeField, setActiveField] = useState("start"); // 'start' | 'dest'
  const [clientPos, setClientPos] = useState(null);

  const startInputRef = useRef(null);
  const destInputRef = useRef(null);

  const places = usePlaces();
  const startRemote = useRemoteSuggestions(startText);
  const destRemote = useRemoteSuggestions(destText);

  const startSuggestions = useMemo(
    () => buildSuggestions(startText, places, startRemote),
    [startText, places, startRemote]
  );
  const destSuggestions = useMemo(
    () => buildSuggestions(destText, places, destRemote),
    [destText, places, destRemote]
  );
  const suggestions = activeField === "start" ? startSuggestions : destSuggestions;
  const activeText = activeField === "start" ? startText : destText;

  // Distance reference: destination suggestions are measured from the chosen
  // departure point; otherwise fall back to the client's geolocation.
  const refPoint =
    activeField === "dest" && startPoint ? startPoint : clientPos;

  // Open/close animation lifecycle
  useEffect(() => {
    if (open) {
      setEverOpened(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShown(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);

  // Lock background page scroll while the modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Choose which field needs attention when the modal opens
  useEffect(() => {
    if (!open) return;
    setActiveField(!startPoint ? "start" : !destPoint ? "dest" : "dest");
  }, [open]);

  // Best-effort client position, used to show distances next to suggestions
  useEffect(() => {
    if (!open || clientPos || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setClientPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 4000 }
    );
  }, [open, clientPos]);

  const pick = (p) => {
    const point = { name: p.name, lat: p.lat, lon: p.lon };
    if (activeField === "start") {
      onChange({ startText: p.name, startPoint: point });
      if (destPoint) { onDone?.(); return; }
      setActiveField("dest");
      if (typeof document !== "undefined" && document.activeElement === startInputRef.current) {
        setTimeout(() => destInputRef.current?.focus(), 60);
      }
    } else {
      onChange({ destText: p.name, destPoint: point });
      if (startPoint) { onDone?.(); return; }
      setActiveField("start");
      if (typeof document !== "undefined" && document.activeElement === destInputRef.current) {
        setTimeout(() => startInputRef.current?.focus(), 60);
      }
    }
  };

  const swap = () => {
    onChange({
      startText: destText,
      startPoint: destPoint,
      destText: startText,
      destPoint: startPoint,
    });
  };

  const locateMe = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast.error("La géolocalisation n'est pas disponible.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const point = { name: "Ma position", lat, lon };
        onChange({ startText: "Ma position", startPoint: point });
        if (destPoint) { onDone?.(); return; }
        setActiveField("dest");
        setTimeout(() => destInputRef.current?.focus(), 60);
      },
      () => toast.error("Impossible d'obtenir votre position."),
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  if (!everOpened) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-white flex flex-col will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${shown ? "translate-y-0" : "translate-y-full pointer-events-none"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche de trajet"
      aria-hidden={!shown}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-slate-100">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="font-semibold text-slate-800">Où allons-nous ?</div>
      </div>

      {/* Fields */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_28px_-8px_rgba(15,23,42,0.18)]">
          {/* Départ */}
          <div className="flex items-center gap-2 px-3">
            <img src="/depart.png" alt="" className="w-5 h-5 shrink-0" />
            <input
              ref={startInputRef}
              value={startText}
              onChange={(e) => onChange({ startText: e.target.value, startPoint: null })}
              onFocus={() => setActiveField("start")}
              placeholder="Votre position"
              aria-label="Point de départ"
              className="flex-1 min-w-0 py-3 outline-none bg-transparent text-[15px]"
            />
            <button
              type="button"
              onClick={locateMe}
              className="shrink-0 text-sm font-medium text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-100"
            >
              Ma position
            </button>
          </div>

          {/* Divider + swap */}
          <div className="relative">
            <div className="border-t border-slate-200 mx-3" />
            <button
              type="button"
              onClick={swap}
              aria-label="Inverser départ et destination"
              className="absolute right-3 -top-3.5 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-orange-600"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l-3 3m3-3l3 3" />
              </svg>
            </button>
          </div>

          {/* Destination */}
          <div className="flex items-center gap-2 px-3">
            <img src="/destination.png" alt="" className="w-5 h-5 shrink-0" />
            <input
              ref={destInputRef}
              value={destText}
              onChange={(e) => onChange({ destText: e.target.value, destPoint: null })}
              onFocus={() => setActiveField("dest")}
              placeholder="Destination"
              aria-label="Destination"
              className="flex-1 min-w-0 py-3 outline-none bg-transparent text-[15px]"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 mt-2 px-1">
          {activeField === "start" ? "Choisissez votre point de départ" : "Choisissez votre destination"}
        </div>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 pb-8">
        {suggestions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            {activeText.trim()
              ? "Aucun lieu trouvé pour cette recherche."
              : "Aucune proposition disponible."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {suggestions.map((p) => {
              const dist = fmtDist(kmBetween(refPoint, p));
              const label = placeLabel(p);
              return (
                <li key={`${normName(p.name)}-${p.lat}-${p.lon}`}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 active:bg-slate-100"
                  >
                    <span className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <div className="text-[15px] font-medium text-slate-800 truncate">{p.name}</div>
                        <div className="shrink-0 text-[11px] font-medium text-orange-600">{label}</div>
                      </div>
                      {p.detail ? (
                        <div className="text-xs text-slate-500 truncate">{p.detail}</div>
                      ) : null}
                    </span>
                    {dist ? (
                      <span className="shrink-0 text-xs font-medium text-slate-400">{dist}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
