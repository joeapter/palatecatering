"use client";

import { useCallback, useEffect, useState } from "react";
import { buildMessage, whatsappLink } from "@/lib/notifications/messages";
import { useMessageTemplates } from "@/lib/hooks/use-message-templates";

type Customer = {
  email: string;
  name: string | null;
  phone: string | null;
  order_count: number;
  last_order_at: string;
  ordered_this_window: boolean | null;
};
type OrderWindow = { id: number; name: string };

export function Broadcast({ windows }: { windows: OrderWindow[] }) {
  // Wording and button text come from Messages in the admin.
  const { bodyFor, labelFor, enabledFor } = useMessageTemplates();
  const [windowId, setWindowId] = useState(String(windows[0]?.id ?? ""));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("This week's Shabbos menu is open");
  const [heading, setHeading] = useState("This week's menu is open.");
  const [message, setMessage] = useState(
    "The Shabbos menu for this week is up and ordering is open.\nOrder early — some dishes sell out before the cutoff.",
  );
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (wid: string) => {
    try {
      const data = await fetch(`/api/admin/customers${wid ? `?windowId=${wid}` : ""}`).then((r) => r.json());
      setCustomers(data.customers || []);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { void load(windowId); }); }, [load, windowId]);

  const windowName = windows.find((w) => String(w.id) === windowId)?.name || "";
  const notYetOrdered = customers.filter((c) => !c.ordered_this_window);

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function send() {
    if (!selected.size) return;
    if (!confirm(`Send this email to ${selected.size} customer${selected.size === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          emails: [...selected],
          subject,
          heading,
          body: message.split("\n").filter(Boolean),
          ctaLabel: "See this week's menu",
          ctaHref: "https://www.palatecateringisrael.com/shabbos",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(data.error || "Send failed."); return; }
      setStatus(`Sent to ${data.sent}${data.failed?.length ? `, ${data.failed.length} failed` : ""}.`);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-ink/55">Loading customers…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_.9fr]">
      <section>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={windowId}
            onChange={(event) => setWindowId(event.target.value)}
            className="rounded-xl border border-ink/20 bg-white px-4 py-2 text-sm"
          >
            {windows.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={() => setSelected(new Set(notYetOrdered.map((c) => c.email)))}
            className="rounded-full border border-ink/20 px-4 py-2 text-xs font-bold"
          >
            Select all who haven&rsquo;t ordered ({notYetOrdered.length})
          </button>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-xs underline">
              Clear
            </button>
          )}
        </div>

        <div className="mt-5 max-h-[32rem] overflow-y-auto rounded-2xl border border-ink/10 bg-white">
          {customers.map((customer) => {
            const link = whatsappLink(
              customer.phone,
              buildMessage("cutoff_reminder", {
                orderNumber: "",
                customerName: customer.name,
                windowLabel: windowName,
              }, bodyFor("cutoff_reminder")),
            );
            // Wording, button text and whether it appears at all come from
            // Messages in the admin, so a seasonal announcement is changed
            // there rather than in code.
            const holidayLink = enabledFor("holiday_menu")
              ? whatsappLink(
                  customer.phone,
                  buildMessage("holiday_menu", { orderNumber: "", customerName: customer.name }, bodyFor("holiday_menu")),
                )
              : null;
            return (
              <div
                key={customer.email}
                className="flex items-center gap-3 border-b border-ink/5 px-4 py-3 text-sm last:border-0"
              >
                <input
                  type="checkbox"
                  checked={selected.has(customer.email)}
                  onChange={() => toggle(customer.email)}
                />
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{customer.name || customer.email}</b>
                  <span className="text-xs text-ink/50">
                    {customer.order_count} order{customer.order_count === 1 ? "" : "s"}
                    {customer.ordered_this_window ? " · ordered this week" : ""}
                  </span>
                </span>
                {/* Two announcements, visibly different so the wrong one is not
                    tapped in a hurry: the green cutoff nudge, and the holiday
                    menu in the brand's own colour. */}
                <span className="flex shrink-0 gap-1.5">
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[#25D366] px-3 py-2 text-[11px] font-bold whitespace-nowrap text-white"
                    >
                      {labelFor("cutoff_reminder")}
                    </a>
                  )}
                  {holidayLink && (
                    <a
                      href={holidayLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Send ${customer.name || "them"} the ${labelFor("holiday_menu")} message`}
                      className="rounded-full bg-pomegranate px-3 py-2 text-[11px] font-bold whitespace-nowrap text-white"
                    >
                      {labelFor("holiday_menu")}
                    </a>
                  )}
                </span>
              </div>
            );
          })}
          {customers.length === 0 && <p className="p-5 text-sm text-ink/55">No customers yet.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-white p-6">
        <h2 className="text-xs font-bold tracking-wider text-ink/50 uppercase">Email broadcast</h2>
        <p className="mt-2 text-xs text-ink/55">
          Sent individually, so nobody sees anybody else&rsquo;s address.
        </p>
        <label className="mt-5 block text-xs font-bold tracking-wider text-ink/50 uppercase">
          Subject
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
          />
        </label>
        <label className="mt-4 block text-xs font-bold tracking-wider text-ink/50 uppercase">
          Heading
          <input
            value={heading}
            onChange={(event) => setHeading(event.target.value)}
            className="mt-2 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
          />
        </label>
        <label className="mt-4 block text-xs font-bold tracking-wider text-ink/50 uppercase">
          Message (one paragraph per line)
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-2 min-h-36 w-full rounded-xl border border-ink/20 px-3 py-2 text-sm font-normal normal-case"
          />
        </label>

        <button
          disabled={busy || selected.size === 0}
          onClick={send}
          className="mt-6 w-full rounded-full bg-ink px-6 py-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Sending…" : `Send to ${selected.size} selected`}
        </button>
        {status && <p className="mt-3 text-sm font-semibold">{status}</p>}
      </section>
    </div>
  );
}
