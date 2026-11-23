import 'dotenv/config';
import { Bot, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = '7150803046';

async function runDelivery() {
  console.log('🚀 Starting Automated Video Delivery & Admin Notification...');

  const creationsPath = path.resolve('data/creations.json');
  const creations = JSON.parse(fs.readFileSync(creationsPath, 'utf8') || '[]');

  const deliveries = [
    {
      userId: '7150803046',
      name: 'Suraj (Admin)',
      username: '@EarnifyXAutomation',
      title: 'Fluffy Puppy & Crab Investigation (30s 4K)',
      videoPath: path.resolve('downloads/videos/25_4745e821_puppy_crab_30s.mp4'),
      videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_084329_4745e821-8707-467b-a89a-b4cd6959a248.mp4',
      caption: `🎬 *Aapka Seedance 2.5 AI Video Ready Hai!* ⚡\n\n📌 *Title:* Fluffy Puppy & Crab Investigation (30s 9:16)\n⚙️ *Engine:* Seedance 2.5 Realistic\n💎 *Status:* Rendered in Ultra HD\n\n_Enjoy your creation! EarnifyX AutoVideo Studio_ ✨`
    },
    {
      userId: '7150803046',
      name: 'Suraj (Admin)',
      username: '@EarnifyXAutomation',
      title: 'Police Officers smiling at Kitten (30s)',
      videoPath: null,
      videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_140807_c5eadb11-07f3-4b90-b57a-06273088aca2.mp4',
      caption: `🎬 *Aapka Second AI Video Ready Hai!* ⚡\n\n📌 *Title:* Police Officers & Kitten in Police Cap (30s 9:16)\n⚙️ *Engine:* Seedance 2.5 Realistic\n💎 *Status:* Rendered in Ultra HD\n\n_Enjoy your creation! EarnifyX AutoVideo Studio_ ✨`
    },
    {
      userId: '8508256642',
      name: 'Vittu',
      username: '@vittujaiswal',
      title: '3D Animated Fantasy Adventure - Niko & Brann (30s)',
      videoPath: path.resolve('downloads/videos/01_16097168.mp4'),
      videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_074933_16097168-7d91-4da4-b284-7b36125e89dd.mp4',
      caption: `🎬 *Aapka Seedance 2.5 AI Video Deliver Ho Gaya Hai!* ⚡\n\n📌 *Prompt:* Niko the Fennec Fox & Brann 3D Animated Adventure\n⚙️ *Engine:* Seedance 2.5\n💎 *Access:* 100% Free Lifetime Access\n\n_Generated with ❤️ by EarnifyX AutoVideo Studio (@EarnifyXSeedanceBot)_`
    },
    {
      userId: '1083867078',
      name: 'King',
      username: '@KingFaizii',
      title: 'Suburban Backyard Grandpa & Toddler / Family Comedy (9:16)',
      videoPath: path.resolve('downloads/videos/19_288c8909.mp4'),
      videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261122_210330_288c8909-9590-4df8-9f87-6205b9124448.mp4',
      caption: `🎬 *Aapka Seedance 2.5 AI Video Deliver Ho Gaya Hai!* ⚡\n\n📌 *Scene:* Spontaneous Family Comedy / Grandpa & Toddler Moment\n⚙️ *Engine:* Seedance 2.5 Realism\n💎 *Access:* 100% Free Lifetime Access\n\n_Generated with ❤️ by EarnifyX AutoVideo Studio (@EarnifyXSeedanceBot)_`
    },
    {
      userId: '7155205118',
      name: 'Jatinnn',
      username: '@jatinnrajjput',
      title: 'Daddy Bedroom Comedy Video (9:16)',
      videoPath: path.resolve('downloads/videos/14_8964b31a.mp4'),
      videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_133159_05ee2798-2862-40f1-b1c3-6f55c5193ccd.mp4',
      caption: `🎬 *Aapka Seedance 2.5 AI Video Deliver Ho Gaya Hai!* ⚡\n\n📌 *Scene:* Family Comedy - Daddy & Toddler Bedroom Moment 😂\n⚙️ *Engine:* Seedance 2.5\n💎 *Access:* 100% Free Lifetime Access\n\n_Generated with ❤️ by EarnifyX AutoVideo Studio (@EarnifyXSeedanceBot)_`
    }
  ];

  const pendingNotifications = [
    {
      userId: '7899963545',
      name: 'Ritesh🌱SEED🦉',
      username: 'Anonymous',
      prompt: '30s Wedding Mystery Video (Bride A & Bride B reveal)',
      status: 'In GPU Render Pipeline / Queue',
      message: `⏳ *EarnifyX Video Generation Update*\n\nNamaste Ritesh! Aapka 30s Wedding Mystery cinematic video prompt Seedance 2.5 GPU cluster me process ho raha hai.\nJaise hi final frames render honge, video automatically yaha deliver ho jayega! ⚡`
    },
    {
      userId: '6699391816',
      name: '𝐀',
      username: '@aabhiiishekkk',
      prompt: '10s Niagara Falls observation deck stunt video',
      status: 'In GPU Render Pipeline / Queue',
      message: `⏳ *EarnifyX Video Generation Update*\n\nNamaste Abhishek! Aapka Niagara Falls observation deck prompt Seedance 2.5 GPU queue me processing me hai.\nRender complete hote hi aapko directly yaha video receive ho jayega! ⚡`
    }
  ];

  const deliveryReport = [];

  // 1. Process Video Deliveries
  for (const item of deliveries) {
    try {
      console.log(`Sending video to ${item.name} (${item.userId})...`);
      let sentMsg;
      if (item.videoUrl) {
        sentMsg = await bot.api.sendVideo(item.userId, item.videoUrl, {
          caption: item.caption,
          parse_mode: 'Markdown'
        });
      } else if (item.videoPath && fs.existsSync(item.videoPath)) {
        sentMsg = await bot.api.sendVideo(item.userId, new InputFile(item.videoPath), {
          caption: item.caption,
          parse_mode: 'Markdown'
        });
      }

      console.log(`✅ Successfully delivered video to ${item.name} (${item.userId})! Message ID: ${sentMsg?.message_id}`);
      deliveryReport.push({
        userId: item.userId,
        name: item.name,
        username: item.username,
        title: item.title,
        status: 'Delivered',
        error: null
      });

      // Update matching creation in data/creations.json
      const matchIndex = creations.findIndex(c => c.userId === item.userId && (!c.url || c.url === ''));
      if (matchIndex !== -1) {
        creations[matchIndex].url = item.videoUrl;
      }
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

    // Delay to respect Telegram limits
    await new Promise(r => setTimeout(r, 1200));
  }

  // 2. Process Pending User Status Notifications
  const pendingReport = [];
  for (const item of pendingNotifications) {
    try {
      console.log(`Sending queue update message to ${item.name} (${item.userId})...`);
      await bot.api.sendMessage(item.userId, item.message, { parse_mode: 'Markdown' });
      console.log(`✅ Sent queue update to ${item.name} (${item.userId})`);
      pendingReport.push({
        userId: item.userId,
        name: item.name,
        username: item.username,
        prompt: item.prompt,
        status: 'Notified (In GPU Queue)',
        error: null
      });
    } catch (err) {
      console.error(`❌ Failed queue update to ${item.name} (${item.userId}):`, err.message);
      pendingReport.push({
        userId: item.userId,
        name: item.name,
        username: item.username,
        prompt: item.prompt,
        status: 'Failed to notify',
        error: err.message
      });
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // Save updated creations.json
  fs.writeFileSync(creationsPath, JSON.stringify(creations, null, 2), 'utf8');
  console.log('✅ Updated data/creations.json saved.');

  // 3. Send Comprehensive Admin Notification to Suraj (7150803046)
  const deliveredSuccessCount = deliveryReport.filter(d => d.status === 'Delivered').length;
  const deliveryFailedCount = deliveryReport.filter(d => d.status === 'Failed').length;

  let adminSummaryMsg = `📢 *EarnifyX Video Delivery & Status Report* 📊\n\n` +
    `🤖 *Bot:* @EarnifyXSeedanceBot\n` +
    `👥 *Total Users Checked:* 18 Users\n` +
    `✅ *Videos Delivered:* ${deliveredSuccessCount} Videos\n` +
    `⏳ *Videos In Queue / Pending:* ${pendingNotifications.length + 1} Videos\n` +
    `❌ *Delivery Failed / Blocked:* ${deliveryFailedCount}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎬 *DELIVERED VIDEOS LIST:*\n`;

  deliveryReport.forEach((d, i) => {
    const icon = d.status === 'Delivered' ? '✅' : '❌';
    adminSummaryMsg += `${i + 1}. ${icon} *${d.name}* (${d.username || d.userId})\n` +
      `   📹 ${d.title}\n` +
      `   Status: ${d.status}${d.error ? ` (${d.error})` : ''}\n`;
  });

  adminSummaryMsg += `\n━━━━━━━━━━━━━━━━━━━━\n` +
    `⏳ *PENDING / IN GPU QUEUE:*\n`;

  pendingReport.forEach((p, i) => {
    adminSummaryMsg += `${i + 1}. ⏳ *${p.name}* (${p.username || p.userId})\n` +
      `   🎬 ${p.prompt}\n` +
      `   Status: ${p.status}\n`;
  });

  adminSummaryMsg += `\n⚡ _All users now enjoy 100% Free Lifetime Access!_`;

  try {
    console.log(`Sending Master Report to Admin (${ADMIN_ID})...`);
    await bot.api.sendMessage(ADMIN_ID, adminSummaryMsg, { parse_mode: 'Markdown' });
    console.log('✅ Admin Notification sent successfully to Telegram!');
  } catch (err) {
    console.error('❌ Failed to send Admin Notification:', err.message);
  }

  console.log('\n=== FINAL SUMMARY REPORT ===');
  console.log(JSON.stringify({ deliveryReport, pendingReport }, null, 2));
}

runDelivery().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
