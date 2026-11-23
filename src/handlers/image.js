import { HiggsfieldService } from '../services/higgsfieldService.js';
import { UserService } from '../services/userService.js';

export async function handleImageCommand(ctx) {
  const userId = ctx.from?.id;
  const prompt = ctx.match?.trim();

  if (!prompt) {
    const usageMsg = `
🖼️ **AI Image Generator**

To generate an image, provide a prompt:
👉 \`/image <your description>\`

**Examples:**
• \`/image futuristic cybernetic tiger portrait in misty rainforest, hyperrealistic 8k\`
• \`/image minimalist isometric 3D crypto trading room, vibrant lighting\`
    `.trim();

    return ctx.reply(usageMsg, { parse_mode: 'Markdown' });
  }

  if (UserService.isGenerating(userId)) {
    return ctx.reply('⏳ **Aapka ek task pehle se render ho raha hai!** Kripya wait karein.');
  }

  const remaining = UserService.checkCooldown(userId, 10);
  if (remaining > 0) {
    return ctx.reply(`⏱️ **Cooldown:** Kripya ${remaining} seconds wait karein.`);
  }

  UserService.startGenerating(userId);

  await ctx.reply(`🎨 **Creating Image:**\n"${prompt}"\n\n⏳ *Rendering high-res visual...*`, {
    parse_mode: 'Markdown',
  });

  try {
    const response = await HiggsfieldService.generateImage(prompt, '1:1');
    const urls = HiggsfieldService.extractUrls(response);
    const responseText = HiggsfieldService.getResponseText(response);

    UserService.recordGeneration(userId);

    const imageUrl = urls.find((u) => u.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i)) || urls[0];

    if (imageUrl) {
      await ctx.replyWithPhoto(imageUrl, {
        caption: `🖼️ **Generated Visual**\n\nPrompt: "${prompt}"\n\n⚡ *Powered by earnifyXAutomation*`,
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(
        `✅ **Generation Result:**\n\n${responseText.slice(0, 3500)}\n\n⚡ *Powered by earnifyXAutomation*`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Error in handleImageCommand:', error);
    await ctx.reply(`❌ **Failed to generate image:**\n\`${error.message || error}\``);
  } finally {
    UserService.stopGenerating(userId);
  }
}
