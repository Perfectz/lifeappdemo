import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Quest Not Found"
};

export default function NotFound() {
  return (
    <section style={{ display: "flex", justifyContent: "center", padding: "48px 16px" }}>
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "#121824",
          border: "1px solid #2a3546",
          borderRadius: 12,
          padding: "32px 24px",
          textAlign: "center",
          color: "#f3f7fb"
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: 24 }}>Quest not found</h1>
        <p style={{ margin: "0 0 16px", color: "#9ba9ba" }}>
          This path leads nowhere — the quest you seek is not on the map.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
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
    </section>
  );
}
