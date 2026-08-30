const crypto = require('node:crypto');
const LINE_REPLY_API_URL = 'https://api.line.me/v2/bot/message/reply';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function validSignature(body, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64');
  const actual = Buffer.from(signature);
  const expectedValue = Buffer.from(expected);
  return actual.length === expectedValue.length && crypto.timingSafeEqual(actual, expectedValue);
}

function acknowledgementMessage() {
  return {
    type: 'text',
    text: 'ได้รับข้อความแล้วครับ ✅'
  };
}

async function reply(replyToken, message) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  console.info('LINE Reply API request:', {
    tokenExists: Boolean(accessToken),
    replyTokenExists: Boolean(replyToken),
    replyApiUrl: LINE_REPLY_API_URL
  });

  if (!accessToken) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is missing');
    return;
  }

  try {
    const response = await fetch(LINE_REPLY_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        replyToken,
        messages: [message]
      })
    });
    const responseBody = await response.text();
    if (!response.ok) {
      console.error('LINE Reply API error:', {
        status: response.status,
        responseBody,
        errorMessage: `LINE Reply API returned HTTP ${response.status}`
      });
    }
  } catch (error) {
    console.error('LINE Reply API error:', {
      status: 'N/A',
      responseBody: 'N/A',
      errorName: error.name,
      errorMessage: error.message,
      errorCause: error.cause
        ? {
            name: error.cause.name || 'UnknownError',
            message: error.cause.message || String(error.cause),
            code: error.cause.code || null
          }
        : null
    });
  }
}

async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', mode: 'reply-only-test' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await readRawBody(req);
    if (!validSignature(rawBody, req.headers['x-line-signature'])) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const payload = JSON.parse(rawBody.toString('utf8'));
    res.status(200).send('OK');
    await Promise.all((payload.events || []).map(async (event) => {
      if (event.type === 'message' && event.message?.type === 'text' && event.replyToken) {
        await reply(event.replyToken, acknowledgementMessage());
      }
    }));
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
