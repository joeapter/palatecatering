const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const {
    customer,
    items = [],
    total = '',
    shabbosLabel = '',
    allergies = '',
    emailBody = '',
    htmlBody = '',
    pdfDataUrl = ''
  } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASS;
  const to = process.env.ORDER_TO || '';
  const cc = process.env.ORDER_CC || '';
  const fromName = process.env.ORDER_FROM_NAME || 'Palate Catering';
  const replyTo = process.env.ORDER_REPLY_TO || customer?.email || '';

  if (!user || !pass || !to) {
    res.status(500).send('Email env vars missing');
    return;
  }

  let attachment;
  if (pdfDataUrl && typeof pdfDataUrl === 'string' && pdfDataUrl.startsWith('data:application/pdf')) {
    const base64 = pdfDataUrl.split(',')[1];
    attachment = {
      filename: 'palate-order.pdf',
      content: Buffer.from(base64, 'base64'),
      contentType: 'application/pdf'
    };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });

  const safeHtmlBody = (htmlBody || '').trim();
  const safeTextBody = (emailBody || '').trim();
  const fallbackHtml = safeHtmlBody || `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;">${safeTextBody.replace(/</g,"&lt;")}</pre>`;

  const staffMail = {
    from: `${fromName} <${user}>`,
    to,
    cc,
    replyTo,
    subject: `New Palate Shabbos Order — ${shabbosLabel || 'New Order'}`,
    text: safeTextBody || undefined,
    html: fallbackHtml,
    attachments: attachment ? [attachment] : []
  };

  const mails = [transporter.sendMail(staffMail)];

  if (customer && customer.email) {
    mails.push(
      transporter.sendMail({
        from: `${fromName} <${user}>`,
        to: customer.email,
        replyTo,
        subject: `Your Palate Shabbos Order — ${shabbosLabel || ''}`,
        text: safeTextBody || undefined,
        html: fallbackHtml,
        attachments: attachment ? [attachment] : []
      })
    );
  }

  try {
    await Promise.all(mails);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Email send error', err);
    res.status(500).send('Email failed');
  }
};
