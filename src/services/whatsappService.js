export class WhatsAppService {
    constructor(client) {
      this.client = client;
    }
  
    async checkNumberStatus(number) {
      try {
        const result = await this.client.checkNumber(number);
        return {
          success: true,
          number,
          ...result,
        };
      } catch (error) {
        throw new Error(`Error checking number: ${error.message}`);
      }
    }
  }