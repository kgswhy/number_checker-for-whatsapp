import {
    makeWASocket,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    Browsers,
    makeCacheableSignalKeyStore,
  } from "@whiskeysockets/baileys";
  import { Boom } from '@hapi/boom';
  import { logger } from "../utils/logger.js";
  import { createStore } from "../config/store.js";
  
  export class WhatsAppClient {
    constructor() {
      this.status = "disconnected";
      this.store = createStore();
      this.sock = null;
    }
  
    async connect() {
      try {
        const { state, saveCreds } = await useMultiFileAuthState("baileys_auth_info");
        const { version } = await fetchLatestBaileysVersion();
  
        this.sock = makeWASocket({
          version,
          printQRInTerminal: true,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
          },
          browser: Browsers.macOS("Chrome"),
          generateHighQualityLinkPreview: true,
        });
  
        this.store.bind(this.sock.ev);
  
        this.sock.ev.on("connection.update", this.handleConnectionUpdate.bind(this));
        this.sock.ev.on("creds.update", saveCreds);
  
        return this.sock;
      } catch (error) {
        logger.error("Connection error:", error);
        throw error;
      }
    }
  
    handleConnectionUpdate(update) {
      const { connection, lastDisconnect } = update;
      logger.info("Connection Update:", update);
  
      if (connection === "open") {
        this.status = "connected";
        logger.info("Successfully connected to WhatsApp");
      }
  
      if (connection === "close") {
        this.status = "disconnected";
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        logger.error(`Connection closed: ${reason}`);
  
        setTimeout(() => {
          logger.info("Attempting reconnect...");
          this.connect();
        }, 5000);
      }
    }
  
    getStatus() {
      return {
        status: this.status,
        isConnected: this.status === "connected",
        timestamp: new Date().toISOString(),
      };
    }
  
    async checkNumber(number) {
      if (!this.sock || this.status !== "connected") {
        throw new Error("WhatsApp connection not ready");
      }
  
      const [result] = await this.sock.onWhatsApp(number);
      return {
        exists: result?.exists,
        jid: result?.jid,
        isBusiness: result?.isBusiness,
      };
    }
  }