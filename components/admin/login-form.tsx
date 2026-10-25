"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-7"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ password }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            setError(data.error || "Incorrect password.");
            return;
          }
          router.replace("/admin");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        type="password"
        required
        autoFocus
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Admin password"
        autoComplete="current-password"
        className="w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm"
      />
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
