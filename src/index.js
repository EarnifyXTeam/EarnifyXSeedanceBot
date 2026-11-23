import { Bot } from 'grammy';
import http from 'http';
import { config } from './config.js';
import { handleStart, handleReferCommand } from './handlers/start.js';
import { handleVideoCommand, handleVideoGenerationAction, handleRefreshRender } from './handlers/video.js';
import { handleImageCommand } from './handlers/image.js';
import { handleAudioCommand } from './handlers/audio.js';
import { handleStatusCommand } from './handlers/status.js';
import { handleHelpCommand } from './handlers/help.js';
import { handleMyVideos, handleRecentAudit } from './handlers/history.js';
import { sendPaymentInvoice, handleBuyPlan, handleVerifyPayment, handleManualPaySubmit, handleAdminApproval } from './handlers/payment.js';
import { BinancePayService } from './services/binancePayService.js';
import { UserService } from './services/userService.js';
import { ActivityService } from './services/activityService.js';
import { forceJoinMiddleware } from './middlewares/forceJoin.js';
import { mcpClient } from './mcpClient.js';

if (!config.telegramToken) {
  console.error('❌ ERROR: TELEGRAM_BOT_TOKEN is missing in .env!');
  console.log('👉 Please set TELEGRAM_BOT_TOKEN="your_token_from_botfather" in your .env file.');
  process.exit(1);
}

const bot = new Bot(config.telegramToken);

// Access control middleware (if ALLOWED_USERS is set)
bot.use(async (ctx, next) => {
  if (config.allowedUsers.length > 0) {
    const userId = ctx.from?.id?.toString();
    if (!userId || !config.allowedUsers.includes(userId)) {
      return ctx.reply('🔒 Access restricted to authorized members only.');
    }
  }
  return await next();
});

// Force Channel Subscription Middleware (Grow Followers)
bot.use(forceJoinMiddleware);

// Command Handlers
bot.command('start', handleStart);
bot.command('video', handleVideoCommand);
bot.command('image', handleImageCommand);
bot.command('audio', handleAudioCommand);
bot.command('status', handleStatusCommand);
bot.command('balance', handleStatusCommand);
bot.command('help', handleHelpCommand);
bot.command('myvideos', handleMyVideos);
bot.command('recent', handleRecentAudit);
bot.command(['refer', 'referral', 'invite'], handleReferCommand);
bot.command('buy', (ctx) => sendPaymentInvoice(ctx, ctx.from?.id));
bot.command('plans', (ctx) => sendPaymentInvoice(ctx, ctx.from?.id));
bot.command('pay', handleManualPaySubmit);
bot.command(['proof', 'community', 'live'], (ctx) => {
  return ctx.reply(ActivityService.getSocialProofMessage(), { parse_mode: 'HTML' });
});

// Admin commands to manage credits manually if needed
bot.command('addcredits', async (ctx) => {
  if (ctx.from?.id?.toString() !== config.adminId.toString()) return;
  const parts = ctx.message.text.split(' ');
  const targetId = parts[1];
  const count = parseInt(parts[2], 10) || 5;
  if (!targetId) return ctx.reply('Usage: /addcredits <userId> <count>');
  UserService.addCredits(targetId, count);
  return ctx.reply(`✅ Added ${count} credits to user ${targetId}`);
});

bot.command('setvip', async (ctx) => {
  if (ctx.from?.id?.toString() !== config.adminId.toString()) return;
  const parts = ctx.message.text.split(' ');
  const targetId = parts[1];
  if (!targetId) return ctx.reply('Usage: /setvip <userId>');
  UserService.setVip(targetId, true);
  return ctx.reply(`✅ VIP access granted to user ${targetId}`);
});

// Callback Queries (Buttons)
bot.callbackQuery(['buy_plan_050', 'buy_plan_100'], async (ctx) => {
  return handleBuyPlan(ctx, ctx.callbackQuery.data);
});

bot.callbackQuery('btn_back_plans', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return sendPaymentInvoice(ctx, ctx.from?.id);
});

bot.callbackQuery('check_my_payment', async (ctx) => {
  const latest = BinancePayService.getLatestOrderForUser(ctx.from?.id);
  if (!latest) {
    try { await ctx.answerCallbackQuery('Koi pending order nahi mila.'); } catch (e) { }
    return ctx.reply('ℹ️ Aapka koi pending order nahi mila. Naya plan select karein.');
  }
  return handleVerifyPayment(ctx, latest.merchantTradeNo);
});

bot.callbackQuery(/^verify_order_/, async (ctx) => {
  const tradeNo = ctx.callbackQuery.data.replace('verify_order_', '');
  return handleVerifyPayment(ctx, tradeNo);
});

bot.callbackQuery(/^adm_/, handleAdminApproval);
bot.callbackQuery('btn_video_help', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return handleVideoCommand(ctx);
});

bot.callbackQuery('btn_image_help', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return handleImageCommand(ctx);
});

bot.callbackQuery('btn_status', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return handleStatusCommand(ctx);
});

bot.callbackQuery('btn_refresh_status', async (ctx) => {
  return handleStatusCommand(ctx);
});

bot.callbackQuery('btn_refer', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return handleReferCommand(ctx);
});

bot.callbackQuery('btn_main_menu', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return handleStart(ctx);
});

bot.callbackQuery(/^refresh_render_/, handleRefreshRender);

bot.callbackQuery('btn_live_proof', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return ctx.reply(ActivityService.getSocialProofMessage(), { parse_mode: 'HTML' });
});

bot.callbackQuery('btn_help', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return handleHelpCommand(ctx);
});

// Dynamic Video Generation Callback with Aspect Ratio
bot.callbackQuery(/^gen_vid:/, async (ctx) => {
  try { await ctx.answerCallbackQuery({ text: 'Starting rendering...' }); } catch (e) { }
  return handleVideoGenerationAction(ctx);
});

// Direct Text Message Handler: Automatically generate video if user sends plain prompt in private chat
bot.on('message:text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; // Ignore commands
  if (ctx.chat.type === 'private') {
    ctx.match = ctx.message.text;
    return handleVideoCommand(ctx);
  }
});

// Error handling
bot.catch((err) => {
  // Ignore harmless expired Telegram callback query errors
  if (err.message?.includes('query is too old') || err.description?.includes('query is too old')) {
    return;
  }
  console.error('Unhandled bot error:', err);
});

// Initialize & Launch
async function main() {
  console.log('🚀 Initializing EarnifyXSeedanceBot [v1.2 - Auto-Reconnect & 5 Referrals Enabled]...');

  try {
    // Pre-connect to Higgsfield MCP server
    await mcpClient.connect();
    console.log('✅ Higgsfield MCP connection established.');
  } catch (err) {
    console.warn('⚠️ MCP connection warning (will retry on first command):', err.message);
  }

  console.log('🤖 Bot is now polling for Telegram messages...');
  bot.start({
    drop_pending_updates: true, // Discards stale/expired button clicks from while bot was restarting
    onStart: (botInfo) => {
      console.log(`🎉 Logged in as ${botInfo.first_name} (@${botInfo.username})`);
      console.log('⚡ Ready to generate with Seedance 2.5!');
    },
  });

  // Healthcheck HTTP Server for Cloud / Caddy reverse proxy
  const PORT = process.env.PORT || 10001;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EarnifyX Seedance Bot is Running 🚀');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`ℹ️ Port ${PORT} is managed by cloud reverse proxy. Telegram Bot continues running uninterrupted!`);
    } else {
      console.warn(`⚠️ Healthcheck server warning: ${err.message}`);
    }
  });

  try {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 Healthcheck HTTP server listening on port ${PORT}`);
    });
  } catch (listenErr) {
    console.warn('⚠️ Server listen caught:', listenErr.message);
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('Stopping bot...');
  bot.stop();
});
process.once('SIGTERM', () => {
  console.log('Stopping bot...');
  bot.stop();
});

main();
