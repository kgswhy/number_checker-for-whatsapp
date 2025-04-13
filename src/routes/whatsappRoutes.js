import { Router } from "express";
import { WhatsAppController } from "../controllers/whatsappController.js";

export const createWhatsAppRoutes = (controller) => {
  const router = Router();
  router.get("/status", controller.getStatus.bind(controller));
  router.post("/check-number", controller.checkNumber.bind(controller));
  return router;
};