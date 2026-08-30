# Electricity LINE OA

The `จดไฟ 1234.5` command creates a user-specific pending meter record, displays a confirmation Flex Message, and saves the reading only after the user presses **ยืนยัน**. It uses PostgreSQL through `DATABASE_URL`.

## Start

```powershell
npm start
```

For Vercel, import the GitHub repository with its **Root Directory** set to `./`, then set `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, and `DATABASE_URL` in **Project Settings → Environment Variables** for Production. Deploy the `main` branch. Set the Vercel HTTPS address plus `/api/line/webhook` as the **Webhook URL** in LINE Developers, then enable **Use webhook**. The endpoint verifies each `x-line-signature` using `LINE_CHANNEL_SECRET`.

`GET /health` is available for a simple uptime check.
