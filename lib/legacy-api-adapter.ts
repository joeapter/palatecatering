/**
 * Runs the original Vercel serverless handlers (root `api/*.js`) inside Next.js
 * route handlers.
 *
 * Those files were written against the `(req, res)` Node signature and were
 * served by Vercel's zero-config function runtime. Once `vercel.json` declared
 * `"framework": "nextjs"`, Next.js took ownership of `/api/*` and every one of
 * them started returning 404 — which silently broke both the new checkout and
 * the legacy HTML pages that fetch `/api/products`.
 *
 * Rewriting ~2,000 lines of working order/email/PDF/kitchen logic would have
 * been the riskier option, so this shims the two objects they expect instead.
 * There is still exactly one implementation of the order pipeline.
 */

type LegacyHandler = (req: LegacyRequest, res: LegacyResponse) => unknown;

type LegacyRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  socket: { remoteAddress: string };
};

type LegacyResponse = {
  status: (code: number) => LegacyResponse;
  setHeader: (key: string, value: string) => void;
  json: (payload: unknown) => void;
  send: (payload: unknown) => void;
  end: (payload?: unknown) => void;
};

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
}

/** Vercel's runtime pre-parsed JSON bodies, so the handlers expect an object. */
async function parseBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const contentType = request.headers.get("content-type") || "";
  const raw = await request.text();
  if (!raw) return undefined;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return raw;
}

export async function runLegacyHandler(
  handler: LegacyHandler,
  request: Request,
  extraQuery: Record<string, string> = {},
): Promise<Response> {
  const url = new URL(request.url);

  const req: LegacyRequest = {
    method: request.method,
    // Handlers do `new URL(req.url, 'http://' + req.headers.host)`, so this must
    // stay a path-plus-query, not an absolute URL.
    url: url.pathname + url.search,
    headers: Object.fromEntries(
      [...request.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]),
    ),
    query: { ...Object.fromEntries(url.searchParams.entries()), ...extraQuery },
    body: await parseBody(request),
    socket: { remoteAddress: clientIp(request) },
  };

  let statusCode = 200;
  const headers = new Headers();
  let settled = false;
  let resolveDone: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let payload: BodyInit | null = null;

  const finish = (value?: unknown) => {
    if (settled) return;
    settled = true;
    if (value === undefined || value === null) {
      payload = null;
    } else if (typeof value === "string") {
      payload = value;
    } else if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      // PDF/binary responses (kitchen job PDFs) come through here.
      payload = new Uint8Array(value as Uint8Array);
    } else {
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
      payload = JSON.stringify(value);
    }
    resolveDone();
  };

  const res: LegacyResponse = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(key: string, value: string) {
      headers.set(key, value);
    },
    json(value: unknown) {
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
      finish(typeof value === "string" ? value : JSON.stringify(value));
    },
    send(value: unknown) {
      finish(value);
    },
    end(value?: unknown) {
      finish(value);
    },
  };

  try {
    await handler(req, res);
  } catch (error) {
    console.error("Legacy handler threw", error);
    if (!settled) {
      statusCode = 500;
      finish("Server Error");
    }
  }

  // A handler may respond from inside a callback it did not await.
  if (!settled) {
    await Promise.race([
      done,
      new Promise<void>((resolve) => setTimeout(resolve, 25_000)),
    ]);
  }
  if (!settled) {
    statusCode = 504;
    finish("Legacy handler did not respond");
  }

  return new Response(payload, { status: statusCode, headers });
}
