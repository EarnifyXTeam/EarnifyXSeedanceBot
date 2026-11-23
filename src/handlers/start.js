import { InlineKeyboard } from 'grammy';

export async function handleStart(ctx) {
  const userName = ctx.from?.first_name || 'Creator';

  const welcomeMessage = `
👋 <b>Welcome, ${userName}!</b>

Main hoon <b>EarnifyXSeedanceBot</b>, powered by <b>Seedance 2.5</b> & <b>Higgsfield MCP</b>! 🚀

⚠️ <b>IMPORTANT RULES & DISCLAIMER (Zaroori Niyam):</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ <b>No Guarantee:</b> <i>Video kitna banega, kaisa banega ya kitna chalega iski koi guarantee nahi hogi.</i>
2️⃣ <b>Risk Disclaimer:</b> <i>Soch-samajh ke hi aapko apna paisa dalna hai. Kisi bhi tarah ke issue ke liye <b>Admin ki koi jimmedari nahi hogi</b>.</i>
3️⃣ <b>No Refund:</b> <i>Services digital hain, isliye kisi bhi condition me refund nahi hoga.</i>
4️⃣ <b>Free Trial:</b> <i>Aapko <b>1 Video 100% Free</b> trial milta hai taaki aap quality check kar sakein! Uske baad chhota sa payment karna hoga.</i>
5️⃣ <b>Video Specs:</b> <i>Default vertical <b>9:16</b> (Reels/Shorts) aur 4s se lekar <b>30 seconds</b> tak generate ho sakta hai!</i>
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ <b>Quick Commands:</b>
🎬 <code>/video &lt;prompt&gt;</code> — Seedance 2.5 AI Video (Ya seedhe prompt type karein)
💳 <code>/buy</code> — Buy VIP Plan ($1.00 Unlimited)
📊 <code>/status</code> — Apna balance & credits check karein
ℹ️ <code>/help</code> — Video prompt guide

Niche diye gaye button par click karke shuru karein! 👇
  `.trim();

  const keyboard = new InlineKeyboard()
    .text('🎬 Generate Video', 'btn_video_help')
    .text('💎 Buy VIP Plan ($1.00)', 'btn_back_plans')
    .row()
    .text('📊 Check Status', 'btn_status')
    .text('ℹ️ Prompt Guide', 'btn_help')
    .row()
    .url('🚀 EarnifyX Automation', 'https://t.me/EarnifyXAutomationIN')
    .url('💬 Community', 'https://t.me/EarnifyXCommunity');

  await ctx.reply(welcomeMessage, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}
