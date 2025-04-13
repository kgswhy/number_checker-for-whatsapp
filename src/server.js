import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info("Initializing WhatsApp connection...");
}); 