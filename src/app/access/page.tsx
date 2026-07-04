"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AccessPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("코드가 올바르지 않습니다.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("접근 확인 중 문제가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f7f4] px-4 text-[#17201b]">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-[#d4ddd5] bg-white p-5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#e3f4ed] text-[#0e5c4a]">
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <h1 className="text-base font-extrabold">Live Conference Captions</h1>
        </div>

        <label className="flex flex-col gap-2 text-sm font-semibold text-[#26332c]">
          Access code
          <input
            autoComplete="current-password"
            autoFocus
            className="h-10 rounded-md border border-[#c8d2ca] bg-white px-3 text-base font-medium outline-none transition focus:border-[#1d6f5f] focus:ring-2 focus:ring-[#1d6f5f]/15"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>

        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || password.trim().length === 0}
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-950 bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? "Checking" : "Enter"}
        </button>
      </form>
    </main>
  );
}
