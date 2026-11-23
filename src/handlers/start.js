import { InlineKeyboard } from 'grammy';
import { UserService } from '../services/userService.js';
import { ActivityService } from '../services/activityService.js';

export async function handleStart(ctx) {
  const userName = ctx.from?.first_name || 'Creator';
  const startPayload = ctx.match || '';

  // Extract referral ID if present (e.g. /start ref_7150803046 or /start 7150803046)
  let referrerId = null;
  const refMatch = startPayload.match(/(?:ref_)?(\d+)/);
  if (refMatch) {
    referrerId = refMatch[1];
  }

  // Register user and track new joins + referrals
  const regResult = UserService.registerUser(ctx.from, referrerId);

  if (regResult?.isNew) {
    ActivityService.recordUserJoin({
      userId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
    });

    const refText = regResult.referrerId ? `\n• <b>Referred By:</b> <code>${regResult.referrerId}</code>` : '';

    await ActivityService.notifyAdmin(
      ctx.api,
      `👤 <b>New Member Joined Bot!</b>\n\n` +
      `• <b>Name:</b> ${ctx.from.first_name || 'N/A'}\n` +
      `• <b>Username:</b> @${ctx.from.username || 'none'}\n` +
      `• <b>User ID:</b> <code>${ctx.from.id}</code>${refText}\n` +
      `• <b>Total Members:</b> ${UserService.getTotalUsers()}`
    );

    // Notify Referrer if reward triggered
    if (regResult.referrerId && regResult.referralReward) {
      try {
        const stats = UserService.getReferralStats(regResult.referrerId);
        if (regResult.referralReward === 'vip') {
          await ctx.api.sendMessage(
            regResult.referrerId,
            `💎 <b>CONGRATULATIONS! VIP UNLOCKED!</b> 🎉\n\n` +
            `Aapke referral link se <b>${userName}</b> ne bot join kiya!\n` +
            `Aapne <b>5 Referrals</b> complete kar liye hain.\n\n` +
            `🚀 <b>LIFETIME UNLIMITED VIP ACCESS</b> activate ho gaya hai! Ab jitna chahe utna video banayein bina kisi limit ke!`,
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.api.sendMessage(
            regResult.referrerId,
            `🎉 <b>New Referral Joined!</b>\n\n` +
            `Aapke link se <b>${userName}</b> ne bot join kiya.\n` +
            `🎁 Aapko mila <b>+1 Free Video Pass</b>!\n\n` +
            `👥 <b>Aapke Referrals:</b> ${stats.referralCount}/5\n` +
            `🎯 <i>Sirf ${stats.remainingForVip} referral aur chahiye Lifetime Unlimited VIP unlock karne ke liye!</i>`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (err) {
        // Suppress message failure if user blocked bot
      }
    }
  }

  const welcomeMessage = `
👋 <b>Welcome, ${userName}!</b>

Main hoon <b>EarnifyXSeedanceBot</b>, powered by <b>Seedance 2.5</b> & <b>Higgsfield MCP</b>! 🚀

⚠️ <b>IMPORTANT RULES & DISCLAIMER (Zaroori Niyam):</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ <b>No Guarantee:</b> <i>Video kitna banega, kaisa banega ya kitna chalega iski koi guarantee nahi hogi.</i>
2️⃣ <b>Risk Disclaimer:</b> <i>Soch-samajh ke hi aapko apna paisa dalna hai. Kisi bhi tarah ke issue ke liye <b>Admin ki koi jimmedari nahi hogi</b>.</i>
3️⃣ <b>No Refund:</b> <i>Services digital hain, isliye kisi bhi condition me refund nahi hoga.</i>
4️⃣ <b>Free Trial:</b> <i>Aapko <b>1 Video 100% Free</b> trial milta hai taaki aap quality check kar sakein!</i>
5️⃣ <b>Refer & Earn:</b> <i>5 dosto ko refer karein aur paayein <b>Lifetime VIP Unlimited Access</b> bilkul Free!</i>
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ <b>Quick Commands:</b>
🎬 <code>/video &lt;prompt&gt;</code> — Seedance 2.5 AI Video (Ya seedhe prompt bhejein)
🎁 <code>/refer</code> — Invite Friends & Get Free VIP
💳 <code>/buy</code> — Buy VIP Plan ($0.50 Unlimited)
🔴 <code>/proof</code> — Live Community Activity & Delivery Proof
📊 <code>/status</code> — Balance, Referrals & GPU queue status

Niche diye gaye button par click karke shuru karein! 👇
  `.trim();

  const keyboard = new InlineKeyboard()
    .text('🎬 Generate Video', 'btn_video_help')
    .text('🎁 Refer & Earn VIP', 'btn_refer')
    .row()
    .text('💎 Buy VIP Plan ($0.50)', 'btn_back_plans')
    .text('🔴 Live Proof', 'btn_live_proof')
    .row()
    .text('📊 Check Status', 'btn_status')
    .text('ℹ️ Prompt Guide', 'btn_help');

  await ctx.reply(welcomeMessage, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Handle /refer Command & Referral Dashboard
 */
export async function handleReferCommand(ctx) {
  const userId = ctx.from?.id;
  const botInfo = ctx.me || await ctx.api.getMe();
  const botUsername = botInfo.username || 'EarnifyXSeedanceBot';
  const refLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const stats = UserService.getReferralStats(userId);
  const shareText = encodeURIComponent(
    `🔥 Seedance 2.5 AI se realistic 30s videos generate karo bilkul free! 🚀\n\nLink par click karke turant try karo:\n${refLink}`
  );

  const statusBadge = stats.isVip
    ? '💎 <b>LIFETIME VIP UNLIMITED ACTIVE!</b> 🎉'
    : `🎯 <b>${stats.referralCount} / 5 Referrals Completed</b> (${stats.remainingForVip} remaining for VIP)`;

  const msg = `
🎁 <b>EarnifyX Refer & Earn Program</b>
━━━━━━━━━━━━━━━━━━━━━━
<i>"Jitna chahe utna video banao! Koi limit ya credit ka jhanjhat nahi!"</i> 🚀

🔥 <b>Rewards System:</b>
• <b>Har 1 Friend:</b> Aapko milega <b>+1 Free AI Video Pass</b>
• <b>Sirf 5 Friends:</b> Paayein <b>LIFETIME UNLIMITED VIP ACCESS</b> bilkul FREE! 💎

📊 <b>Aapka Referral Progress:</b>
${statusBadge}

🔗 <b>Aapka Personal Invite Link:</b>
<code>${refLink}</code>

💡 <i>Apne dosto ke sath yeh link share karein. Jaise hi wo bot join karenge, aapka reward turant add ho jayega!</i>
  `.trim();

  const keyboard = new InlineKeyboard()
    .url('🚀 Share on Telegram', `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${shareText}`)
    .row()
    .url('📱 Share on WhatsApp', `https://api.whatsapp.com/send?text=${shareText}`)
    .row()
    .text('🔄 Refresh Stats', 'btn_refer')
    .text('🔙 Main Menu', 'btn_main_menu');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: keyboard });
      return;
    } catch (e) { }
  }

  return ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
