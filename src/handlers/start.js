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

    // Non-blocking background notification to admin (keeps user response instant)
    ActivityService.notifyAdmin(
      ctx.api,
      `👤 <b>New Member Joined Bot!</b>\n\n` +
      `• <b>Name:</b> ${ctx.from.first_name || 'N/A'}\n` +
      `• <b>Username:</b> @${ctx.from.username || 'none'}\n` +
      `• <b>User ID:</b> <code>${ctx.from.id}</code>${refText}\n` +
      `• <b>Total Members:</b> ${UserService.getTotalUsers()}`
    ).catch(() => {});

    // Notify Referrer in background if reward triggered
    if (regResult.referrerId && regResult.referralReward) {
      (async () => {
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
        } catch (err) {}
      })().catch(() => {});
    }
  }

  const welcomeMessage = `
👋 <b>Welcome, ${userName}!</b>

Main hoon <b>EarnifyXSeedanceBot</b>, powered by <b>Seedance 2.5</b> & <b>Higgsfield MCP</b>! 🚀

🎉 <b>100% FREE AI VIDEO STUDIO FOR EVERYONE!</b>
Ab bina kisi payment ya credit recharge ke, aap directly ultra-realistic AI videos bana sakte hain!

⚠️ <b>FAIR USE RULES & GUIDELINES:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ <b>100% Free:</b> <i>Yeh bot poori community ke liye bilkul FREE hai!</i>
2️⃣ <b>Anti-Spam & Fair Queue:</b> <i>Ek time par ek hi video generate karein taaki sabhi users ka number barabar aaye.</i>
3️⃣ <b>Video Specs:</b> <i>Default vertical <b>9:16</b> (Reels/Shorts) aur 4s se lekar <b>30 seconds</b> tak generate ho sakta hai!</i>
4️⃣ <b>Invite & Share:</b> <i>Apne dosto ke sath invite link share karein aur VIP status paayein!</i>
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ <b>Quick Commands:</b>
🎬 <code>/video &lt;prompt&gt;</code> — Seedance 2.5 AI Video (Ya seedhe prompt bhejein)
🎁 <code>/refer</code> — Invite Friends & Grow Community
🔴 <code>/proof</code> — Live Community Activity & Delivery Proof
📊 <code>/status</code> — Balance, Referrals & GPU queue status

Niche diye gaye button par click karke shuru karein! 👇
  `.trim();

  const keyboard = new InlineKeyboard()
    .text('🎬 Generate Video', 'btn_video_help')
    .text('🎁 Invite Friends', 'btn_refer')
    .row()
    .text('🔴 Live Proof', 'btn_live_proof')
    .text('📊 Check Status', 'btn_status')
    .row()
    .text('ℹ️ Prompt Guide', 'btn_help')
    .url('💬 Community', 'https://t.me/EarnifyXCommunity');

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
    ? '💎 <b>VIP CREATOR STATUS ACTIVE!</b> 🎉'
    : `🎯 <b>${stats.referralCount} / 5 Friends Invited</b> (${stats.remainingForVip} remaining for VIP Badge)`;

  const msg = `
🎁 <b>EarnifyX Community Refer & Share Program</b>
━━━━━━━━━━━━━━━━━━━━━━
<i>"100% Free AI Video Studio for everyone! Apne dosto ke sath share karein!"</i> 🚀

🔥 <b>Community Benefits:</b>
• <b>Sabhi ke liye Free:</b> Har creator ko milta hai Unlimited Video Generation!
• <b>5 Dosto ko Invite Karein:</b> Paayein <b>VIP Creator Badge & Priority GPU Queue</b> 💎

📊 <b>Aapka Referral Progress:</b>
${statusBadge}

🔗 <b>Aapka Personal Invite Link:</b>
<code>${refLink}</code>

💡 <i>Apne dosto ke sath yeh link share karein aur unhe bhi free me AI video banana sikhayein!</i>
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
