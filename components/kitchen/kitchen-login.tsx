"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sign-in for the kitchen screen. Deliberately one field: staff on a shared
 * phone should not be handling an email address as well as a code.
 */
export function KitchenLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/kitchen-auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "That code is not right.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code is not right.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-[1.5rem] border border-ink/10 bg-white p-7">
      <p className="text-xs font-bold tracking-[.2em] text-clay uppercase">Palate</p>
      <h1 className="display t-h3 mt-2 font-semibold">Kitchen</h1>
      <p className="mt-2 text-sm leading-6 text-ink/60">
        Enter the kitchen code. You will stay signed in on this device.
      </p>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Kitchen code"
        autoComplete="current-password"
        // Named so a password manager can keep it separate from the admin login.
        name="palate-kitchen-code"
        className="mt-5 w-full rounded-xl border border-ink/20 px-4 py-3.5"
        required
      />
      <button disabled={busy} className="focus-ring mt-4 w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white disabled:opacity-50">
        {busy ? "Checking…" : "Open the kitchen"}
      </button>
      {error && <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
    </form>
  );
}
