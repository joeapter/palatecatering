(function () {
  const DEFAULT_ENDPOINT = "/api/abandoned-carts";
  const DEFAULT_DELAY = 1200;

  function normalizeSource(value) {
    return String(value || "cart").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/(^-|-$)/g, "") || "cart";
  }

  function generateCartId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().replace(/-/g, "");
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }

  function safePayload(value) {
    return value && typeof value === "object" ? { ...value } : {};
  }

  function getItems(payload) {
    return Array.isArray(payload.items) ? payload.items : [];
  }

  function compactSignature(body) {
    const payload = body.payload || {};
    const customer = payload.customer || {};
    return JSON.stringify({
      cartId: body.cartId,
      status: body.status,
      source: body.source,
      total: payload.total || "",
      label: payload.shabbosLabel || "",
      customer: {
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        deliveryType: customer.deliveryType || ""
      },
      items: getItems(payload).map((item) => ({
        title: item.title || item.item || "",
        soldBy: item.soldBy || "",
        price: item.price || 0,
        quantity: item.quantity || item.qty || 1
      })),
      allergies: payload.allergies || "",
      notes: payload.notes || payload.deliveryNotes || ""
    });
  }

  function createTracker(options) {
    const source = normalizeSource(options && options.source);
    const endpoint = (options && options.endpoint) || DEFAULT_ENDPOINT;
    const delay = Number(options && options.delay) > 0 ? Number(options.delay) : DEFAULT_DELAY;
    const orderKey = (options && options.orderKey) || "";
    const getPayload = typeof options?.getPayload === "function" ? options.getPayload : () => ({});
    const storageKey = (options && options.storageKey) || `palate_abandoned_cart_${source}`;
    const snapshotKey = `${storageKey}_snapshot`;
    let cartId = "";
    let timer = null;
    let lastSignature = "";

    try {
      cartId = localStorage.getItem(storageKey) || "";
    } catch (_err) {
      cartId = "";
    }

    function saveCartId(id) {
      cartId = id;
      try {
        localStorage.setItem(storageKey, id);
      } catch (_err) {
        // localStorage can be unavailable in private browsing; the in-memory id still works for this page.
      }
      return cartId;
    }

    function ensureCartId() {
      return cartId || saveCartId(generateCartId());
    }

    function clear() {
      cartId = "";
      lastSignature = "";
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(snapshotKey);
      } catch (_err) {
        // Ignore storage cleanup failures.
      }
    }

    function persistSnapshot(body) {
      if (!body) return;
      try {
        if (body.status === "emptied") {
          localStorage.removeItem(snapshotKey);
        } else {
          localStorage.setItem(snapshotKey, JSON.stringify(body.payload || {}));
        }
      } catch (_err) {
        // Ignore local snapshot failures; remote autosave can still work.
      }
    }

    function getSnapshot() {
      try {
        const raw = localStorage.getItem(snapshotKey);
        return raw ? JSON.parse(raw) : null;
      } catch (_err) {
        return null;
      }
    }

    function buildBody(status, payloadOverride) {
      const payload = safePayload(payloadOverride || getPayload());
      const items = getItems(payload);
      if (!items.length && !cartId) {
        return null;
      }
      const id = items.length ? ensureCartId() : cartId;
      if (!id) {
        return null;
      }
      const normalizedStatus = items.length ? (status || "open") : "emptied";
      payload.cartId = id;
      payload.source = payload.source || source;
      payload.pageUrl = payload.pageUrl || window.location.href;
      return {
        cartId: id,
        source,
        status: normalizedStatus,
        pageUrl: window.location.href,
        payload
      };
    }

    async function send(status, sendOptions) {
      const opts = sendOptions || {};
      const body = opts.body || buildBody(status, opts.payload);
      if (!body) {
        return false;
      }
      persistSnapshot(body);
      const signature = compactSignature(body);
      if (!opts.force && signature === lastSignature) {
        return false;
      }
      lastSignature = signature;

      const headers = { "Content-Type": "application/json" };
      if (orderKey) {
        headers["x-order-key"] = orderKey;
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          keepalive: Boolean(opts.keepalive)
        });
        if (response.ok && body.status === "emptied") {
          clear();
        }
        return response.ok;
      } catch (err) {
        if (opts.logErrors !== false) {
          console.warn("Cart autosave failed", err);
        }
        return false;
      }
    }

    function schedule(status) {
      window.clearTimeout(timer);
      const body = buildBody(status || "open");
      persistSnapshot(body);
      timer = window.setTimeout(() => {
        timer = null;
        send(status || "open", { body, logErrors: false });
      }, delay);
    }

    function flush(status) {
      window.clearTimeout(timer);
      timer = null;
      return send(status || "open", { force: true, keepalive: true, logErrors: false });
    }

    function trackCheckoutStarted(payload) {
      return send("checkout_started", { payload, force: true });
    }

    window.addEventListener("pagehide", () => {
      if (timer) {
        flush("open");
      }
    });

    return {
      clear,
      flush,
      getCartId: ensureCartId,
      getSavedPayload: getSnapshot,
      getSnapshot,
      peekCartId: () => cartId,
      schedule,
      trackCheckoutStarted
    };
  }

  window.PalateAbandonedCart = { createTracker };
})();
