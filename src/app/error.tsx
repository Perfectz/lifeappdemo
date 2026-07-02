"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

const panelStyle: CSSProperties = {
  maxWidth: 480,
  width: "100%",
  background: "#121824",
  border: "1px solid #2a3546",
  borderRadius: 12,
  padding: "32px 24px",
  textAlign: "center",
  color: "#f3f7fb"
};

export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section style={{ display: "flex", justifyContent: "center", padding: "48px 16px" }}>
      <div style={panelStyle}>
        <h1 style={{ margin: "0 0 12px", fontSize: 24 }}>A wild error appeared!</h1>
        <p style={{ margin: "0 0 16px", color: "#9ba9ba" }}>
          The party took unexpected damage. Retry the encounter, or retreat to camp and regroup.
        </p>
        {error.digest ? (
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9ba9ba" }}>
            Error code: {error.digest}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#6ee7b7",
              color: "#0d1117",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            style={{
              color: "#6ee7b7",
              border: "1px solid #2a3546",
              borderRadius: 8,
              padding: "10px 20px",
              textDecoration: "none"
            }}
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
