import { InlineKeyboard } from 'grammy';
import { BinancePayService } from '../services/binancePayService.js';
import { UserService } from '../services/userService.js';
import { config } from '../config.js';

/**
 * Display the Binance Paywall when free trial is exhausted
 */
export async function sendPaymentInvoice(ctx, userId) {
  const keyboard = new InlineKeyboard()
    .text('💎 Buy VIP Plan ($1.00 USDT)', 'buy_plan_100')
    .row()
    .text('🔄 Check Latest Payment Status', 'check_my_payment');

  const text = `
⚠️ <b>Free Trial Over (1/1 Video Used)!</b>

Aapka <b>1 Free Trial Video</b> complete ho chuka hai. Unlimited videos generate karne ke liye VIP Plan lijiye:

💎 <b>VIP Plan:</b> <code>$1.00 USDT</code> ➔ <b>Unlimited Video Generations</b> 🚀

⚡ <b>Instant & Automated Payment:</b>
Binance Pay se instant auto-verification hota hai. Niche button dabakar pay karein:

⚠️ <b>IMPORTANT DISCLAIMER / NOTE:</b>
<i>Video kitna banega iski koi guarantee nahi hogi. Soch samajh ke aapko paisa dalna hai, isme admin ki koi jimmedari nahi hogi. No refunds.</i>
`.trim();

  return ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Handle Buy Plan Buttons
 */
export async function handleBuyPlan(ctx, planType) {
  try {
    await ctx.answerCallbackQuery();
  } catch (e) {}

  const userId = ctx.from?.id;
  const username = ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name || 'User');

  const amount = planType === 'buy_plan_050' ? '0.50' : '1.00';
  const planName = planType === 'buy_plan_050' ? '$0.50 (5 Videos)' : '$1.00 (Unlimited Access)';
  const credits = planType === 'buy_plan_050' ? 5 : 9999;

  await ctx.reply('⏳ <i>Binance Pay secure payment order generate ho raha hai...</i>', { parse_mode: 'HTML' });

  const order = await BinancePayService.createOrder({
    userId,
    username,
    amount,
    planName,
    credits,
  });

  const keyboard = new InlineKeyboard();

  if (order.checkoutUrl) {
    keyboard.url('🚀 Pay Now via Binance', order.checkoutUrl).row();
  } else if (config.binancePayId) {
    // If direct Binance Pay ID is configured
  }

  keyboard.text('✅ Verify Payment', `verify_order_${order.merchantTradeNo}`).row();
  keyboard.text('🔙 Back to Plans', 'btn_back_plans');

  const payIdText = config.binancePayId ? `\n💳 <b>Binance Pay ID:</b> <code>${config.binancePayId}</code>` : '';
  const usdtText = config.usdtWalletAddress ? `\n🌐 <b>USDT (BEP20) Address:</b> <code>${config.usdtWalletAddress}</code>` : '';

  const msg = `
🧾 <b>Binance Pay Invoice:</b>
━━━━━━━━━━━━━━━━━━━━
📦 <b>Plan:</b> ${planName}
💵 <b>Amount:</b> <code>${amount} USDT</code>
🆔 <b>Order ID:</b> <code>${order.merchantTradeNo}</code>${payIdText}${usdtText}

📱 <b>Payment Kaise Karein:</b>
1. Niche <b>"Pay Now via Binance"</b> button par click karein ya Pay ID par transfer karein.
2. Payment complete hone ke baad <b>"Verify Payment"</b> button dabayein.
3. Bot automatically check karke aapka access instant start kar dega!

⚠️ <b>NOTE:</b> <i>Video kitna banega iski koi guarantee nahi hogi. Soch samajh ke aapko paisa dalna hai, isme admin ki koi jimmedari nahi hogi.</i>
`.trim();

  return ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

/**
 * Verify payment via Binance API or Admin
 */
export async function handleVerifyPayment(ctx, merchantTradeNo) {
  try {
    await ctx.answerCallbackQuery('Checking Binance Payment...');
  } catch (e) {}

  const order = BinancePayService.getOrder(merchantTradeNo);
  if (!order) {
    return ctx.reply('❌ Order ID nahi mila ya expire ho gaya hai. Kripya naya order banayein.');
  }

  if (order.status === 'PAID') {
    return ctx.reply('✅ <b>Yeh payment pehle hi verify aur activate ho chuka hai!</b> Aap turant video prompt bhej sakte hain.', { parse_mode: 'HTML' });
  }

  // Query Binance API
  const queryResult = await BinancePayService.queryOrderStatus(merchantTradeNo);

  if (queryResult.status === 'PAID') {
    // Activate Credits or VIP
    if (order.amount === '1.00') {
      UserService.setVip(order.userId, true);
    } else {
      UserService.addCredits(order.userId, order.credits || 5);
    }

    // Notify User
    await ctx.reply(
      `🎉 <b>Payment Verified Successfully!</b>\n\n` +
      `Aapke account me <b>${order.planName}</b> activate ho gaya hai.\n` +
      `Ab aap seedhe apna video prompt type karke bhej sakte hain! 🚀`,
      { parse_mode: 'HTML' }
    );

    // Notify Admin
    if (config.adminId) {
      try {
        await ctx.api.sendMessage(
          config.adminId,
          `💰 <b>New Automated Payment Received!</b>\n\n` +
          `User: ${order.username} (ID: <code>${order.userId}</code>)\n` +
          `Amount: <b>${order.amount} USDT</b>\n` +
          `Plan: ${order.planName}\n` +
          `Order: <code>${merchantTradeNo}</code>`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    }
    return;
  }

  // If not yet marked paid on Binance API
  const retryKeyboard = new InlineKeyboard()
    .text('🔄 Check Again', `verify_order_${merchantTradeNo}`)
    .row()
    .text('🔙 Plans', 'btn_back_plans');

  return ctx.reply(
    `⏳ <b>Payment Status: Pending / Not Yet Detected</b>\n\n` +
    `Agar aapne Binance par transfer complete kar diya hai, toh kripya 10-20 seconds wait karke <b>"Check Again"</b> dabayein.\n\n` +
    `💡 <i>Agar aapne direct Binance Pay ID ya USDT address par transfer kiya hai, toh apna TxID/Order ID submit karein:</i>\n` +
    `👉 <code>/pay &lt;Transaction_ID&gt;</code>\n\n` +
    `<i>Note: Transaction confirm hone me Binance par kuch pal ka samay lag sakta hai.</i>`,
    { parse_mode: 'HTML', reply_markup: retryKeyboard }
  );
}

/**
 * Handle manual TxID / Order ID submission by user (/pay <txid>)
 */
export async function handleManualPaySubmit(ctx) {
  const userId = ctx.from?.id?.toString();
  const username = ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name || 'User');
  const text = ctx.message?.text || '';
  const txId = text.replace(/^\/pay(@\w+)?\s*/i, '').trim();

  if (!txId) {
    return ctx.reply(
      `ℹ️ <b>Usage:</b> <code>/pay &lt;Binance_Order_ID_ya_TxID&gt;</code>\n\n` +
      `Binance Pay ID <code>${config.binancePayId || '487419968'}</code> par payment karne ke baad apna Order ID ya TxID yahan bhejein.`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.reply(
    `✅ <b>Payment Request Submitted!</b>\n\n` +
    `🆔 <b>TxID / Order ID:</b> <code>${txId}</code>\n\n` +
    `Verification ke baad aapka account activate ho jayega. Kripya thoda intezaar karein!`,
    { parse_mode: 'HTML' }
  );

  // Send 1-click Approval prompt to Admin
  if (config.adminId) {
    const adminKeyboard = new InlineKeyboard()
      .text('💎 Approve $1.00 (VIP Unlimited)', `adm_appr_vip_${userId}`)
      .row()
      .text('❌ Reject', `adm_reject_${userId}`);

    try {
      await ctx.api.sendMessage(
        config.adminId,
        `🔔 <b>New Payment Verification Request:</b>\n\n` +
        `👤 <b>User:</b> ${username} (<code>${userId}</code>)\n` +
        `🆔 <b>TxID:</b> <code>${txId}</code>\n` +
        `⏰ <b>Time:</b> ${new Date().toLocaleString('en-IN')}\n\n` +
        `Niche diye gaye button par click karke turant approve ya reject karein:`,
        { parse_mode: 'HTML', reply_markup: adminKeyboard }
      );
    } catch (e) {
      console.error('Failed to notify admin of manual pay submit:', e.message);
    }
  }
}

/**
 * Handle Admin 1-Click Approval / Rejection
 */
export async function handleAdminApproval(ctx) {
  const adminId = ctx.from?.id?.toString();
  if (adminId !== (config.adminId || '').toString()) {
    try { await ctx.answerCallbackQuery('Unauthorized action'); } catch (e) {}
    return;
  }

  const data = ctx.callbackQuery.data;

  if (data.startsWith('adm_appr_5_')) {
    const targetUserId = data.replace('adm_appr_5_', '');
    UserService.addCredits(targetUserId, 5);
    try { await ctx.answerCallbackQuery('Approved 5 Credits!'); } catch (e) {}
    await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ <b>APPROVED: Added 5 Video Credits ($0.50)!</b>`, { parse_mode: 'HTML' });
    try {
      await ctx.api.sendMessage(
        targetUserId,
        `🎉 <b>Payment Approved!</b>\n\nAapke account me <b>5 Video Credits ($0.50)</b> add ho chuke hain. Ab aap seedhe prompt bhej kar video generate kar sakte hain! 🚀`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  } else if (data.startsWith('adm_appr_vip_')) {
    const targetUserId = data.replace('adm_appr_vip_', '');
    UserService.setVip(targetUserId, true);
    try { await ctx.answerCallbackQuery('Approved VIP Unlimited!'); } catch (e) {}
    await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n💎 <b>APPROVED: Activated Unlimited VIP Access ($1.00)!</b>`, { parse_mode: 'HTML' });
    try {
      await ctx.api.sendMessage(
        targetUserId,
        `🎉 <b>Payment Approved!</b>\n\nAapke account me <b>Unlimited VIP Access ($1.00)</b> activate ho chuka hai! Enjoy unlimited video generations. 🚀`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  } else if (data.startsWith('adm_reject_')) {
    const targetUserId = data.replace('adm_reject_', '');
    try { await ctx.answerCallbackQuery('Payment Rejected'); } catch (e) {}
    await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ <b>REJECTED: Payment was not approved.</b>`, { parse_mode: 'HTML' });
    try {
      await ctx.api.sendMessage(
        targetUserId,
        `❌ <b>Payment Not Approved:</b>\n\nAapka diya gaya Transaction ID verify nahi ho saka. Kripya sahi Binance Order ID ke sath dobara try karein ya support se sampark karein.`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }
}
