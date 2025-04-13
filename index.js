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
import chalk from 'chalk';
import { Boom } from "@hapi/boom";

const app = express();
const port = 3000;

// Middleware
app.use(express.json());

// WhatsApp connection variables
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
let sock = null;
let whatsappStatus = "disconnected";

// Helper function for colored console output
const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

// Connect to WhatsApp
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
    browser: Browsers.macOS("Chrome"),
    generateHighQualityLinkPreview: true,
  });

  store?.bind(sock.ev);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    console.log("Connection Update:", update);

    if (connection === "open") {
      whatsappStatus = "connected";
      console.log(color("✓ Connected to WhatsApp!", "green"));
    }

    if (connection === "close") {
      whatsappStatus = "disconnected";
      const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      console.log(color(`✗ Disconnected, reason: ${reason}`, "red"));
      
      setTimeout(() => {
        console.log("Attempting to reconnect...");
        connectToWhatsApp();
      }, 5000);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

// Initialize WhatsApp connection
connectToWhatsApp();

// API Endpoints
app.get('/status', (req, res) => {
  res.json({ 
    status: whatsappStatus,
    is_connected: whatsappStatus === "connected",
    timestamp: new Date().toISOString()
  });
});

app.post('/check-number', async (req, res) => {
  try {
    let attempts = 0;
    while (whatsappStatus !== "connected" && attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      console.log(`Waiting for WhatsApp connection... (${attempts}/15)`);
    }

    if (whatsappStatus !== "connected") {
      return res.status(503).json({ 
        success: false, 
        message: "WhatsApp connection not ready",
        status: whatsappStatus
      });
    }

    // Expecting only a single number here, not an array
    const { number } = req.body;

    if (!number) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a valid number in the request body" 
      });
    }

    console.log(`Checking number: ${number}`);

    const cleanNumber = number.toString().replace(/[^0-9]/g, "");

    if (!cleanNumber) {
      console.log(color(`Skipping invalid number: ${number}`, "yellow"));
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
      });
    }

    const [result] = await sock.onWhatsApp(`${cleanNumber}@s.whatsapp.net`);

    if (result?.exists) {
      console.log(color(`✓ ${cleanNumber} is active (jid: ${result.jid})`, "green"));
      return res.json({
        success: true,
        number: cleanNumber,
        status: 'active',
        jid: result.jid,
        isBusiness: result.isBusiness,
        connection_status: whatsappStatus
      });
    } else {
      console.log(color(`✗ ${cleanNumber} is inactive`, "red"));
      return res.json({
        success: true,
        number: cleanNumber,
        status: 'inactive',
        connection_status: whatsappStatus
      });
    }

  } catch (error) {
    console.error("Error in /check-number:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});


app.listen(port, () => {
  console.log(`WhatsApp Number Checker API running on http://localhost:${port}`);
  console.log("Waiting for WhatsApp connection...");
});