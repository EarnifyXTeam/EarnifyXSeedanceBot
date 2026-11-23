import { HistoryService } from '../services/historyService.js';

export async function handleMyVideos(ctx) {
  const userId = ctx.from?.id;
  const history = HistoryService.getUserHistory(userId, 5);

  if (history.length === 0) {
    return ctx.reply('📂 **Aapne abhi tak koi video generate nahi ki hai.**\n\nNayi video banane ke liye bhejein:\n👉 `/video <prompt>`');
  }

  let text = '📁 **Aapki Recent Generated Videos:**\n\n';
  history.forEach((item, index) => {
    const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    text += `${index + 1}️⃣ **Prompt:** "${item.prompt.slice(0, 80)}..."\n`;
    text += `   📐 **Ratio:** ${item.ratio || '9:16'} | 🕒 ${time}\n`;
    if (item.url) {
      text += `   🔗 [Download / Watch Video](${item.url})\n\n`;
    } else {
      text += '\n';
    }
  });

  text += '⚡ *Powered by earnifyXAutomation*';
  await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: false });
}

export async function handleRecentAudit(ctx) {
  const history = HistoryService.getGlobalHistory(10);

  if (history.length === 0) {
    return ctx.reply('📋 **Abhi tak kisi user ne generation complete nahi ki hai.**');
  }

  let text = '📊 **Global Live Generations Audit (Recent 10):**\n\n';
  history.forEach((item, index) => {
    const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    text += `${index + 1}️⃣ 👤 **User:** ${item.firstName} (${item.username})\n`;
    text += `   📝 **Prompt:** "${item.prompt.slice(0, 70)}..."\n`;
    text += `   🕒 **Time:** ${time}\n`;
    if (item.url) {
      text += `   🔗 [Watch Video](${item.url})\n\n`;
    } else {
      text += '\n';
    }
  });

  text += '⚡ *EarnifyX Real-Time Generation Tracker*';
  await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
}
