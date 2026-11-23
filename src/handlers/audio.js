import { HiggsfieldService } from '../services/higgsfieldService.js';

export async function handleAudioCommand(ctx) {
  const text = ctx.match?.trim();

  if (!text) {
    const usageMsg = `
🎙️ **AI Voice & Audio Generator**

To generate speech or audio, provide your script:
👉 \`/audio <text to speak>\`

**Example:**
• \`/audio Welcome to earnifyXAutomation! In this guide, we explore how to automate your creative workflow.\`
    `.trim();

    return ctx.reply(usageMsg, { parse_mode: 'Markdown' });
  }

  await ctx.reply(`🎙️ **Synthesizing Audio...**\n\n"${text}"\n\n⏳ *Please wait...*`, {
    parse_mode: 'Markdown',
  });

  try {
    const response = await HiggsfieldService.generateAudio(text);
    const urls = HiggsfieldService.extractUrls(response);
    const responseText = HiggsfieldService.getResponseText(response);

    const audioUrl = urls.find((u) => u.match(/\.(mp3|wav|ogg)(\?.*)?$/i)) || urls[0];

    if (audioUrl) {
      await ctx.replyWithAudio(audioUrl, {
        caption: `🎙️ **AI Voiceover Complete**\n\nScript: "${text.slice(0, 100)}..."\n\n⚡ *Powered by earnifyXAutomation*`,
      });
    } else {
      await ctx.reply(
        `✅ **Audio Generation Result:**\n\n${responseText.slice(0, 3500)}\n\n⚡ *Powered by earnifyXAutomation*`
      );
    }
  } catch (error) {
    console.error('Error in handleAudioCommand:', error);
    await ctx.reply(`❌ **Failed to generate audio:**\n\`${error.message || error}\``);
  }
}
