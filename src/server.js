const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

loadEnvFile(path.join(process.cwd(), '.env'));

const webhookHandler = require('../api/line/webhook');
const port = Number(process.env.PORT || 3000);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const server = http.createServer(async (req, res) => {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };
  res.send = (body) => res.end(body);
  await webhookHandler(req, res);
});

server.listen(port, () => console.log(`LINE webhook listening on http://localhost:${port}`));
