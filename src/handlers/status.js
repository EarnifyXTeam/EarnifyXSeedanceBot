
import { HiggsfieldService } from '../services/higgsfieldService.js';
import { QueueService } from '../services/queueService.js';
import { UserService } from '../services/userService.js';

export async function handleStatusCommand(ctx) {
  try {
    const balanceResponse = await HiggsfieldService.checkBalance();
    const text = HiggsfieldService.getResponseText(balanceResponse);
    const qStatus = QueueService.getStatus();
    const totalUsers = UserService.getTotalUsers();

    const message = `
📊 **EarnifyX System Status**

• **Bot Engine:** Online & Polling 🟢
• **Active GPU Jobs:** ${qStatus.active} / ${qStatus.max} parallel slots
• **Tasks in Queue:** ${qStatus.queued} waiting
• **Registered Members:** ${totalUsers} creators

• **Higgsfield Ultra Plan:**
${text || 'Plan: Ultra 3K (Active Unlimited Generations)'}

🚀 **Engine:** Seedance 2.5 (Default: 9:16 Reels)
👥 **Community:** earnifyXAutomation
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching status:', error);
    await ctx.reply(`⚠️ **Status Check Error:**\n\`${error.message || error}\``);
  }
}
