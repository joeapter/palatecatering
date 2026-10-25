import { sql } from "@vercel/postgres";

/**
 * Feature flags and editable copy, read by Server Components.
 *
 * Both fall back to sensible defaults if the database is unavailable, so a
 * connection problem degrades to the shipped wording rather than an empty page.
 */

export type FeatureFlags = { packagesEnabled: boolean; holidaysEnabled: boolean };

export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const { rows } = await sql`
      SELECT key, value FROM site_settings
      WHERE key IN ('packages_enabled', 'holidays_enabled');
    `;
    const map = new Map(rows.map((row) => [row.key as string, row.value as string]));
    return {
      // Absent means on: a missing row should not hide part of the shop.
      packagesEnabled: map.get("packages_enabled") !== "false",
      holidaysEnabled: map.get("holidays_enabled") !== "false",
    };
  } catch {
    return { packagesEnabled: true, holidaysEnabled: true };
  }
}

export async function getSiteContent(): Promise<Record<string, string>> {
  try {
    const { rows } = await sql`SELECT key, value FROM site_content;`;
    return Object.fromEntries(rows.map((row) => [row.key as string, row.value as string]));
  } catch {
    return {};
  }
}

/** Reads one value with a fallback, so pages always render something sensible. */
export function text(content: Record<string, string>, key: string, fallback: string): string {
  const value = content[key];
  return value && value.trim() ? value : fallback;
}
