"use client";

import { useEffect, useRef, useState } from "react";

import { fxChangedEventName, isFxEnabled } from "@/client/fxSettings";

/**
 * Fixed full-viewport Three.js ambience behind the app shell. The scene
 * module (and three itself) is loaded via dynamic import() only after mount,
 * so it never server-renders and never lands in the initial bundle.
 */
export function AmbientBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Starts false so the server HTML and first client render match; flips to
  // the stored preference after mount.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(isFxEnabled());
    sync();
    window.addEventListener(fxChangedEventName, sync);
    return () => window.removeEventListener(fxChangedEventName, sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let handle: { dispose(): void } | null = null;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("./ambientScene")
      .then(({ createAmbientScene }) => {
        if (cancelled) return;
        try {
          handle = createAmbientScene(canvas, { reducedMotion });
        } catch {
          // WebGL or scene init failed — silently render nothing.
        }
      })
      .catch(() => {
        // Chunk failed to load (offline etc.) — the backdrop is optional.
      });

    return () => {
      cancelled = true;
      handle?.dispose();
      handle = null;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        // -1, not 0: the backdrop mounts after <main> in the DOM, so at
        // z-index 0 it would paint over static content. -1 layers it above
        // the body background but below all content — same stratum as the
        // body::before grid overlay in globals.css.
        zIndex: -1,
        pointerEvents: "none"
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
