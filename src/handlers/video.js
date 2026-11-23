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
• \`/video ultra realistic tiger walking through a mystical glowing jungle, 30 seconds\`

💡 *Default aspect ratio is **9:16**.*
💡 *Supports durations up to **30 seconds** (just mention "30 seconds" in your prompt)!*
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

  // Detect Aspect Ratio
  let aspectRatio = config.defaultAspectRatio || '9:16';
  if (prompt.includes('16:9') || prompt.includes('landscape') || prompt.includes('horizontal')) {
    aspectRatio = '16:9';
  } else if (prompt.includes('9:16') || prompt.includes('vertical') || prompt.includes('reel') || prompt.includes('shorts')) {
    aspectRatio = '9:16';
  }

  // Detect Requested Duration (Default: 5s, or up to 30s)
  let requestedDuration = 5;
  const durationMatch = prompt.match(/\b([4-9]|[12][0-9]|30)\s*(seconds?|secs?|s)\b/i);
  if (durationMatch) {
    requestedDuration = parseInt(durationMatch[1], 10);
  } else if (prompt.includes('30 second') || prompt.includes('30s')) {
    requestedDuration = 30;
  }

  UserService.startGenerating(userId);

  const cleanPreview = prompt.length > 180 ? prompt.slice(0, 180) + '...' : prompt;
  let statusMessage = null;

  try {
    await QueueService.enqueue({
      userId,
      onQueueWaiting: async (pos) => {
        const estSec = pos * 45;
        try {
          if (!statusMessage) {
            statusMessage = await ctx.reply(
              `⏳ Server busy hai (All 12 GPU slots running).\n\n📋 Request Queue: **Position #${pos}**\n⏱️ Est. wait time: ~${estSec}s.\n\nJaise hi slot free hoga, rendering automatically start ho jayegi!`
            );
          } else {
            await ctx.api.editMessageText(
              ctx.chat.id,
              statusMessage.message_id,
              `⏳ Queue Update: **Position #${pos}**\n⏱️ Est. wait time: ~${estSec}s.`
            );
          }
        } catch (e) {
          // Ignore edit message errors
        }
      },
      onStart: async () => {
        try {
          const waitTimeText = requestedDuration > 10 ? '~2-5 minutes (Extended 30s Render)' : '~30-60 seconds';
          const startText = `🚀 GPU Slot Active!\n\nGenerating with Seedance 2.5...\n📝 Prompt: "${cleanPreview}"\n📐 Aspect Ratio: ${aspectRatio}\n⏱️ Duration: ${requestedDuration} Seconds\n\n⏳ Video rendering is in progress (${waitTimeText}). Please wait...`;

          if (statusMessage) {
            await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, startText);
          } else {
            statusMessage = await ctx.reply(startText);
          }
        } catch (e) {
          // Ignore edit error
        }
      },
      taskFn: async () => {
        const result = await HiggsfieldService.generateVideo(prompt, aspectRatio, requestedDuration);
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
            caption: `🎬 Generated with Seedance 2.5\n⏱️ Duration: ${result.duration || requestedDuration}s | 📐 Ratio: ${aspectRatio}\n\n⚡ Powered by earnifyXAutomation`,
          });
        } else {
          await ctx.reply(
            `✅ Video Rendered (Job ID: ${result.jobId || 'Completed'}):\n\n${(result.text || '').slice(0, 3000)}\n\n⚡ Powered by earnifyXAutomation`
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
