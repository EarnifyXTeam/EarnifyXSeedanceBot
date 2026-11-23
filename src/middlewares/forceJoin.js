import { InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import { handleStart } from '../handlers/start.js';

/**
 * Checks which required channels the user has NOT joined
 * Returns array of channels user needs to join
 */
export async function getMissingChannels(ctx, userId) {
  if (!config.forceChannels || config.forceChannels.length === 0) return [];

  const missing = [];
  const validStatuses = ['creator', 'administrator', 'member', 'restricted'];

  for (const channel of config.forceChannels) {
    if (!channel.id) continue;
    try {
      const member = await ctx.api.getChatMember(channel.id, userId);
      if (!validStatuses.includes(member.status)) {
        missing.push(channel);
      }
    } catch (error) {
      console.warn(
        `⚠️ Force Join check warning for ${channel.name} (${channel.id}): ${error.message}. Ensure bot is Admin!`
      );
      // If error (e.g., bot not admin yet), don't block
    }
  }

  return missing;
}

/**
 * Force Channel Join Middleware supporting multiple channels
 */
export async function forceJoinMiddleware(ctx, next) {
  if (!config.forceChannels || config.forceChannels.length === 0) {
    return await next();
  }

  const userId = ctx.from?.id;
  if (!userId) {
    return await next();
  }

  // Handle the verification button click
  if (ctx.callbackQuery?.data === 'verify_force_join') {
    const missing = await getMissingChannels(ctx, userId);

    if (missing.length === 0) {
      await ctx.answerCallbackQuery({
        text: '🎉 Verification successful! Access unlocked!',
        show_alert: false,
      });

      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Ignore deletion failure
      }

      return handleStart(ctx);
    } else {
      const missingNames = missing.map((ch) => ch.name).join(', ');
      return await ctx.answerCallbackQuery({
        text: `⚠️ Aapne abhi join nahi kiya: ${missingNames}. Kripya dono channels join karein!`,
        show_alert: true,
      });
    }
  }

  // Check membership for normal messages & commands
  const missing = await getMissingChannels(ctx, userId);

  if (missing.length > 0) {
    const keyboard = new InlineKeyboard();

    // Add buttons for each channel
    for (const ch of config.forceChannels) {
      keyboard.url(`📢 Join ${ch.name}`, ch.link).row();
    }
    keyboard.text('✅ I Have Joined Both / Verify', 'verify_force_join');

    const lockMessage = `
🔒 **Access Locked — Channels Join Required!**

To use **EarnifyXSeedanceBot** and generate unlimited AI videos with **Seedance 2.5**, you must join both of our official community channels:

1️⃣ **EarnifyX Automation**
2️⃣ **EarnifyX Community**

👉 **Step 1:** Click both join buttons below.
👉 **Step 2:** Click **"✅ I Have Joined Both / Verify"** to instantly unlock all features!

⚡ *Powered by earnifyXAutomation*
    `.trim();

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: '🔒 Please join both channels first to unlock the bot!',
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
