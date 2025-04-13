import express from "express";
import { logger } from "./utils/logger.js";
import { WhatsAppClient } from "./client/whatsappClient.js";
import { WhatsAppService } from "./services/whatsappService.js";
import { createWhatsAppRoutes } from "./routes/whatsappRoutes.js";
import { WhatsAppController } from "./controllers/whatsappController.js";

export const createApp = () => {
  const app = express();
  const client = new WhatsAppClient();
  const service = new WhatsAppService(client);
  const controller = new WhatsAppController(service);

  // Middleware
  app.use(express.json());
  
  // Ganti ini:
  // app.use(logger);
  // Dengan middleware logging custom:
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
  });

  // Routes
  app.use("/api", createWhatsAppRoutes(controller));

  // Initialize WhatsApp connection
  client.connect();

  return app;
};