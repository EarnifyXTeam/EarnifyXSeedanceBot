import { InlineKeyboard } from 'grammy';
import { HiggsfieldService } from '../services/higgsfieldService.js';
import { config } from '../config.js';
import { UserService } from '../services/userService.js';
import { QueueService } from '../services/queueService.js';
import { HistoryService } from '../services/historyService.js';
import { sendPaymentInvoice } from './payment.js';
import { ActivityService } from '../services/activityService.js';

// In-memory active render tracker to support real-time user status refresh
export const activeRenderJobs = new Map();

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

function getRenderKeyboard(targetUserId) {
  return new InlineKeyboard().text('🔄 Refresh Status', `refresh_render_${targetUserId}`);
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
🎬 <b>Seedance 2.5 AI Video Generator (Default: 9:16 Reels/Shorts)</b>

To generate an instant video, provide your prompt:
👉 <code>/video &lt;your description&gt;</code>

<b>Examples:</b>
• <code>/video cinematic drone flythrough inside futuristic neon Tokyo, 4k 60fps</code>
• <code>/video ultra realistic tiger walking through a mystical glowing jungle, 30 seconds</code>

💡 <i>Default aspect ratio is <b>9:16</b>.</i>
💡 <i>Supports durations up to <b>30 seconds</b> (just mention "30 seconds" in your prompt)!</i>
    `.trim();

    return ctx.reply(usageMsg, { parse_mode: 'HTML' });
  }

  // Anti-Spam: Check if user already has an active task running
  if (UserService.isGenerating(userId)) {
    return ctx.reply('⏳ <b>Aapka ek video pehle se render ya queue me hai!</b> Kripya pehle uske complete hone ka wait karein.', { parse_mode: 'HTML' });
  }

  // 1 Free Video Trial, then Binance Paywall Check
  const access = UserService.checkAccess(userId);
  if (!access.allowed) {
    return sendPaymentInvoice(ctx, userId);
  }

  // Anti-Flood: 15s Cooldown
  const remaining = UserService.checkCooldown(userId, 15);
  if (remaining > 0) {
    return ctx.reply(`⏱️ <b>Anti-Flood Cooldown:</b> Kripya ${remaining} seconds wait karein naya request bhejne se pehle.`, { parse_mode: 'HTML' });
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

  // Initialize active render job
  activeRenderJobs.set(userId.toString(), {
    userId: userId.toString(),
    prompt: safePreview,
    aspectRatio,
    requestedDuration,
    jobId: null,
    stage: '⏳ Initializing GPU slot...',
    percent: 5,
    startedAt: Date.now(),
    lastUpdated: Date.now(),
  });

  try {
    await QueueService.enqueue({
      userId,
      onQueueWaiting: async (pos) => {
        const estSec = pos * 45;
        try {
          const queueText = `⏳ <b>Server Busy hai (GPU Slots Full)</b>\n\n📋 <b>Queue Position:</b> #${pos}\n⏱️ <b>Est. Wait:</b> ~${estSec}s\n\nJaise hi slot free hoga, video auto-render start ho jayega!`;
          if (!statusMessage) {
            statusMessage = await ctx.reply(queueText, {
              parse_mode: 'HTML',
              reply_markup: getRenderKeyboard(userId),
            });
          } else {
            await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, queueText, {
              parse_mode: 'HTML',
              reply_markup: getRenderKeyboard(userId),
            });
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
              reply_markup: getRenderKeyboard(userId),
            });
          } else {
            statusMessage = await ctx.reply(startText, {
              parse_mode: 'HTML',
              reply_markup: getRenderKeyboard(userId),
            });
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
            const job = activeRenderJobs.get(userId.toString());
            if (job) {
              job.jobId = jobId || job.jobId;
              job.stage = stage;
              job.percent = percent;
              job.lastUpdated = now;
            }

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
                  reply_markup: getRenderKeyboard(userId),
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
          activeRenderJobs.delete(userId.toString());
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
          const job = activeRenderJobs.get(userId.toString());
          if (job) {
            job.jobId = result.jobId;
            job.stage = '🎬 Neural rendering in GPU background...';
            job.percent = 30;
          }

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
              await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, waitCard, {
                parse_mode: 'HTML',
                reply_markup: getRenderKeyboard(userId),
              });
            } catch (e) { }
          } else {
            statusMessage = await ctx.reply(waitCard, {
              parse_mode: 'HTML',
              reply_markup: getRenderKeyboard(userId),
            });
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
                  const currentJob = activeRenderJobs.get(userId.toString());
                  if (currentJob) {
                    currentJob.percent = percent;
                    currentJob.stage = stage;
                    currentJob.lastUpdated = now;
                  }

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
                        reply_markup: getRenderKeyboard(userId),
                      });
                    }
                  } catch (editErr) {
                    // Ignore transient rate limits
                  }
                }
              );

              activeRenderJobs.delete(userId.toString());

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
              activeRenderJobs.delete(userId.toString());
              console.error('Background delivery error for Job', result.jobId, bgErr.message);
            }
          })().catch(() => { });
        } else {
          activeRenderJobs.delete(userId.toString());
          await ctx.reply(
            `⚠️ Video submission note:\n${escapeHtml((result.text || '').slice(0, 1000))}\n\nKripya thoda wait karein ya naya prompt try karein.`,
            { parse_mode: 'HTML' }
          );
        }
      },
    });
  } catch (error) {
    activeRenderJobs.delete(userId.toString());
    console.error('Error in video generation queue:', error);
    await ctx.reply(
      `❌ Generation Failed:\n${error.message || error}\n\nPlease try again or verify prompt parameters.`
    );
  } finally {
    UserService.stopGenerating(userId);
  }
}

/**
 * Handle user clicking [ 🔄 Refresh Status ] button under video progress
 */
export async function handleRefreshRender(ctx) {
  const data = ctx.callbackQuery?.data || '';
  const targetUserId = data.replace('refresh_render_', '') || ctx.from?.id?.toString();
  const job = activeRenderJobs.get(targetUserId);

  if (!job) {
    try {
      await ctx.answerCallbackQuery({
        text: '✅ Video render complete ho chuka hai ya koi active generation nahi hai.',
        show_alert: false,
      });
    } catch (e) { }
    return;
  }

  const elapsedSec = Math.floor((Date.now() - job.startedAt) / 1000);
  const nowTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

  try {
    await ctx.answerCallbackQuery({
      text: `⚡ ${job.stage} (${job.percent}%) - ${elapsedSec}s`,
      show_alert: false,
    });
  } catch (e) { }

  try {
    const bar = makeProgressBar(job.percent, 10);
    const cardText = `<b>🚀 GPU Slot Active! Generating with Seedance 2.5 ⚡</b>\n\n` +
      `📝 <b>Prompt:</b> "${job.prompt}"\n` +
      `📐 <b>Ratio:</b> ${job.aspectRatio} | ⏱️ <b>Duration:</b> ${job.requestedDuration}s\n` +
      `📌 <b>Job ID:</b> <code>${job.jobId ? job.jobId.slice(0, 13) + '...' : 'Allocating...'}</code>\n\n` +
      `<pre>${bar}</pre>\n` +
      `🔄 <b>Live Status:</b> ${escapeHtml(job.stage)}\n` +
      `⏱️ <b>Time Elapsed:</b> ${elapsedSec}s\n` +
      `🕒 <i>(Refreshed: ${nowTime})</i>\n\n` +
      `⚡ <i>Powered by earnifyXAutomation</i>`;

    await ctx.editMessageText(cardText, {
      parse_mode: 'HTML',
      reply_markup: getRenderKeyboard(targetUserId),
    });
  } catch (editErr) {
    // Ignore message not modified
  }
}

export async function handleVideoGenerationAction(ctx) {
  return handleVideoCommand(ctx);
}
