"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d1117",
          color: "#f3f7fb",
          fontFamily: "system-ui, sans-serif",
          padding: 16
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#121824",
            border: "1px solid #2a3546",
            borderRadius: 12,
            padding: "32px 24px",
            textAlign: "center"
          }}
        >
          <h1 style={{ margin: "0 0 12px", fontSize: 24 }}>A wild error appeared!</h1>
          <p style={{ margin: "0 0 16px", color: "#9ba9ba" }}>
            The whole party wiped. Retry the encounter to reload the game.
          </p>
          {error.digest ? (
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9ba9ba" }}>
              Error code: {error.digest}
            </p>
          ) : null}
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
        </div>
      </body>
    </html>
  );
}
