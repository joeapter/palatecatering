const Stripe = require("stripe");

const { STRIPE_SECRET_KEY = "", ORDER_API_KEY = "" } = process.env;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" }) : null;

function getLineQuantity(item) {
  const qty = Number(item?.qty ?? item?.quantity ?? 1);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.floor(qty);
}

function getLinePrice(item) {
  const price = Number(item?.price ?? item?.unit_price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return price;
}

function toMetadataValue(value, max = 500) {
  const text = (value ?? "").toString();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 3)) + "...";
}

function buildIntentMetadata(body, items) {
  const itemCount = items.reduce((sum, item) => sum + getLineQuantity(item), 0);
  const itemTitles = items
    .map(item => (item?.title || item?.item || "").toString().trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  return {
    // Keep metadata values well below Stripe's 500-char limit.
    order_label: toMetadataValue(body?.shabbosLabel || "", 120),
    customer_email: toMetadataValue(body?.customer?.email || "", 200),
    item_count: String(itemCount || items.length || 0),
    items_preview: toMetadataValue(itemTitles, 180),
    metadata_format: "compact_v2"
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const providedKey = req.headers["x-order-key"] || req.headers["x-api-key"] || "";
  if (ORDER_API_KEY && providedKey !== ORDER_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!stripe) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  const declaredTotal = Number(body.total || 0);
  const computedTotal = items.reduce((sum, item) => {
    return sum + getLinePrice(item) * getLineQuantity(item);
  }, 0);
  const total = declaredTotal > 0 ? declaredTotal : computedTotal;

  if (!(total > 0)) {
    return res.status(400).json({ error: "No priced items in cart" });
  }

  const amount = Math.round(total * 100);
  if (!(amount > 0)) {
    return res.status(400).json({ error: "Calculated payment amount is invalid" });
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "ils",
      metadata: buildIntentMetadata(body, items),
      payment_method_types: ["card"],
      description: "Palate Catering Order",
      statement_descriptor_suffix: "PalateOrder"
    });
    return res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error("Stripe intent error", err);
    return res.status(500).json({ error: err?.message || "Unable to create payment intent" });
  }
};
