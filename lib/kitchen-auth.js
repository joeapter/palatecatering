function normalizeBaseUrl(raw) {
  const value = (raw || '').toString().trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value.replace(/\/$/, '');
  }
  return `https://${value.replace(/\/$/, '')}`;
}

function getSiteBaseUrl(req) {
  const fromEnv = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_BASE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_URL ||
    ''
  );
  if (fromEnv) return fromEnv;

  const headers = (req && req.headers) || {};
  const host = (headers['x-forwarded-host'] || headers.host || '').toString().trim();
  if (!host) return '';
  const proto = (headers['x-forwarded-proto'] || '').toString().trim() || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`.replace(/\/$/, '');
}

function getKitchenTokenFromRequest(req) {
  const headers = (req && req.headers) || {};
  const headerToken = (headers['x-kitchen-token'] || '').toString().trim();
  if (headerToken) return headerToken;

  const authHeader = (headers.authorization || '').toString().trim();
  if (/^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }

  const queryToken = req && req.query && typeof req.query.token === 'string' ? req.query.token.trim() : '';
  return queryToken;
}

function requireKitchenToken(req, res) {
  const expected = (process.env.KITCHEN_QUEUE_TOKEN || '').trim();
  if (!expected) {
    res.status(500).json({ error: 'KITCHEN_QUEUE_TOKEN not configured' });
    return false;
  }

  const actual = getKitchenTokenFromRequest(req);
  if (!actual || actual !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

module.exports = {
  getSiteBaseUrl,
  requireKitchenToken
};
