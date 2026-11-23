import { InlineKeyboard } from 'grammy';
import { HiggsfieldService } from '../services/higgsfieldService.js';
import { QueueService } from '../services/queueService.js';
import { UserService } from '../services/userService.js';
import { config } from '../config.js';

export async function handleStatusCommand(ctx) {
  try {
    const userId = ctx.from?.id;
    const balanceResponse = await HiggsfieldService.checkBalance();
    const text = HiggsfieldService.getResponseText(balanceResponse);
    const qStatus = QueueService.getStatus();
    const totalUsers = UserService.getTotalUsers();
    const access = UserService.checkAccess(userId);
    const refStats = UserService.getReferralStats(userId);

    let planStatus = '🎁 Free Trial (1 Video)';
    if (access.reason === 'admin') {
      planStatus = '👑 Super Admin (Unlimited Access)';
    } else if (access.reason === 'vip') {
      planStatus = '💎 VIP Plan (Unlimited Access)';
    } else if (access.reason === 'credits') {
      planStatus = `💳 Paid Plan (${access.remaining} Video Credits Remaining)`;
    } else {
      planStatus = '⚠️ Free Trial Exhausted (Plan Required to Generate)';
    }

    const message = `
📊 <b>EarnifyX Account & System Status</b>

👤 <b>Aapka Plan:</b> ${planStatus}
🎬 <b>Generations Done:</b> ${UserService.getUser(userId)?.totalGenerations || 0} videos
👥 <b>Total Referrals:</b> ${refStats.referralCount} ${refStats.isVip ? '(💎 VIP Active)' : `(${refStats.remainingForVip} more for Free VIP)`}

⚙️ <b>Server & GPU Status:</b>
• <b>Bot Engine:</b> Online & Ready 🟢
• <b>Active GPU Jobs:</b> ${qStatus.active} / ${qStatus.max} parallel slots
• <b>Tasks in Queue:</b> ${qStatus.queued} waiting
• <b>Registered Members:</b> ${totalUsers} creators

• <b>Higgsfield Ultra Engine:</b>
${text || 'Plan: Ultra 3K (Active Unlimited Generations)'}

⚠️ <b>RULES:</b> <i>Video kitna banega iski koi guarantee nahi hogi. Soch samajh kar funds dalein, admin ki koi jimmedari nahi hogi.</i>
    `.trim();

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh Status', 'btn_refresh_status')
      .text('🎁 Refer & Earn VIP', 'btn_refer')
      .row()
      .text('💎 Buy VIP ($0.50)', 'btn_back_plans')
      .text('🔙 Main Menu', 'btn_main_menu');

    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery('Status updated!');
      } catch (e) {}
      try {
        await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: keyboard });
        return;
      } catch (e) {}
    }

    await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (error) {
    console.error('Error fetching status:', error);
    await ctx.reply(`⚠️ <b>Status Check Error:</b>\n<code>${error.message || error}</code>`, { parse_mode: 'HTML' });
  }
}
