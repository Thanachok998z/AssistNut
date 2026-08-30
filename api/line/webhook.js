const crypto = require('node:crypto');

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

function flexMessage(command) {
  return {
    type: 'flex',
    altText: 'Electricity Assistant พร้อมตอบกลับแล้ว',
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#0E7490', paddingAll: '20px',
        contents: [
          { type: 'text', text: '⚡ Electricity Assistant', color: '#FFFFFF', weight: 'bold', size: 'lg' },
          { type: 'text', text: 'โหมดทดสอบการตอบกลับ', color: '#CFFAFE', size: 'sm', margin: 'sm' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: 'รับคำสั่งเรียบร้อย', weight: 'bold', size: 'md', color: '#0F172A' },
          { type: 'text', text: command.trim() || '—', wrap: true, color: '#334155', size: 'sm' },
          { type: 'separator' },
          { type: 'text', text: 'ขณะนี้เป็นโหมดทดสอบ จึงยังไม่มีการบันทึกมิเตอร์หรือบิล', wrap: true, size: 'sm', color: '#64748B' }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', contents: [
          { type: 'button', style: 'primary', color: '#0891B2', action: { type: 'message', label: 'ลอง จดไฟ 1234.5', text: 'จดไฟ 1234.5' } }
        ]
      }
    }
  };
}

async function reply(replyToken, message) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages: [message] })
  });
  if (!response.ok) throw new Error(`LINE reply failed (${response.status})`);
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
        await reply(event.replyToken, flexMessage(event.message.text));
      }
    }));
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
