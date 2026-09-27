"use client";

// Shared VTC-style bottom sheet used across the order flow
// (/commander, /commande-acceptee, ...).
// Drag handle + snap points + scrollable content + optional fixed footer.

import { useEffect, useRef, useState } from "react";

const SNAP_PCTS = [0.35, 0.55, 0.88]; // fraction of viewport height

export default function RideBottomSheet({
  children,
  footer,            // fixed footer slot (e.g. CTA / actions)
  initialPct = 0.55, // starting height as a fraction of the viewport
  onHeightChange,    // (heightPx: number, dragging: boolean) => void
}) {
  const sheetRef = useRef(null);
  const dragRef = useRef({ active: false, startY: 0, startH: 0 });
  const [sheetH, setSheetH] = useState(null); // px; null -> initialPct
  const [dragging, setDragging] = useState(false);

  const onDragStart = (e) => {
    const y = e.clientY;
    if (y == null || !sheetRef.current) return;
    dragRef.current = { active: true, startY: y, startH: sheetRef.current.offsetHeight };
    setDragging(true);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active || e.clientY == null) return;
      const vh = window.innerHeight;
      const next = dragRef.current.startH + (dragRef.current.startY - e.clientY);
      setSheetH(Math.max(Math.round(vh * SNAP_PCTS[0]), Math.min(Math.round(vh * SNAP_PCTS[2]), next)));
    };
    const onUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      setDragging(false);
      setSheetH((h) => {
        if (h == null) return h;
        const vh = window.innerHeight;
        const snaps = SNAP_PCTS.map((p) => Math.round(vh * p));
        return snaps.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a), snaps[0]);
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Notify parent (e.g. to position a floating button above the sheet)
  useEffect(() => {
    if (!onHeightChange) return;
    const h = sheetH ?? Math.round(window.innerHeight * initialPct);
    onHeightChange(h, dragging);
  }, [sheetH, dragging, initialPct, onHeightChange]);

  return (
    <div
      ref={sheetRef}
      className="absolute bottom-0 inset-x-0 z-[500]"
      style={{
        height: sheetH ? `${sheetH}px` : `${Math.round(initialPct * 100)}%`,
        transition: dragging ? "none" : "height 0.25s ease-out",
      }}
    >
      <div className="max-w-md mx-auto h-full bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Drag handle */}
        <div
          onPointerDown={onDragStart}
          className="shrink-0 pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="mx-auto w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {children}
        </div>

        {/* Fixed footer */}
        {footer ? (
          <div className="shrink-0 border-t border-slate-100 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
