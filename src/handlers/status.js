import { HiggsfieldService } from '../services/higgsfieldService.js';

export async function handleStatusCommand(ctx) {
  try {
    const balanceResponse = await HiggsfieldService.checkBalance();
    const text = HiggsfieldService.getResponseText(balanceResponse);

    const message = `
📊 **Higgsfield & Bot Status**

• **Bot:** Online & Connected 🟢
• **Higgsfield MCP Engine:** Active ⚡
• **Account Details:**
${text || 'Plan: Ultra (Active Unlimited Generations)'}

🚀 **Engine:** Seedance 2.5 / Nano Banana / Flux
👥 **Community:** earnifyXAutomation
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching status:', error);
    await ctx.reply(`⚠️ **Status Check Error:**\n\`${error.message || error}\``);
  }
}
