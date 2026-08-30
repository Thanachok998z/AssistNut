# Electricity LINE OA

Current mode: receives LINE text messages and returns a Flex Message only. No user, meter, or bill data is stored.

## Start

```powershell
npm start
```

For Vercel, set `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` in **Project Settings → Environment Variables**, then deploy. Set the Vercel HTTPS address plus `/api/line/webhook` as the **Webhook URL** in LINE Developers, then enable **Use webhook**. The endpoint verifies each `x-line-signature` using `LINE_CHANNEL_SECRET`.

`GET /health` is available for a simple uptime check.
