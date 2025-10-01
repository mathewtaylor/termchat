/**
 * Welcome message and ASCII art banner for TermChat
 */

import { VERSION } from './version';

/**
 * Get the intro banner with ASCII art
 */
export function getIntroBanner(): string {
  return `    ╔╦╗╔═╗╦═╗╔╦╗  ╔═╗╦ ╦╔═╗╔╦╗
     ║ ║╣ ╠╦╝║║║  ║  ╠═╣╠═╣ ║
     ╩ ╚═╝╩╚═╩ ╩  ╚═╝╩ ╩╩ ╩ ╩

🤖 Chat with AI from your terminal

Welcome to TermChat v${VERSION}!
Type your message below or /help for commands.`;
}
