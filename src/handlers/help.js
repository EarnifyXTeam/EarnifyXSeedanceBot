export async function handleHelpCommand(ctx) {
  const guide = `
ℹ️ **EarnifyXSeedanceBot Prompting Guide**

🎯 **How to get cinematic Seedance 2.5 results:**
1. **Camera Angle & Motion:**
   • Use terms like: \`drone flythrough\`, \`slow tracking shot\`, \`cinematic pan\`, \`orbit shot\`.
2. **Lighting & Atmosphere:**
   • Mention: \`golden hour\`, \`cyberpunk neon lighting\`, \`foggy morning\`, \`soft volumetric light\`.
3. **Style & Quality:**
   • Add: \`hyperrealistic, 4K, 60fps, Unreal Engine 5 render, cinematic color grading\`.

---
⚡ **Available Commands:**
• \`/video <prompt>\` — AI Video with Seedance 2.5
• \`/image <prompt>\` — High-Res Photo Generation
• \`/audio <text>\` — Studio Speech Synthesis
• \`/status\` — View account balance & active plan
• \`/help\` — This guide

🌐 **earnifyXAutomation Community**
  `.trim();

  await ctx.reply(guide, { parse_mode: 'Markdown' });
}
