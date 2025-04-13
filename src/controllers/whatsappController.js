import { color } from "../utils/helpers.js";
import { logger } from "../utils/logger.js";

export class WhatsAppController {
  constructor(whatsappService) {
    this.service = whatsappService;
  }

  async getStatus(req, res) {
    try {
      const status = this.service.client.getStatus();
      res.json(status);
    } catch (error) {
      logger.error("Status check error:", error);
      res.status(503).json({
        success: false,
        message: "Failed to get status",
      });
    }
  }

  async checkNumber(req, res) {
    try {
      const { number } = req.body;
      if (!number) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      const result = await this.service.checkNumberStatus(number);
      logger.info(color(`✓ ${number} is ${result.exists ? "active" : "inactive"}`));
      
      res.json({
        ...result,
        connection_status: this.service.client.status,
      });
    } catch (error) {
      logger.error("Check number error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}