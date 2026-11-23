import { InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import { handleStart } from '../handlers/start.js';
import { UserService } from '../services/userService.js';

// In-memory fast cache for verified members to make bot response instantaneous (0ms lag)
const verifiedMembersCache = new Set();

/**
 * Checks which required channels the user has NOT joined
 * Uses Promise.all for parallel checking and fast in-memory caching
 */
export async function getMissingChannels(ctx, userId) {
  if (!config.forceChannels || config.forceChannels.length === 0) return [];
  const idStr = userId.toString();
  if (verifiedMembersCache.has(idStr)) return [];

  const validStatuses = ['creator', 'administrator', 'member', 'restricted'];

  try {
    const checks = await Promise.all(
      config.forceChannels.map(async (channel) => {
        if (!channel.id) return null;
        try {
          const member = await ctx.api.getChatMember(channel.id, userId);
          if (!validStatuses.includes(member.status)) {
            return channel;
          }
        } catch (error) {
          // If bot is not admin or channel check fails, don't block real users
        }
        return null;
      })
    );

    const missing = checks.filter(Boolean);
    if (missing.length === 0) {
      verifiedMembersCache.add(idStr);
    }
    return missing;
  } catch (e) {
    return [];
  }
}

/**
 * Force Channel Join & Anti-Fake Security Middleware
 */
export async function forceJoinMiddleware(ctx, next) {
  // Anti-Fake Rule 1: Reject any automated bot accounts
  if (ctx.from?.is_bot) {
    return; // Silently drop bots
  }

  const userId = ctx.from?.id;
  if (!userId) {
    return await next();
  }

  // Anti-Fake Rule 2: Block banned/malicious users
  if (UserService.isBanned(userId)) {
    return await ctx.reply('🚫 **Your account has been restricted from using this service due to policy violations.**');
  }

  // Handle the verification button click
  if (ctx.callbackQuery?.data === 'verify_force_join') {
    const missing = await getMissingChannels(ctx, userId);

    if (missing.length === 0) {
      // Register authentic user
      UserService.registerUser(ctx.from);

      try {
        await ctx.answerCallbackQuery({
          text: '🎉 Verified! Official membership confirmed!',
          show_alert: false,
        });
      } catch (e) {
        // Safe ignore for expired Telegram callback queries
      }

      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Ignore deletion failure
      }

      return handleStart(ctx);
    } else {
      const missingNames = missing.map((ch) => ch.name).join(', ');
      try {
        return await ctx.answerCallbackQuery({
          text: `❌ Fake click detected! Aapne abhi join nahi kiya: ${missingNames}. Kripya channels open karke JOIN button dabayein!`,
          show_alert: true,
        });
      } catch (e) {
        // Safe ignore for expired queries
      }
      return;
    }
  }

  // Anti-Fake Rule 3: Continuous Live Check (If a user leaves the channel later, they are instantly locked!)
  const missing = await getMissingChannels(ctx, userId);

  if (missing.length > 0) {
    const keyboard = new InlineKeyboard();

    for (const ch of config.forceChannels) {
      keyboard.url(`📢 Join ${ch.name}`, ch.link).row();
    }
    keyboard.text('✅ I Have Joined Both / Verify', 'verify_force_join');

    const lockMessage = `
🔒 **Membership Verification Required!**

To prevent fake spam and protect our AI GPU resources, **EarnifyX** requires real members to join our official channels:

1️⃣ **EarnifyX Automation**
2️⃣ **EarnifyX Community**

⚠️ *Warning: If you leave the channels after joining, your access will be automatically revoked.*

👉 **Step 1:** Click both join buttons below.
👉 **Step 2:** Click **"✅ I Have Joined Both / Verify"** to activate your access!

⚡ *Powered by earnifyXAutomation*
    `.trim();

    if (ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery({
          text: '🔒 Kripya dono channels join karein!',
          show_alert: true,
        });
      } catch (e) {
        // Safe ignore
      }
    }

    return await ctx.reply(lockMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  // User is verified and legitimate, update activity
  UserService.registerUser(ctx.from);

  return await next();
}
