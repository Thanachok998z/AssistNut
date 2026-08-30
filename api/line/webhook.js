const crypto = require('node:crypto');
const { createPendingMeter, confirmPendingMeter, cancelPendingMeter } = require('../../src/electricity/meter-service');
const { meterConfirmationFlex } = require('../../src/electricity/flex');
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

function textMessage(text) {
  return {
    type: 'text',
    text
  };
}

async function reply(replyToken, messages) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  console.info('LINE Reply API request:', {
    tokenExists: Boolean(accessToken),
    replyTokenExists: Boolean(replyToken),
    replyApiUrl: LINE_REPLY_API_URL
  });

  if (!accessToken) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is missing');
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is missing');
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
        messages
      })
    });
    const responseBody = await response.text();
    console.log('LINE REPLY RESPONSE:', {
      status: response.status,
      ok: response.ok,
      body: responseBody
    });
    if (!response.ok) {
      const error = new Error(`LINE Reply API returned HTTP ${response.status}: ${responseBody}`);
      error.status = response.status;
      error.responseBody = responseBody;
      throw error;
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
    throw error;
  }
}

function parseMeterCommand(text) {
  const matched = /^จดไฟ(?:\s+(.*))?$/u.exec(text.trim());
  if (!matched) return null;
  const numberText = matched[1]?.trim();
  if (!numberText) return { valid: false, reason: 'missing' };
  if (!/^\d+(?:\.\d+)?$/.test(numberText)) return { valid: false, reason: 'invalid' };
  const meterReading = Number(numberText);
  return Number.isFinite(meterReading) && meterReading >= 0
    ? { valid: true, meterReading }
    : { valid: false };
}

async function processTextEvent(event) {
  const command = parseMeterCommand(event.message.text);
  if (!command) {
    await reply(event.replyToken, [textMessage('ได้รับข้อความแล้วครับ ✅')]);
    return;
  }
  if (!command.valid) {
    const message = command.reason === 'missing'
      ? '❌ กรุณาระบุเลขมิเตอร์\n\nตัวอย่าง:\nจดไฟ 1234.5'
      : '❌ กรุณาระบุเลขมิเตอร์ให้ถูกต้อง\n\nตัวอย่าง:\nจดไฟ 1234.5';
    await reply(event.replyToken, [textMessage(message)]);
    return;
  }

  let result;
  try {
    result = await createPendingMeter(event.source.userId, command.meterReading);
  } catch (error) {
    console.error('Meter pending creation error:', error.message);
    await reply(event.replyToken, [textMessage('❌ ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง')]);
    return;
  }
  if (result.kind === 'decreased') {
    await reply(event.replyToken, [textMessage('⚠️ ค่ามิเตอร์ครั้งนี้น้อยกว่าครั้งก่อน\nกรุณาตรวจสอบอีกครั้ง')]);
    return;
  }
  const { pending } = result;
  await reply(event.replyToken, [meterConfirmationFlex({
    meterReading: Number(pending.meter_reading),
    previousReading: pending.previous_reading === null ? null : Number(pending.previous_reading),
    usage: pending.usage === null ? null : Number(pending.usage),
    createdAt: pending.created_at
  })]);
}

async function processPostbackEvent(event) {
  const action = new URLSearchParams(event.postback.data).get('action');
  if (action === 'confirm_meter') {
    let result;
    try {
      result = await confirmPendingMeter(event.source.userId);
    } catch (error) {
      console.error('Meter confirmation error:', error.message);
      await reply(event.replyToken, [textMessage('❌ ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง')]);
      return;
    }
    await reply(event.replyToken, [textMessage(
      result.confirmed ? 'บันทึกมิเตอร์เรียบร้อยแล้ว ✅' : 'ไม่พบข้อมูลมิเตอร์ที่รอยืนยัน'
    )]);
  } else if (action === 'cancel_meter') {
    try {
      await cancelPendingMeter(event.source.userId);
    } catch (error) {
      console.error('Meter cancellation error:', error.message);
      await reply(event.replyToken, [textMessage('❌ ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง')]);
      return;
    }
    await reply(event.replyToken, [textMessage('ยกเลิกการบันทึกมิเตอร์แล้ว')]);
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
      console.log('LINE EVENT:', {
        type: event.type,
        messageType: event.message?.type,
        text: event.message?.text,
        hasReplyToken: Boolean(event.replyToken)
      });
      if (!event.source?.userId || !event.replyToken) return;
      if (event.type === 'message' && event.message?.type === 'text') await processTextEvent(event);
      if (event.type === 'postback') await processPostbackEvent(event);
    }));
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Webhook processing failed' });
    if (res.headersSent) throw error;
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
