import { InlineKeyboard } from 'grammy';

export async function handleStart(ctx) {
  const userName = ctx.from?.first_name || 'Creator';

  const welcomeMessage = `
👋 **Welcome, ${userName}!**

I am **EarnifyXSeedanceBot**, your AI Video & Media Generation powerhouse powered by **Seedance 2.5** & **Higgsfield MCP**! 🚀

Crafted with ❤️ for the **earnifyXAutomation** community.

---
⚡ **Quick Commands:**
🎬 \`/video <prompt>\` — Cinematic AI Video (Seedance 2.5)
🖼️ \`/image <prompt>\` — High-Res AI Images
🎙️ \`/audio <text>\` — Studio AI Voiceover
📊 \`/status\` — View active plan & credits
ℹ️ \`/help\` — Tips for writing the best prompts

Tap a button below to get started!
  `.trim();

  const keyboard = new InlineKeyboard()
    .text('🎬 Generate Video', 'btn_video_help')
    .text('🖼️ Generate Image', 'btn_image_help')
    .row()
    .text('📊 Check Status', 'btn_status')
    .text('ℹ️ Prompt Guide', 'btn_help')
    .row()
    .url('🌐 Join Community', 'https://t.me/EarnifyXSeedanceBot');

  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
