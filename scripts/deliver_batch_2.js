import 'dotenv/config';
import { Bot } from 'grammy';
import fs from 'fs';
import path from 'path';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = '7150803046';

async function deliverBatch2() {
  console.log('🚀 Starting Batch 2 Automated Video Delivery...');

  const creationsPath = path.resolve('data/creations.json');
  const creations = JSON.parse(fs.readFileSync(creationsPath, 'utf8') || '[]');

  const deliveries = [
    {
      userId: '8108652020',
      name: 'Subrat',
      username: '@Rainbow_Spidey',
      title: 'Cinematic Drone Flythrough - Futuristic Neon Tokyo (30s 4K 60fps)',
      videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_152222_77ff8520-58cf-4212-ae70-88bdc2abd83c.mp4',
      caption: `🎬 *Aapka Seedance 2.5 AI Video Deliver Ho Gaya Hai!* ⚡\n\n📌 *Scene:* Futuristic Neon Tokyo Cinematic Drone Flythrough (30s 4K 60fps)\n⚙️ *Engine:* Seedance 2.5 Pro\n💎 *Access:* 100% Free Lifetime Access\n\n_Generated with ❤️ by EarnifyX AutoVideo Studio (@EarnifyXSeedanceBot)_`
    },
    {
      userId: '7155205118',
      name: 'Jatinnn',
      username: '@jatinnrajjput',
      title: 'Baby Jimmy & Parents Family Prank Reel (30s)',
      videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_143432_c5b36d69-f114-40c5-979c-5e74f37e657c.mp4',
      caption: `🎬 *Aapka Seedance 2.5 New Family Comedy Video Ready Hai!* ⚡\n\n📌 *Scene:* Baby Jimmy Whipped-Cream Family Prank (30s Ultra-Realistic)\n⚙️ *Engine:* Seedance 2.5 Home-Video Realism\n💎 *Access:* 100% Free Lifetime Access\n\n_Generated with ❤️ by EarnifyX AutoVideo Studio (@EarnifyXSeedanceBot)_`
    },
    {
      userId: '1083867078',
      name: 'King',
      username: '@KingFaizii',
      title: 'Supermarket Snacks Family Comedy (15s)',
      videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_133158_6571eba7-57cb-4729-ba73-cce8f1ad47b3.mp4',
      caption: `🎬 *Aapka Seedance 2.5 New Video Ready Hai!* ⚡\n\n📌 *Scene:* Supermarket Snacks Family Comedy (15s iPhone Realism)\n⚙️ *Engine:* Seedance 2.5\n💎 *Access:* 100% Free Lifetime Access\n\n_Generated with ❤️ by EarnifyX AutoVideo Studio (@EarnifyXSeedanceBot)_`
    }
  ];

  const queueUpdates = [
    {
      userId: '806564583',
      name: 'Ahan',
      username: '@Ahan509',
      message: `⏳ *EarnifyX Video Generation In Progress*\n\nNamaste Ahan! Aapka 30-second Two-Tone Emerald Tree Boa vs Ant Colony macro documentary video Seedance 2.5 GPU cluster me actively queued hai.\nRender complete hote hi video automatically yaha send ho jayega! ⚡`
    },
    {
      userId: '8637244968',
      name: 'Prince',
      username: '@Princemax42',
      message: `⏳ *EarnifyX Video Generation In Progress*\n\nNamaste Prince! Aapka 15-second Macro Nature Documentary video prompt GPU render pipeline me hai.\nRender complete hote hi video aapke chat me deliver ho jayega! ⚡`
    }
  ];

  const deliveryReport = [];

  for (const item of deliveries) {
    try {
      console.log(`Sending video to ${item.name} (${item.userId})...`);
      const sent = await bot.api.sendVideo(item.userId, item.videoUrl, {
        caption: item.caption,
        parse_mode: 'Markdown'
      });
      console.log(`✅ Delivered to ${item.name} (${item.userId})! Message ID: ${sent.message_id}`);
      deliveryReport.push({
        userId: item.userId,
        name: item.name,
        username: item.username,
        title: item.title,
        status: 'Delivered',
        error: null
      });

      // Update in creations
      const match = creations.find(c => c.userId === item.userId && (!c.url || c.url === ''));
      if (match) match.url = item.videoUrl;
    } catch (err) {
      console.error(`❌ Failed delivering to ${item.name} (${item.userId}):`, err.message);
      deliveryReport.push({
        userId: item.userId,
        name: item.name,
        username: item.username,
        title: item.title,
        status: 'Failed',
        error: err.message
      });
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  for (const item of queueUpdates) {
    try {
      console.log(`Sending queue notice to ${item.name} (${item.userId})...`);
      await bot.api.sendMessage(item.userId, item.message, { parse_mode: 'Markdown' });
      console.log(`✅ Queue notice sent to ${item.name}`);
    } catch (err) {
      console.error(`❌ Notice failed for ${item.name}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Save creations
  fs.writeFileSync(creationsPath, JSON.stringify(creations, null, 2), 'utf8');

  // Notify Admin Suraj
  let adminMsg = `📢 *EarnifyX Batch 2 Video Delivery Report* 📊\n\n` +
    `👥 *Total Users in Community:* 32 Users\n` +
    `✅ *New Videos Delivered:* ${deliveryReport.filter(d => d.status === 'Delivered').length} Videos\n\n` +
    `🎬 *DELIVERY DETAILS:*\n`;

  deliveryReport.forEach((d, i) => {
    const icon = d.status === 'Delivered' ? '✅' : '❌';
    adminMsg += `${i + 1}. ${icon} *${d.name}* (${d.username || d.userId})\n` +
      `   📹 ${d.title}\n` +
      `   Status: ${d.status}${d.error ? ` (${d.error})` : ''}\n`;
  });

  adminMsg += `\n⚡ _All users enjoy 100% Free Lifetime Access on @EarnifyXSeedanceBot!_`;

  try {
    console.log(`Sending summary to Admin ${ADMIN_ID}...`);
    await bot.api.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
    console.log('✅ Admin Notification sent successfully!');
  } catch (err) {
    console.error('❌ Failed admin notification:', err.message);
  }

  console.log('=== BATCH 2 COMPLETED ===');
}

deliverBatch2().catch(console.error);
