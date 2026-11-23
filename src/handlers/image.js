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

  await ctx.reply(`🎨 Creating Image:\n"${prompt.slice(0, 200)}..."\n\n⏳ Rendering high-res visual...`);

  try {
    const result = await HiggsfieldService.generateImage(prompt, '1:1');
    UserService.recordGeneration(userId);

    if (result.imageUrl) {
      await ctx.replyWithPhoto(result.imageUrl, {
        caption: `🖼️ Generated Visual\n\n⚡ Powered by earnifyXAutomation`,
      });
    } else {
      await ctx.reply(
        `✅ Result:\n\n${(result.text || '').slice(0, 3000)}\n\n⚡ Powered by earnifyXAutomation`
      );
    }
  } catch (error) {
    console.error('Error in handleImageCommand:', error);
    await ctx.reply(`❌ Failed to generate image:\n${error.message || error}`);
  } finally {
    UserService.stopGenerating(userId);
  }
}
