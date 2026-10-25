import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@vercel/postgres";
import { isAdmin } from "@/lib/admin-auth";
import { getStripeIncome } from "@/lib/stripe/income";

export const dynamic = "force-dynamic";

/**
 * Totals are computed in Asia/Jerusalem, not UTC. An order placed at 01:00 on
 * the first of the month in Israel is still the previous month in UTC, which
 * would quietly move revenue between months.
 *
 * `total` is a text column inherited from the old system, so every sum strips
 * non-numeric characters before casting rather than trusting the contents.
 */
const MONEY = `COALESCE(SUM(NULLIF(regexp_replace(total, '[^0-9.]', '', 'g'), '')::numeric), 0)`;

async function loadDashboard() {
  const [windowRow, review, stuck, recent, months, years, windowStatsAll] = await Promise.all([
    sql`
      SELECT id, name, event_date, cutoff_at
      FROM order_windows
      WHERE active = true AND cutoff_at > now()
      ORDER BY cutoff_at ASC LIMIT 1;
    `,
    sql`SELECT count(*)::int AS n FROM products WHERE needs_price_review = true;`,
    // Paid but never turned into an order. This is money taken with nothing in
    // the kitchen, so it belongs at the top of the dashboard, not in a log.
    sql`
      SELECT count(*)::int AS n FROM checkout_sessions
      WHERE status <> 'complete' AND created_at < now() - interval '15 minutes';
    `,
    sql`
      SELECT id, order_number, customer_name, total, status, created_at, shabbos_label
      FROM orders
      WHERE COALESCE(is_deleted,false) = false
      ORDER BY created_at DESC LIMIT 8;
    `,
    // Month-by-month income, newest first. Thirteen months so that this month
    // and the same month a year ago are both present.
    sql.query(`
      SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'Asia/Jerusalem'), 'YYYY-MM') AS month,
             ${MONEY} AS revenue,
             count(*)::int AS orders
      FROM orders
      WHERE COALESCE(is_deleted,false) = false
        AND created_at > (now() AT TIME ZONE 'Asia/Jerusalem') - interval '13 months'
      GROUP BY 1 ORDER BY 1 DESC;
    `),
    // Income by calendar year — 2026 meaning January to now, not the last
    // twelve months added together, which would quietly include last year.
    sql.query(`
      SELECT to_char(date_trunc('year', created_at AT TIME ZONE 'Asia/Jerusalem'), 'YYYY') AS year,
             ${MONEY} AS revenue,
             count(*)::int AS orders
      FROM orders
      WHERE COALESCE(is_deleted,false) = false
      GROUP BY 1 ORDER BY 1 DESC LIMIT 5;
    `),
    // Per-window counts for every open window, so a quiet week is visible
    // before it becomes a surprise.
    sql.query(`
      SELECT w.id, w.name, w.cutoff_at,
             count(o.id)::int AS orders,
             COALESCE(SUM(NULLIF(regexp_replace(o.total, '[^0-9.]', '', 'g'), '')::numeric), 0) AS revenue
      FROM order_windows w
      LEFT JOIN orders o
        ON o.order_window_id = w.id AND COALESCE(o.is_deleted,false) = false
      WHERE w.active = true AND w.cutoff_at > now()
      GROUP BY w.id, w.name, w.cutoff_at
      ORDER BY w.cutoff_at ASC LIMIT 6;
    `),
  ]);

  const current = windowRow.rows[0];
  const monthRows = months.rows as { month: string; revenue: string; orders: number }[];
  const nowMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }).slice(0, 7);
  const prevDate = new Date();
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = prevDate.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }).slice(0, 7);

  const findMonth = (key: string) => monthRows.find((row) => row.month === key);
  const thisMonth = findMonth(nowMonth);
  const lastMonth = findMonth(prevMonth);

  const yearRows = years.rows as { year: string; revenue: string; orders: number }[];
  const nowYear = String(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }).slice(0, 4));
  const prevYear = String(Number(nowYear) - 1);
  const thisYear = yearRows.find((row) => row.year === nowYear);
  const priorYear = yearRows.find((row) => row.year === prevYear);

  // Money Stripe actually settled. Fetched alongside the booked figures so
  // both can be shown; they legitimately differ.
  const stripeIncome = await getStripeIncome();

  const openWindows = windowStatsAll.rows as { id: number; name: string; cutoff_at: string; orders: number; revenue: string }[];
  const currentStats = openWindows.find((row) => Number(row.id) === Number(current?.id));

  return {
    current,
    windowStats: {
      orders: Number(currentStats?.orders) || 0,
      revenue: Number(currentStats?.revenue) || 0,
    },
    openWindows,
    thisMonth: { revenue: Number(thisMonth?.revenue) || 0, orders: Number(thisMonth?.orders) || 0 },
    lastMonth: { revenue: Number(lastMonth?.revenue) || 0, orders: Number(lastMonth?.orders) || 0 },
    months: monthRows.slice(0, 12).reverse(),
    year: {
      label: nowYear,
      revenue: Number(thisYear?.revenue) || 0,
      orders: Number(thisYear?.orders) || 0,
    },
    priorYear: priorYear
      ? { label: prevYear, revenue: Number(priorYear.revenue) || 0, orders: Number(priorYear.orders) || 0 }
      : null,
    stripeIncome,
    reviewCount: Number(review.rows[0]?.n) || 0,
    stuckCount: Number(stuck.rows[0]?.n) || 0,
    recent: recent.rows,
  };
}

function hoursUntil(value: string): string {
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
}

export default async function AdminDashboard() {
  if (!(await isAdmin())) redirect("/admin/login");

  let data;
  try {
    data = await loadDashboard();
  } catch (error) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-12">
        <h1 className="display t-h2 font-semibold">Dashboard unavailable</h1>
        <p className="mt-4 text-sm text-ink/60">
          The database could not be reached. {error instanceof Error ? error.message : ""}
        </p>
      </main>
    );
  }


  const { current, windowStats, openWindows, thisMonth, lastMonth, months, year, priorYear, stripeIncome, reviewCount, stuckCount, recent } = data;

  // Compared against the same point in last month, not last month's final
  // total — otherwise the first of the month always looks like a collapse.
  const dayOfMonth = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }).slice(8));
  const daysInLastMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 0).getDate();
  const lastMonthToDate = lastMonth.revenue * Math.min(1, dayOfMonth / daysInLastMonth);
  const delta = lastMonthToDate > 0 ? ((thisMonth.revenue - lastMonthToDate) / lastMonthToDate) * 100 : null;
  const peak = Math.max(...months.map((m) => Number(m.revenue) || 0), 1);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="display t-h2 font-semibold">
        {current ? current.name : "No open order window"}
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        {current
          ? `Ordering closes ${new Date(current.cutoff_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · ${hoursUntil(current.cutoff_at)}`
          : "Create an order window so customers can place orders."}
      </p>

      {stuckCount > 0 && (
        <Link href="/admin/orders" className="mt-6 block rounded-2xl border-2 border-red-600 bg-red-50 p-4 sm:p-5">
          <p className="font-bold text-red-800">
            {stuckCount} payment{stuckCount === 1 ? "" : "s"} may need attention
          </p>
          <p className="mt-1 text-sm text-red-700">
            A checkout was started but never became an order. If the customer was charged,
            nothing has reached the kitchen. Review and retry these.
          </p>
        </Link>
      )}

      {/* Income leads, because it is the number the owner actually opens this
          page for. The rest is operational detail underneath it. */}
      <section className="mt-7 rounded-[1.5rem] border border-ink/10 bg-white p-5 sm:p-7">
        {/* Month and year sit side by side as plain figures. The year is the
            calendar year — January to today — not the last twelve months
            summed, which would fold part of last year into it. */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold tracking-[.18em] text-clay uppercase">
              Paid this month{stripeIncome ? "" : " (booked)"}
            </p>
            <p className="display mt-2 text-5xl font-semibold tabular-nums sm:text-6xl">
              ₪{(stripeIncome ? stripeIncome.month.net : thisMonth.revenue).toLocaleString("en-IL", { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-2 text-sm text-ink/60">
              {stripeIncome
                ? `${stripeIncome.month.count} card payment${stripeIncome.month.count === 1 ? "" : "s"}`
                : `${thisMonth.orders} order${thisMonth.orders === 1 ? "" : "s"}`}
              {stripeIncome && stripeIncome.month.refunded > 0 &&
                ` · after ₪${stripeIncome.month.refunded.toLocaleString("en-IL", { maximumFractionDigits: 0 })} refunded`}
            </p>
            {delta !== null && (
              <p className={`mt-2 text-sm font-bold ${delta >= 0 ? "text-moss" : "text-clay"}`}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% booked vs this point last month
              </p>
            )}
            <p className="mt-1 text-xs text-ink/50 tabular-nums">
              Booked in orders: ₪{thisMonth.revenue.toLocaleString("en-IL", { maximumFractionDigits: 0 })} from {thisMonth.orders} order{thisMonth.orders === 1 ? "" : "s"}
            </p>
          </div>

          <div className="border-t border-ink/10 pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <p className="text-xs font-bold tracking-[.18em] text-clay uppercase">
              Paid in {year.label}{stripeIncome ? "" : " (booked)"}
            </p>
            <p className="display mt-2 text-5xl font-semibold tabular-nums sm:text-6xl">
              ₪{(stripeIncome ? stripeIncome.year.net : year.revenue).toLocaleString("en-IL", { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-2 text-sm text-ink/60">
              {stripeIncome
                ? `${stripeIncome.year.count} card payment${stripeIncome.year.count === 1 ? "" : "s"}`
                : `${year.orders} order${year.orders === 1 ? "" : "s"}`}
              {stripeIncome && stripeIncome.year.refunded > 0 &&
                ` · after ₪${stripeIncome.year.refunded.toLocaleString("en-IL", { maximumFractionDigits: 0 })} refunded`}
            </p>
            <p className="mt-2 text-xs text-ink/50 tabular-nums">
              Booked in orders: ₪{year.revenue.toLocaleString("en-IL", { maximumFractionDigits: 0 })} from {year.orders} order{year.orders === 1 ? "" : "s"}
            </p>
            {priorYear && priorYear.revenue > 0 && (
              <p className="mt-1 text-xs text-ink/50 tabular-nums">
                {priorYear.label} booked: ₪{priorYear.revenue.toLocaleString("en-IL", { maximumFractionDigits: 0 })}
              </p>
            )}
          </div>
        </div>

        {stripeIncome && Math.abs(year.revenue - stripeIncome.year.net) > 1 && (
          <p className="mt-5 rounded-xl bg-cream/70 p-3 text-xs leading-5 text-ink/65">
            <b>Paid</b> is what Stripe settled, after refunds. <b>Booked</b> is every order taken,
            including any paid by transfer, Bit or cash, which Stripe never sees. The
            ₪{Math.abs(year.revenue - stripeIncome.year.net).toLocaleString("en-IL", { maximumFractionDigits: 0 })} difference
            this year is those payments plus ₪{stripeIncome.year.refunded.toLocaleString("en-IL", { maximumFractionDigits: 0 })} refunded.
          </p>
        )}

        {months.length > 1 && (
          <div className="mt-6 flex items-end gap-1.5" aria-label="Monthly income, last 12 months">
            {months.map((month) => {
              const value = Number(month.revenue) || 0;
              const isNow = month.month === months[months.length - 1].month;
              return (
                <div key={month.month} className="group flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className={`w-full rounded-t transition ${isNow ? "bg-honey" : "bg-ink/15 group-hover:bg-ink/30"}`}
                    style={{ height: `${Math.max(3, (value / peak) * 88)}px` }}
                    title={`${month.month}: ₪${value.toLocaleString("en-IL", { maximumFractionDigits: 0 })}`}
                  />
                  <span className="text-[9px] text-ink/45 tabular-nums">{month.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Orders this window" value={String(windowStats.orders)} href="/admin/orders" />
        <Stat label="Revenue this window" value={`₪${windowStats.revenue.toLocaleString("en-IL", { maximumFractionDigits: 0 })}`} />
        <Stat label="Awaiting price review" value={String(reviewCount)} href="/admin/pricing" warn={reviewCount > 0} />
        <Stat label="Kitchen view" value="Open" href="/kitchen" />
      </div>

      {openWindows.length > 1 && (
        <section className="mt-10">
          <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">Open windows</h2>
          <div className="rail mt-4 flex gap-3 overflow-x-auto pb-2">
            {openWindows.map((window) => (
              <div key={window.id} className="min-w-52 shrink-0 rounded-2xl border border-ink/10 bg-white p-4">
                <p className="text-sm font-bold">{window.name}</p>
                <p className="mt-1 text-xs text-ink/50">{hoursUntil(window.cutoff_at)}</p>
                <p className="mt-3 text-2xl font-bold tabular-nums">{window.orders}</p>
                <p className="text-xs text-ink/55 tabular-nums">₪{Number(window.revenue).toLocaleString("en-IL", { maximumFractionDigits: 0 })}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-bold tracking-[.18em] text-clay uppercase">Latest orders</h2>
        {recent.length === 0 ? (
          <p className="mt-5 text-sm text-ink/55">No orders yet.</p>
        ) : (
          <>
            {/* A table is unreadable on a phone, so below sm each order is a card. */}
            <ul className="mt-5 space-y-3 sm:hidden">
              {recent.map((order) => (
                <li key={String(order.id)} className="rounded-2xl border border-ink/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">#{String(order.order_number)} · {String(order.customer_name || "—")}</p>
                      <p className="mt-0.5 truncate text-xs text-ink/55">{String(order.shabbos_label || "—")}</p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums">₪{Number(String(order.total).replace(/[^0-9.]/g, "")).toFixed(0)}</p>
                  </div>
                  <span className="mt-3 inline-block rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">{String(order.status)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-ink/10 bg-white sm:block">
              <table className="w-full text-sm">
                <thead className="border-b border-ink/10 text-left text-xs tracking-wider text-ink/50 uppercase">
                  <tr>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">For</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => (
                    <tr key={String(order.id)} className="border-b border-ink/5 last:border-0">
                      <td className="px-5 py-3 font-semibold">#{String(order.order_number)}</td>
                      <td className="px-5 py-3">{String(order.customer_name || "—")}</td>
                      <td className="px-5 py-3 text-ink/65">{String(order.shabbos_label || "—")}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">{String(order.status)}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">₪{Number(String(order.total).replace(/[^0-9.]/g, "")).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, href, warn }: { label: string; value: string; href?: string; warn?: boolean }) {
  const body = (
    <div className={`rounded-2xl border bg-white p-5 ${warn ? "border-clay" : "border-ink/10"}`}>
      <p className="text-xs font-bold tracking-wider text-ink/50 uppercase">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${warn ? "text-clay" : ""}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href} className="focus-ring block">{body}</Link> : body;
}
