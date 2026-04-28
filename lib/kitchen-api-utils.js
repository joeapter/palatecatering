function parseJsonBody(req) {
  const body = req ? req.body : null;
  if (!body) return {};
  if (typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  const raw = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function parsePositiveInteger(value) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function normalizeText(value, { maxLength = 2000, allowEmpty = false } = {}) {
  if (value === undefined || value === null) return allowEmpty ? '' : null;
  const text = String(value).trim();
  if (!text && !allowEmpty) return null;
  return text.slice(0, maxLength);
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  parseJsonBody,
  parsePositiveInteger,
  normalizeText,
  isHttpUrl
};
