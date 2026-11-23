import { InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import { handleStart } from '../handlers/start.js';

/**
 * Checks if a user is a member of the required channel
 */
export async function isMember(ctx, userId) {
  if (!config.forceChannelId) return true;

  try {
    const member = await ctx.api.getChatMember(config.forceChannelId, userId);
    const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
    return validStatuses.includes(member.status);
  } catch (error) {
    // If bot is not yet admin or channel ID is misconfigured, log and don't block user
    console.warn(`⚠️ Force Join Check Warning: Ensure the bot is an Admin in ${config.forceChannelId}. Error: ${error.message}`);
    return true;
  }
}

/**
 * Force Channel Join Middleware
 */
export async function forceJoinMiddleware(ctx, next) {
  if (!config.forceChannelId) {
    return await next();
  }

  const userId = ctx.from?.id;
  if (!userId) {
    return await next();
  }

  // Handle the verification button click
  if (ctx.callbackQuery?.data === 'verify_force_join') {
    const joined = await isMember(ctx, userId);

    if (joined) {
      await ctx.answerCallbackQuery({
        text: '🎉 Verification successful! Welcome aboard!',
        show_alert: false,
      });

      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Ignore if cannot delete
      }

      return handleStart(ctx);
    } else {
      return await ctx.answerCallbackQuery({
        text: '⚠️ You have not joined the channel yet. Please join first and click verify!',
        show_alert: true,
      });
    }
  }

  // Check membership for normal messages & commands
  const joined = await isMember(ctx, userId);

  if (!joined) {
    const keyboard = new InlineKeyboard()
      .url('📢 Join Official Channel', config.forceChannelLink)
      .row()
      .text('✅ I Have Joined / Verify', 'verify_force_join');

    const lockMessage = `
🔒 **Access Locked — Channel Join Required!**

To use **EarnifyXSeedanceBot** and generate unlimited AI videos, images, and voiceovers with **Seedance 2.5**, you must join our official community channel first!

👉 **Step 1:** Click **"Join Official Channel"** below.
👉 **Step 2:** After joining, click **"✅ I Have Joined / Verify"** to instantly unlock all bot features!

⚡ *Powered by earnifyXAutomation*
    `.trim();

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '🔒 Please join our channel first to use this feature!',
        show_alert: true,
      });
    }

    return await ctx.reply(lockMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  return await next();
}
