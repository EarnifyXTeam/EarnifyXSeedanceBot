import { InlineKeyboard } from 'grammy';
import { BinancePayService } from '../services/binancePayService.js';
import { UserService } from '../services/userService.js';
import { config } from '../config.js';

/**
 * Display the Binance Paywall when free trial is exhausted
 */
export async function sendPaymentInvoice(ctx, userId) {
  const keyboard = new InlineKeyboard()
    .text('💳 Plan 1: $0.50 (5 Videos)', 'buy_plan_050')
    .row()
    .text('💎 Plan 2: $1.00 (Unlimited Access)', 'buy_plan_100')
    .row()
    .text('🔄 Check Latest Payment Status', 'check_my_payment');

  const text = `
⚠️ <b>Free Trial Over (1/1 Video Used)!</b>

Aapka <b>1 Free Trial Video</b> complete ho chuka hai. Agle videos generate karne ke liye chhota sa balance add kijiye:

💰 <b>Available Plans:</b>
• <b>Starter Plan:</b> <code>$0.50 USDT</code> ➔ 5 High Quality Videos
• <b>VIP Plan:</b> <code>$1.00 USDT</code> ➔ Unlimited Access

⚡ <b>Instant & Automated Payment:</b>
Binance Pay se instant auto-verification hota hai. Niche apna plan select karein:

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
    `<i>Note: Transaction confirm hone me Binance par kuch pal ka samay lag sakta hai.</i>`,
    { parse_mode: 'HTML', reply_markup: retryKeyboard }
  );
}
