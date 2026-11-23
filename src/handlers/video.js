import { HiggsfieldService } from '../services/higgsfieldService.js';
import { InlineKeyboard } from 'grammy';
import { UserService } from '../services/userService.js';

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

  // Ask for Aspect Ratio
  const keyboard = new InlineKeyboard()
    .text('📱 9:16 (Reels / Shorts)', `gen_vid:9_16:${encodeURIComponent(prompt.slice(0, 50))}`)
    .text('🖥️ 16:9 (Cinema / YouTube)', `gen_vid:16_9:${encodeURIComponent(prompt.slice(0, 50))}`);

  await ctx.reply(
    `⏳ **Prompt Received:**\n"${prompt}"\n\nChoose aspect ratio to start generation:`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

export async function handleVideoGenerationAction(ctx, aspectRatio = '16:9', customPrompt = null) {
  const userId = ctx.from?.id;
  let prompt = customPrompt;

  if (!prompt && ctx.match) {
    const parts = ctx.match[0].split(':');
    aspectRatio = parts[1].replace('_', ':');
    prompt = decodeURIComponent(parts[2]);
  }

  if (!prompt) {
    return ctx.reply('⚠️ Prompt missing. Please try again with `/video <prompt>`.');
  }

  if (UserService.isGenerating(userId)) {
    return ctx.reply('⏳ **Ek video generation pehle se progress me hai!** Kripya wait karein.');
  }

  UserService.startGenerating(userId);

  await ctx.reply(
    `🚀 **Generating with Seedance 2.5...**\n\n📝 **Prompt:** "${prompt}"\n📐 **Aspect Ratio:** ${aspectRatio}\n\n⏳ *AI video rendering takes ~30-90 seconds. Please wait...*`,
    { parse_mode: 'Markdown' }
  );

  try {
    const response = await HiggsfieldService.generateVideo(prompt, aspectRatio);
    const urls = HiggsfieldService.extractUrls(response);
    const responseText = HiggsfieldService.getResponseText(response);

    UserService.recordGeneration(userId);

    const videoUrl = urls.find((u) => u.match(/\.(mp4|webm)(\?.*)?$/i)) || urls[0];

    if (videoUrl) {
      await ctx.replyWithVideo(videoUrl, {
        caption: `🎬 **Generated with Seedance 2.5**\n\nPrompt: "${prompt}"\nRatio: ${aspectRatio}\n\n⚡ *Powered by earnifyXAutomation*`,
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(
        `✅ **Generation Response:**\n\n${responseText.slice(0, 3500)}\n\n⚡ *Powered by earnifyXAutomation*`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Error in handleVideoGenerationAction:', error);
    await ctx.reply(
      `❌ **Generation Failed:**\n\`${error.message || error}\`\n\nPlease verify your Higgsfield session or try a different prompt.`
    );
  } finally {
    UserService.stopGenerating(userId);
  }
}
