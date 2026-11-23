import { HiggsfieldService } from '../services/higgsfieldService.js';
import { config } from '../config.js';
import { UserService } from '../services/userService.js';
import { QueueService } from '../services/queueService.js';
import { HistoryService } from '../services/historyService.js';
import { sendPaymentInvoice } from './payment.js';
import { ActivityService } from '../services/activityService.js';

function makeProgressBar(percent, length = 10) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.min(length, Math.max(0, Math.round((p / 100) * length)));
  const empty = length - filled;
  return `[${'▰'.repeat(filled)}${'▱'.repeat(empty)}] ${p}%`;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function handleVideoCommand(ctx) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;

  // Support both /video <prompt> and direct text messages
  let prompt = '';
  if (typeof ctx.match === 'string' && ctx.match.trim()) {
    prompt = ctx.match.trim();
  } else if (ctx.message?.text) {
    prompt = ctx.message.text.replace(/^\/video(@\w+)?\s*/i, '').trim();
  }

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

  // 1 Free Video Trial, then Binance Paywall Check
  const access = UserService.checkAccess(userId);
  if (!access.allowed) {
    return sendPaymentInvoice(ctx, userId);
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
  const durationMatch = prompt.match(/\b([4-9]|[12][0-9]|30)[\s\-_]*(seconds?|secs?|s)\b/i);
  if (durationMatch) {
    requestedDuration = parseInt(durationMatch[1], 10);
  } else if (/\b30[\s\-_]*(second|sec|s)\b/i.test(prompt) || prompt.includes('30-second') || prompt.includes('30s') || prompt.includes('30 second')) {
    requestedDuration = 30;
  }
  requestedDuration = Math.max(4, Math.min(30, requestedDuration));

  UserService.startGenerating(userId);
  UserService.consumeAccess(userId);

  const cleanPreview = prompt.length > 150 ? prompt.slice(0, 150) + '...' : prompt;
  const safePreview = escapeHtml(cleanPreview);
  let statusMessage = null;

  try {
    await QueueService.enqueue({
      userId,
      onQueueWaiting: async (pos) => {
        const estSec = pos * 45;
        try {
          const queueText = `⏳ <b>Server Busy hai (GPU Slots Full)</b>\n\n📋 <b>Queue Position:</b> #${pos}\n⏱️ <b>Est. Wait:</b> ~${estSec}s\n\nJaise hi slot free hoga, video auto-render start ho jayega!`;
          if (!statusMessage) {
            statusMessage = await ctx.reply(queueText, { parse_mode: 'HTML' });
          } else {
            await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, queueText, { parse_mode: 'HTML' });
          }
        } catch (e) {
          // Ignore
        }
      },
      onStart: async () => {
        try {
          const waitTimeText = requestedDuration > 10 ? '~2-5 min' : '~30-60 sec';
          const startBar = makeProgressBar(5, 10);
          const startText = `<b>🚀 GPU Slot Active! Generating with Seedance 2.5 ⚡</b>\n\n` +
            `📝 <b>Prompt:</b> "${safePreview}"\n` +
            `📐 <b>Ratio:</b> ${aspectRatio} | ⏱️ <b>Duration:</b> ${requestedDuration}s\n` +
            `📌 <b>Job ID:</b> <code>Allocating...</code>\n\n` +
            `<pre>${startBar}</pre>\n` +
            `🔄 <b>Live Status:</b> ⏳ Initializing GPU compute slot...\n` +
            `⏱️ <b>Est. Time:</b> ${waitTimeText}\n\n` +
            `⚡ <i>Powered by earnifyXAutomation</i>`;

          if (statusMessage) {
            await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, startText, {
              parse_mode: 'HTML',
            });
          } else {
            statusMessage = await ctx.reply(startText, { parse_mode: 'HTML' });
          }
        } catch (e) {
          // Ignore
        }
      },
      taskFn: async () => {
        let lastEditTime = 0;
        const result = await HiggsfieldService.generateVideo(
          prompt,
          aspectRatio,
          requestedDuration,
          async ({ percent, stage, elapsedSec, jobId }) => {
            const now = Date.now();
            if (now - lastEditTime < 4500 && percent < 100) return;
            lastEditTime = now;

            try {
              const bar = makeProgressBar(percent, 10);
              const cardText = `<b>🚀 GPU Slot Active! Generating with Seedance 2.5 ⚡</b>\n\n` +
                `📝 <b>Prompt:</b> "${safePreview}"\n` +
                `📐 <b>Ratio:</b> ${aspectRatio} | ⏱️ <b>Duration:</b> ${requestedDuration}s\n` +
                `📌 <b>Job ID:</b> <code>${jobId ? jobId.slice(0, 13) + '...' : 'Allocating...'}</code>\n\n` +
                `<pre>${bar}</pre>\n` +
                `🔄 <b>Live Status:</b> ${escapeHtml(stage)}\n` +
                `⏱️ <b>Time Elapsed:</b> ${elapsedSec || 0}s\n\n` +
                `⚡ <i>Powered by earnifyXAutomation</i>`;

              if (statusMessage) {
                await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, cardText, {
                  parse_mode: 'HTML',
                });
              }
            } catch (editErr) {
              // Ignore
            }
          }
        );

        UserService.recordGeneration(userId);

        // Record into history database & auto-archive locally
        HistoryService.logCreation({
          userId,
          username,
          firstName,
          prompt,
          type: 'video',
          ratio: aspectRatio,
          url: result.videoUrl || '',
          duration: `${result.duration || requestedDuration}s`,
        });

        if (result.videoUrl) {
          await ctx.replyWithVideo(result.videoUrl, {
            caption: `🎬 Generated with Seedance 2.5\n⏱️ Duration: ${result.duration || requestedDuration}s | 📐 Ratio: ${aspectRatio}\n\n⚡ Powered by earnifyXAutomation`,
          });

          // Live Activity Tracking & Admin Alert
          ActivityService.recordVideoDelivery({
            userId,
            username,
            firstName,
            duration: `${result.duration || requestedDuration}s`,
            ratio: aspectRatio,
          });
          ActivityService.notifyAdmin(
            ctx.api,
            `🎬 <b>Video Delivered Successfully!</b>\n\n` +
            `• <b>User:</b> ${firstName} (@${username || 'none'})\n` +
            `• <b>Duration:</b> ${result.duration || requestedDuration}s | 📐 <b>Ratio:</b> ${aspectRatio}\n` +
            `• <b>Prompt:</b> "${safePreview}"`
          );
        } else if (result.jobId) {
          // Video is still rendering on Higgsfield GPU (queue / extended render)
          const waitTimeText = requestedDuration > 10 ? '~3-6 min' : '~45-90 sec';
          const waitCard = `<b>⏳ GPU Render in Progress! (Seedance 2.5)</b>\n\n` +
            `📝 <b>Prompt:</b> "${safePreview}"\n` +
            `📐 <b>Ratio:</b> ${aspectRatio} | ⏱️ <b>Duration:</b> ${requestedDuration}s\n` +
            `📌 <b>Job ID:</b> <code>${result.jobId.slice(0, 16)}...</code>\n\n` +
            `<pre>${makeProgressBar(30, 10)}</pre>\n` +
            `🔄 <b>Live Status:</b> 🎬 Rendering neural video frames & sound...\n` +
            `⏱️ <b>Est. Time:</b> ${waitTimeText}\n\n` +
            `<i>Jaise hi render complete hoga, video isi chat me upload ho jayega! 🚀</i>`;

          if (statusMessage) {
            try {
              await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, waitCard, { parse_mode: 'HTML' });
            } catch (e) {}
          } else {
            statusMessage = await ctx.reply(waitCard, { parse_mode: 'HTML' });
          }

          // Background auto-delivery poller with continuous live progress bar updates
          (async () => {
            try {
              console.log(`🔄 Background delivery poller started for Job ID: ${result.jobId}`);
              let lastBgEdit = 0;
              const bgUrl = await HiggsfieldService.waitForJob(
                result.jobId,
                720,
                async ({ percent, stage, elapsedSec }) => {
                  const now = Date.now();
                  if (now - lastBgEdit < 4500 && percent < 100) return;
                  lastBgEdit = now;

                  try {
                    const bar = makeProgressBar(percent, 10);
                    const updateCard = `<b>🚀 Generating Seedance 2.5 Video... ⚡</b>\n\n` +
                      `📝 <b>Prompt:</b> "${safePreview}"\n` +
                      `📐 <b>Ratio:</b> ${aspectRatio} | ⏱️ <b>Duration:</b> ${requestedDuration}s\n` +
                      `📌 <b>Job ID:</b> <code>${result.jobId.slice(0, 16)}...</code>\n\n` +
                      `<pre>${bar}</pre>\n` +
                      `🔄 <b>Live Status:</b> ${escapeHtml(stage)}\n` +
                      `⏱️ <b>Time Elapsed:</b> ${elapsedSec || 0}s\n\n` +
                      `⚡ <i>Powered by earnifyXAutomation</i>`;

                    if (statusMessage) {
                      await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, updateCard, {
                        parse_mode: 'HTML',
                      });
                    }
                  } catch (editErr) {
                    // Ignore transient rate limits
                  }
                }
              );

              if (bgUrl) {
                await ctx.api.sendVideo(ctx.chat.id, bgUrl, {
                  caption: `🎬 <b>Aapka Video Ready Hai!</b> (Seedance 2.5)\n⏱️ Duration: ${requestedDuration}s | 📐 Ratio: ${aspectRatio}\n\n⚡ Powered by earnifyXAutomation`,
                  parse_mode: 'HTML',
                });

                // Live Activity Tracking & Admin Alert
                ActivityService.recordVideoDelivery({
                  userId,
                  username,
                  firstName,
                  duration: `${requestedDuration}s`,
                  ratio: aspectRatio,
                });
                ActivityService.notifyAdmin(
                  ctx.api,
                  `🎬 <b>Video Delivered Successfully (Background Render)!</b>\n\n` +
                  `• <b>User:</b> ${firstName} (@${username || 'none'})\n` +
                  `• <b>Duration:</b> ${requestedDuration}s | 📐 <b>Ratio:</b> ${aspectRatio}\n` +
                  `• <b>Job ID:</b> <code>${result.jobId}</code>`
                );
                HistoryService.logCreation({
                  userId,
                  username,
                  firstName,
                  prompt,
                  type: 'video',
                  ratio: aspectRatio,
                  url: bgUrl,
                  duration: `${requestedDuration}s`,
                });
              }
            } catch (bgErr) {
              console.error('Background delivery error for Job', result.jobId, bgErr.message);
            }
          })().catch(() => {});
        } else {
          await ctx.reply(
            `⚠️ Video submission note:\n${escapeHtml((result.text || '').slice(0, 1000))}\n\nKripya thoda wait karein ya naya prompt try karein.`,
            { parse_mode: 'HTML' }
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
