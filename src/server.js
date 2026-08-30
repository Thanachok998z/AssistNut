const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

loadEnvFile(path.join(process.cwd(), '.env'));

const port = Number(process.env.PORT || 3000);
const channelSecret = process.env.LINE_CHANNEL_SECRET;
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!channelSecret || !channelAccessToken) {
  throw new Error('LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN are required.');
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function verifySignature(body, signature) {
  const expected = crypto.createHmac('sha256', channelSecret).update(body).digest('base64');
  if (!signature) return false;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function testFlex(text) {
  const command = text.trim() || '—';
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
          { type: 'text', text: command, wrap: true, color: '#334155', size: 'sm' },
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
      Authorization: `Bearer ${channelAccessToken}`
    },
    body: JSON.stringify({ replyToken, messages: [message] })
  });
  if (!response.ok) throw new Error(`LINE reply failed (${response.status}): ${await response.text()}`);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', mode: 'reply-only-test' }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/api/line/webhook') {
    res.writeHead(404); res.end('Not found'); return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  if (!verifySignature(body, req.headers['x-line-signature'])) {
    res.writeHead(401); res.end('Invalid signature'); return;
  }
  res.writeHead(200); res.end('OK');
  try {
    const payload = JSON.parse(body.toString('utf8'));
    for (const event of payload.events || []) {
      if (event.type === 'message' && event.message?.type === 'text' && event.replyToken) {
        await reply(event.replyToken, testFlex(event.message.text));
      }
    }
  } catch (error) {
    console.error('Webhook processing error:', error.message);
  }
});

server.listen(port, () => console.log(`LINE test webhook listening on http://localhost:${port}`));
