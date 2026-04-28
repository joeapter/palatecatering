function getUploadClient() {
  let fetchImpl = global.fetch;
  let FormDataImpl = global.FormData;
  if (!fetchImpl || !FormDataImpl) {
    try {
      const undici = require('undici');
      fetchImpl = fetchImpl || undici.fetch;
      FormDataImpl = FormDataImpl || undici.FormData;
    } catch (error) {
      return { fetchImpl: null, FormDataImpl: null };
    }
  }
  return { fetchImpl, FormDataImpl };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const adminKey = req.headers['x-admin-key'] || body.key || '';
  if (!process.env.ADMIN_PASSWORD || adminKey !== process.env.ADMIN_PASSWORD) {
    res.status(401).send('Unauthorized');
    return;
  }

  const dataUrl = body.dataUrl || '';
  if (!dataUrl.startsWith('data:image/')) {
    res.status(400).send('Invalid image data');
    return;
  }

  const commaIndex = dataUrl.indexOf(',');
  const base64Length = commaIndex === -1 ? 0 : dataUrl.length - commaIndex - 1;
  const bytes = Math.floor((base64Length * 3) / 4);
  const maxBytes = 6 * 1024 * 1024;
  if (bytes > maxBytes) {
    res.status(413).send('Image must be 6MB or less');
    return;
  }

  try {
    const uploadUrl = (process.env.VERCEL_UPLOAD_URL || '').trim();
    const uploadToken = (process.env.VERCEL_UPLOAD_TOKEN || '').trim();
    if (!uploadUrl || !uploadToken) {
      res.status(200).json({ url: dataUrl, inline: true });
      return;
    }

    const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!match) {
      res.status(400).send('Invalid image data');
      return;
    }
    const mimeType = match[1];
    const base64Data = match[2];
    const fileBuffer = Buffer.from(base64Data, 'base64');
    const sanitizedBase = (body.filename || 'product-image').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const extension = mimeType.split('/')[1]?.split('+')[0] || 'jpg';
    const filename = `${sanitizedBase || 'product'}-${Date.now()}.${extension}`;

    const { fetchImpl, FormDataImpl } = getUploadClient();
    if (!fetchImpl || !FormDataImpl) {
      res.status(200).json({ url: dataUrl, inline: true, warning: 'Upload client unavailable in this runtime' });
      return;
    }

    const form = new FormDataImpl();
    form.append('file', fileBuffer, filename);

    const targetUrl = `${uploadUrl.replace(/\/$/, '')}?token=${encodeURIComponent(uploadToken)}`;
    const response = await fetchImpl(targetUrl, {
      method: 'POST',
      body: form
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const errorMessage = typeof payload === 'string' ? payload : (payload?.error || 'Upload failed');
      console.error('Upload target error', payload);
      res.status(200).json({ url: dataUrl, inline: true, warning: errorMessage });
      return;
    }

    res.status(200).json(payload);
  } catch (error) {
    console.error('Product image upload error', error);
    res.status(200).json({ url: dataUrl, inline: true, warning: error?.message || 'Upload failed' });
  }
};
