import { Bot } from 'grammy';
import { config } from './config.js';
import { handleStart } from './handlers/start.js';
import { handleVideoCommand, handleVideoGenerationAction } from './handlers/video.js';
import { handleImageCommand } from './handlers/image.js';
import { handleAudioCommand } from './handlers/audio.js';
import { handleStatusCommand } from './handlers/status.js';
import { handleHelpCommand } from './handlers/help.js';
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

// Command Handlers
bot.command('start', handleStart);
bot.command('video', handleVideoCommand);
bot.command('image', handleImageCommand);
bot.command('audio', handleAudioCommand);
bot.command('status', handleStatusCommand);
bot.command('balance', handleStatusCommand);
bot.command('help', handleHelpCommand);

// Callback Queries (Buttons)
bot.callbackQuery('btn_video_help', async (ctx) => {
  await ctx.answerCallbackQuery();
  return handleVideoCommand(ctx);
});

bot.callbackQuery('btn_image_help', async (ctx) => {
  await ctx.answerCallbackQuery();
  return handleImageCommand(ctx);
});

bot.callbackQuery('btn_status', async (ctx) => {
  await ctx.answerCallbackQuery();
  return handleStatusCommand(ctx);
});

bot.callbackQuery('btn_help', async (ctx) => {
  await ctx.answerCallbackQuery();
  return handleHelpCommand(ctx);
});

// Dynamic Video Generation Callback with Aspect Ratio
bot.callbackQuery(/^gen_vid:/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Starting rendering...' });
  return handleVideoGenerationAction(ctx);
});

// Error handling
bot.catch((err) => {
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
    onStart: (botInfo) => {
      console.log(`🎉 Logged in as @${botInfo.username}`);
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
