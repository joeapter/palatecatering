"use client";

import { useRouter } from "next/navigation";

export function AdminSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/login", { method: "DELETE" });
        router.replace("/admin/login");
        router.refresh();
      }}
      className="rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-white"
    >
      Sign out
    </button>
  );
}
