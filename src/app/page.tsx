"use client";

import { useEffect, useState } from "react";
import LiveCaptionApp from "./live-caption-app";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!mounted) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-4 text-slate-950">
        <p className="text-lg font-semibold">Live Conference Captions</p>
      </main>
    );
  }

  return <LiveCaptionApp />;
}
