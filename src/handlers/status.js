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

    let planStatus = '🎁 100% Free Lifetime Access (Unlimited Videos 🚀)';
    if (access.reason === 'admin') {
      planStatus = '👑 Super Admin (Unlimited Access)';
    } else if (access.reason === 'vip') {
      planStatus = '💎 VIP Creator (Priority GPU Access)';
    }

    const message = `
📊 <b>EarnifyX Account & System Status</b>

👤 <b>Aapka Plan:</b> ${planStatus}
🎬 <b>Generations Done:</b> ${UserService.getUser(userId)?.totalGenerations || 0} videos
👥 <b>Total Friends Invited:</b> ${refStats.referralCount} ${refStats.isVip ? '(💎 VIP Active)' : `(${refStats.remainingForVip} more for VIP Badge)`}

⚙️ <b>Server & GPU Status:</b>
• <b>Bot Engine:</b> Online & Ready 🟢
• <b>Active GPU Jobs:</b> ${qStatus.active} / ${qStatus.max} parallel slots
• <b>Tasks in Queue:</b> ${qStatus.queued} waiting
• <b>Registered Members:</b> ${totalUsers} creators

• <b>Higgsfield Ultra Engine:</b>
${text || 'Plan: Ultra 3K (Active Unlimited Generations)'}

✨ <i>100% Free Community Edition by EarnifyX</i>
    `.trim();

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh Status', 'btn_refresh_status')
      .text('🎁 Invite Friends', 'btn_refer')
      .row()
      .text('🎬 Generate Video', 'btn_video_help')
      .text('🔙 Main Menu', 'btn_main_menu');

    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery('Status updated!');
      } catch (e) { }
      try {
        await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: keyboard });
        return;
      } catch (e) { }
    }

    await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (error) {
    console.error('Error fetching status:', error);
    await ctx.reply(`⚠️ <b>Status Check Error:</b>\n<code>${error.message || error}</code>`, { parse_mode: 'HTML' });
  }
}
