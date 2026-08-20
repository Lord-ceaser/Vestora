"use client";

import dynamic from "next/dynamic";

// Charts and localStorage-backed persistence need the browser, so this is
// loaded client-side only (no server render) to avoid hydration issues.
const VestoraApp = dynamic(() => import("@/components/VestoraApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, -apple-system, sans-serif",
        color: "#5B665F",
        fontSize: 14,
      }}
    >
      Loading Modibbo…
    </div>
  ),
});

export default function Home() {
  return <VestoraApp />;
}
