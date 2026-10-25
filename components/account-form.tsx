"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signin" | "register";

export function AccountForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "signin" ? { email, password } : { email, password, name, phone, whatsappOptIn };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "That didn't work. Please try again.");
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setError("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm";

  return (
    <form onSubmit={submit} className="mt-9">
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-ink/5 p-1">
        {(["signin", "register"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => { setMode(value); setError(""); }}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              mode === value ? "bg-ink text-white" : "text-ink/60"
            }`}
          >
            {value === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {mode === "register" && (
          <>
            <label className="block">
              <span className="sr-only">Full name</span>
              <input
                className={input}
                placeholder="Full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </label>
            <label className="block">
              <span className="sr-only">Phone</span>
              <input
                className={input}
                placeholder="Phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </label>
          </>
        )}

        <label className="block">
          <span className="sr-only">Email</span>
          <input
            required
            type="email"
            className={input}
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="sr-only">Password</span>
          <input
            required
            type="password"
            className={input}
            placeholder={mode === "register" ? "Password (at least 8 characters)" : "Password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={mode === "register" ? 8 : undefined}
          />
        </label>

        {mode === "register" && (
          <label className="flex items-start gap-3 pt-1 text-sm text-ink/65">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(event) => setWhatsappOptIn(event.target.checked)}
              className="mt-1"
            />
            <span>Send my order updates by WhatsApp.</span>
          </label>
        )}
      </div>

      {error && <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
