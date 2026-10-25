/**
 * Renders a JSON-LD block. Kept in one place so the escaping is consistent —
 * a stray "</script>" inside product copy would otherwise break out of the tag.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
