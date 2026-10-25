import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // These are loaded by the legacy CommonJS order pipeline and must not be
  // bundled. pdfkit in particular reads font metrics (.afm) from disk at
  // runtime; once bundled, that path is rewritten to a directory that does not
  // exist and every kitchen PDF fails with ENOENT.
  serverExternalPackages: ["pdfkit", "nodemailer"],
  // Launch cutover. These stay OFF until the new storefront has proven parity —
  // shabbos.html is still the shop that takes real orders, and redirecting it
  // early would take ordering down. Flip by setting LAUNCH_CUTOVER=true.
  // Permanent (308) so search engines move the equity to the new URLs; do not
  // enable until you are willing to keep the new URLs forever.
  async redirects() {
    if (process.env.LAUNCH_CUTOVER !== "true") return [];
    return [
      { source: "/shabbos.html", destination: "/shabbos", permanent: true },
      { source: "/rosh-hashanah.html", destination: "/holidays/rosh-hashanah", permanent: true },
      { source: "/dairy.html", destination: "/holidays", permanent: true },
      { source: "/shavuos.html", destination: "/holidays", permanent: true },
      { source: "/purim.html", destination: "/holidays", permanent: true },
      { source: "/bris.html", destination: "/catering", permanent: true },
      { source: "/Corporate-Catering.html", destination: "/catering", permanent: true },
      { source: "/kashrus.html", destination: "/kashrus", permanent: true },
      { source: "/thank-you.html", destination: "/thank-you", permanent: true },
    ];
  },
  async rewrites() {
    return [
      // Mirrors the vercel.json rewrite so `next dev` and production behave the
      // same way. The kitchen printer client calls these paths directly.
      {
        source: "/api/kitchen/:action(enqueue|next|report|job-pdf)",
        destination: "/api/order-status?__kitchen_action=:action",
      },
    ];
  },
};

export default nextConfig;
