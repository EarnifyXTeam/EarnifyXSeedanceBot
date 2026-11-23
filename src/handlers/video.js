import { HiggsfieldService } from '../services/higgsfieldService.js';
import { InlineKeyboard } from 'grammy';
import { UserService } from '../services/userService.js';

// In-memory store for pending video prompts (promptId -> prompt text)
// Keeps callback_data tiny (< 20 bytes), avoiding Telegram's 64-byte BUTTON_DATA_INVALID limit!
const pendingPrompts = new Map();

// Auto-clean old pending prompts every 30 mins
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of pendingPrompts.entries()) {
    if (now - data.timestamp > 30 * 60 * 1000) {
      pendingPrompts.delete(id);
    }
  }
}, 10 * 60 * 1000);

export async function handleVideoCommand(ctx) {
  const userId = ctx.from?.id;
  const prompt = ctx.match?.trim();

  if (!prompt) {
    const usageMsg = `
🎬 **Seedance 2.5 AI Video Generator**

To generate a video, please provide a prompt:
👉 \`/video <your description>\`

**Examples:**
• \`/video cinematic drone flythrough inside futuristic neon Tokyo, 4k 60fps\`
• \`/video ultra realistic tiger walking through a mystical glowing jungle\`

💡 *Default aspect ratio is 16:9 (Landscape). You can choose 9:16 (Reels/Shorts) below!*
    `.trim();

    return ctx.reply(usageMsg, { parse_mode: 'Markdown' });
  }

  // Anti-Spam: Check if already generating
  if (UserService.isGenerating(userId)) {
    return ctx.reply('⏳ **Aapka ek video pehle se render ho raha hai!** Kripya pehle uske complete hone ka wait karein.');
  }

  // Anti-Flood: 15s Cooldown
  const remaining = UserService.checkCooldown(userId, 15);
  if (remaining > 0) {
    return ctx.reply(`⏱️ **Anti-Flood Cooldown:** Kripya ${remaining} seconds wait karein naya request bhejne se pehle.`);
  }

  // Generate a short 8-char prompt ID
  const promptId = Math.random().toString(36).substring(2, 10);
  pendingPrompts.set(promptId, {
    prompt,
    userId,
    timestamp: Date.now(),
  });

  // Short callback_data: ~18 bytes total (fixes BUTTON_DATA_INVALID)
  const keyboard = new InlineKeyboard()
    .text('📱 9:16 (Reels / Shorts)', `gen_vid:9_16:${promptId}`)
    .text('🖥️ 16:9 (Cinema / YouTube)', `gen_vid:16_9:${promptId}`);

  const previewPrompt = prompt.length > 250 ? prompt.slice(0, 250) + '...' : prompt;

  // No Markdown parsing on prompt text to avoid "can't parse entities" error with special symbols
  await ctx.reply(
    `⏳ Prompt Received:\n"${previewPrompt}"\n\nChoose aspect ratio to start generation:`,
    {
      reply_markup: keyboard,
    }
  );
}

export async function handleVideoGenerationAction(ctx) {
  const userId = ctx.from?.id;

  const data = ctx.callbackQuery?.data; // e.g. gen_vid:9_16:a1b2c3d4
  if (!data) return;

  const parts = data.split(':');
  const aspectRatio = (parts[1] || '16_9').replace('_', ':');
  const promptId = parts[2];

  const pending = pendingPrompts.get(promptId);
  const prompt = pending?.prompt;

  if (!prompt) {
    return ctx.reply('⚠️ Prompt expired or not found. Please send your prompt again with `/video <prompt>`.');
  }

  // Clean up
  pendingPrompts.delete(promptId);

  if (UserService.isGenerating(userId)) {
    return ctx.reply('⏳ **Ek video generation pehle se progress me hai!** Kripya wait karein.');
  }

  UserService.startGenerating(userId);

  try {
    await ctx.editMessageText(
      `🚀 Generating with Seedance 2.5...\n\n📝 Prompt: "${prompt.slice(0, 150)}..."\n📐 Aspect Ratio: ${aspectRatio}\n\n⏳ Video rendering is queued on Higgsfield GPU. Please wait...`
    );
  } catch (e) {
    await ctx.reply(
      `🚀 Generating with Seedance 2.5...\n\n📝 Prompt: "${prompt.slice(0, 150)}..."\n📐 Aspect Ratio: ${aspectRatio}\n\n⏳ Video rendering is queued on Higgsfield GPU. Please wait...`
    );
  }

  try {
    const result = await HiggsfieldService.generateVideo(prompt, aspectRatio);
    UserService.recordGeneration(userId);

    if (result.videoUrl) {
      await ctx.replyWithVideo(result.videoUrl, {
        caption: `🎬 Generated with Seedance 2.5\n\nRatio: ${aspectRatio}\n\n⚡ Powered by earnifyXAutomation`,
      });
    } else {
      // Send plain text without Markdown to avoid formatting parse crashes
      await ctx.reply(
        `✅ Generation Submitted (Job ID: ${result.jobId || 'Pending'}):\n\n${result.text.slice(0, 3000)}\n\n⚡ Powered by earnifyXAutomation`
      );
    }
  } catch (error) {
    console.error('Error in handleVideoGenerationAction:', error);
    await ctx.reply(
      `❌ Generation Failed:\n${error.message || error}\n\nPlease try again or verify prompt parameters.`
    );
  } finally {
    UserService.stopGenerating(userId);
  }
}
