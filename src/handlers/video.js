import { HiggsfieldService } from '../services/higgsfieldService.js';
import { config } from '../config.js';
import { UserService } from '../services/userService.js';
import { QueueService } from '../services/queueService.js';
import { HistoryService } from '../services/historyService.js';

export async function handleVideoCommand(ctx) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
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

  // Anti-Spam: Check if user already has an active task running
  if (UserService.isGenerating(userId)) {
    return ctx.reply('⏳ **Aapka ek video pehle se render ya queue me hai!** Kripya pehle uske complete hone ka wait karein.');
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

  UserService.startGenerating(userId);

  const cleanPreview = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;
  let statusMessage = null;

  try {
    await QueueService.enqueue({
      userId,
      onQueueWaiting: async (pos) => {
        const estSec = pos * 35;
        try {
          if (!statusMessage) {
            statusMessage = await ctx.reply(
              `⏳ Server busy hai (All 12 GPU slots running).\n\n📋 Aapka Request Queue me hai: **Position #${pos}**\n⏱️ Estimated wait time: ~${estSec} seconds.\n\nJaise hi slot free hoga, rendering automatically start ho jayegi!`
            );
          } else {
            await ctx.api.editMessageText(
              ctx.chat.id,
              statusMessage.message_id,
              `⏳ Queue Update: **Position #${pos}**\n⏱️ Estimated wait time: ~${estSec} seconds.`
            );
          }
        } catch (e) {
          // Ignore edit message errors
        }
      },
      onStart: async () => {
        try {
          if (statusMessage) {
            await ctx.api.editMessageText(
              ctx.chat.id,
              statusMessage.message_id,
              `🚀 GPU Slot Allocated!\n\nGenerating with Seedance 2.5...\n📝 Prompt: "${cleanPreview}"\n📐 Ratio: ${aspectRatio}\n\n⏳ Video rendering is active. Please wait ~30-60 seconds...`
            );
          } else {
            statusMessage = await ctx.reply(
              `🚀 Generating with Seedance 2.5...\n\n📝 Prompt: "${cleanPreview}"\n📐 Aspect Ratio: ${aspectRatio} (Reels / Shorts)\n\n⏳ Video rendering is queued on Higgsfield GPU. Please wait ~30-90 seconds...`
            );
          }
        } catch (e) {
          // Ignore edit error
        }
      },
      taskFn: async () => {
        const result = await HiggsfieldService.generateVideo(prompt, aspectRatio);
        UserService.recordGeneration(userId);

        // Record into history database
        HistoryService.logCreation({
          userId,
          username,
          firstName,
          prompt,
          type: 'video',
          ratio: aspectRatio,
          url: result.videoUrl || '',
        });

        if (result.videoUrl) {
          await ctx.replyWithVideo(result.videoUrl, {
            caption: `🎬 Generated with Seedance 2.5\n📐 Ratio: ${aspectRatio}\n\n⚡ Powered by earnifyXAutomation`,
          });
        } else {
          await ctx.reply(
            `✅ Generation Submitted (Job ID: ${result.jobId || 'Pending'}):\n\n${(result.text || '').slice(0, 3000)}\n\n⚡ Powered by earnifyXAutomation`
          );
        }
      },
    });
  } catch (error) {
    console.error('Error in video generation queue:', error);
    await ctx.reply(
      `❌ Generation Failed:\n${error.message || error}\n\nPlease try again or verify prompt parameters.`
    );
  } finally {
    UserService.stopGenerating(userId);
  }
}

export async function handleVideoGenerationAction(ctx) {
  return handleVideoCommand(ctx);
}
