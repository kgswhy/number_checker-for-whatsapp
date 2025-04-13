import chalk from "chalk";

export const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

export const validateNumber = (number) => {
  const cleanNumber = number.toString().replace(/[^0-9]/g, "");
  if (!cleanNumber) throw new Error("Invalid phone number format");
  return `${cleanNumber}@s.whatsapp.net`;
};