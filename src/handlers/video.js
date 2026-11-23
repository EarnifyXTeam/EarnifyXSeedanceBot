import { HiggsfieldService } from '../services/higgsfieldService.js';
import { config } from '../config.js';
import { UserService } from '../services/userService.js';

export async function handleVideoCommand(ctx) {
  const userId = ctx.from?.id;
  const prompt = ctx.match?.trim();

  if (!prompt) {
    const usageMsg = `
🎬 **Seedance 2.5 AI Video Generator (Default: 9:16 Reels/Shorts)**

To generate an instant video, provide your prompt:
👉 \`/video <your description>\`

**Examples:**
• \`/video cinematic drone flythrough inside futuristic neon Tokyo, 4k 60fps\`
• \`/video ultra realistic tiger walking through a mystical glowing jungle\`

💡 *Default aspect ratio is **9:16** (Perfect for Instagram Reels & YouTube Shorts).*
*(To make a horizontal cinema video, just add \`16:9\` in your prompt!)*
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

  // Detect Aspect Ratio from prompt or fallback to 9:16 default
  let aspectRatio = config.defaultAspectRatio || '9:16';
  if (prompt.includes('16:9') || prompt.includes('landscape') || prompt.includes('horizontal')) {
    aspectRatio = '16:9';
  } else if (prompt.includes('9:16') || prompt.includes('vertical') || prompt.includes('reel') || prompt.includes('shorts')) {
    aspectRatio = '9:16';
  }

  // Start generation immediately in 9:16 (Zero friction!)
  UserService.startGenerating(userId);

  const cleanPreview = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;

  await ctx.reply(
    `🚀 Generating with Seedance 2.5...\n\n📝 Prompt: "${cleanPreview}"\n📐 Aspect Ratio: ${aspectRatio} (Reels / Shorts)\n\n⏳ Video rendering is queued on Higgsfield GPU. Please wait ~30-90 seconds...`
  );

  try {
    const result = await HiggsfieldService.generateVideo(prompt, aspectRatio);
    UserService.recordGeneration(userId);

    if (result.videoUrl) {
      await ctx.replyWithVideo(result.videoUrl, {
        caption: `🎬 Generated with Seedance 2.5\n📐 Ratio: ${aspectRatio}\n\n⚡ Powered by earnifyXAutomation`,
      });
    } else {
      await ctx.reply(
        `✅ Generation Submitted (Job ID: ${result.jobId || 'Pending'}):\n\n${(result.text || '').slice(0, 3000)}\n\n⚡ Powered by earnifyXAutomation`
      );
    }
  } catch (error) {
    console.error('Error in handleVideoCommand:', error);
    await ctx.reply(
      `❌ Generation Failed:\n${error.message || error}\n\nPlease try again or verify prompt parameters.`
    );
  } finally {
    UserService.stopGenerating(userId);
  }
}

export async function handleVideoGenerationAction(ctx) {
  // Fallback for button clicks from /start
  return handleVideoCommand(ctx);
}
