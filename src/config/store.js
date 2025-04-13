import { makeInMemoryStore } from "@whiskeysockets/baileys";
import pino from "pino";

export const createStore = () => {
  return makeInMemoryStore({
    logger: pino().child({ level: "silent", stream: "store" }),
  });
};