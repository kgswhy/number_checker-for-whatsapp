// server.js
import express from 'express';
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  Browsers,
  makeInMemoryStore,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import pino from 'pino';
import cors from 'cors';
import { Boom } from "@hapi/boom";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WhatsApp connection setup
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
let sock = null;
let whatsappStatus = "disconnected";

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino()),
    },
    browser: Browsers.macOS("Chrome")
  });

  store?.bind(sock.ev);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log("QR Code generated");
      whatsappStatus = "qr_ready";
    }

    if (connection === "open") {
      whatsappStatus = "connected";
      console.log("✓ WhatsApp Connected!");
    }

    if (connection === "close") {
      whatsappStatus = "disconnected";
      const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      console.log(`Connection lost (reason: ${reason}), reconnecting...`);
      setTimeout(connectToWhatsApp, 5000);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// API Routes
app.get('/api/status', (req, res) => {
  res.json({ status: whatsappStatus });
});

app.post('/api/check-numbers', async (req, res) => {
  if (whatsappStatus !== "connected") {
    return res.status(503).json({ error: "WhatsApp not connected" });
  }

  try {
    const { numbers } = req.body;
    const results = { active: [], inactive: [] };

    for (const number of numbers) {
      const cleanNumber = number.toString().replace(/\D/g, '');
      if (!cleanNumber) continue;

      try {
        const [result] = await sock.onWhatsApp(`${cleanNumber}@s.whatsapp.net`);
        if (result?.exists) {
          results.active.push({
            number: cleanNumber,
            jid: result.jid,
            isBusiness: result.isBusiness
          });
        } else {
          results.inactive.push(cleanNumber);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error checking ${cleanNumber}:`, error);
        results.inactive.push(cleanNumber);
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
connectToWhatsApp();
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});