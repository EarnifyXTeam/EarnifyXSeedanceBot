import { Bot } from 'grammy';
import { config } from './config.js';
import { handleStart } from './handlers/start.js';
import { handleVideoCommand, handleVideoGenerationAction } from './handlers/video.js';
import { handleImageCommand } from './handlers/image.js';
import { handleAudioCommand } from './handlers/audio.js';
import { handleStatusCommand } from './handlers/status.js';
import { handleHelpCommand } from './handlers/help.js';
import { handleMyVideos, handleRecentAudit } from './handlers/history.js';
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

// Callback Queries (Buttons)
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

bot.callbackQuery('btn_help', async (ctx) => {
  try { await ctx.answerCallbackQuery(); } catch (e) { }
  return handleHelpCommand(ctx);
});

// Dynamic Video Generation Callback with Aspect Ratio
bot.callbackQuery(/^gen_vid:/, async (ctx) => {
  try { await ctx.answerCallbackQuery({ text: 'Starting rendering...' }); } catch (e) { }
  return handleVideoGenerationAction(ctx);
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
  console.log('🚀 Initializing EarnifyXSeedanceBot...');

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
