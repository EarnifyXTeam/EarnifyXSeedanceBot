import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config.js';

const deliveries = [
  {
    userId: '7150803046',
    name: 'Suraj',
    username: '@EarnifyXAutomation',
    promptTitle: '🐶 Golden Puppy & Crab Adventure (30s Vertical)',
    videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_084329_4745e821-8707-467b-a89a-b4cd6959a248.mp4',
    duration: '30s',
  },
  {
    userId: '7155205118',
    name: 'Jatinnn',
    username: '@jatinnrajjput',
    promptTitle: '😂 Family Bedroom Comedy — "Daddy, What Do You Do In The Bedroom?" (30s Vertical)',
    videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_074228_be00930e-74db-451f-881e-7ea8f8e2305a.mp4',
    duration: '30s',
  },
  {
    userId: '8508256642',
    name: 'Vittu',
    username: '@vittujaiswal',
    promptTitle: '🦊 3D Animated Fantasy Adventure — Niko & Brann (30s Vertical)',
    videoUrl: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_074933_16097168-7d91-4da4-b284-7b36125e89dd.mp4',
    duration: '30s',
  },
];

async function deliverVideos() {
  console.log('🚀 Starting video delivery to users...');
  const token = config.telegramToken;

  for (const d of deliveries) {
    console.log(`\n📤 Sending video to ${d.name} (${d.username}) [Chat ID: ${d.userId}]...`);

    const caption = `🎬 <b>Aapka Video Ready Hai!</b> (Seedance 2.5)\n\n📌 <b>Title:</b> ${d.promptTitle}\n⏱️ <b>Duration:</b> ${d.duration} | 📐 <b>Ratio:</b> 9:16\n\n⚡ <i>Powered by earnifyXAutomation</i>`;

    try {
      const response = await axios.post(`https://api.telegram.org/bot${token}/sendVideo`, {
        chat_id: d.userId,
        video: d.videoUrl,
        caption: caption,
        parse_mode: 'HTML',
      }, { timeout: 60000 });

      if (response.data?.ok) {
        console.log(`✅ Successfully delivered video to ${d.name} (${d.username})! Message ID: ${response.data.result.message_id}`);
      } else {
        console.warn(`⚠️ Telegram response not OK for ${d.name}:`, response.data);
      }
    } catch (err) {
      console.error(`❌ Failed to deliver to ${d.name}:`, err.response?.data || err.message);
    }
  }

  // Update creations.json with URLs
  try {
    const creationsPath = path.resolve('data', 'creations.json');
    if (fs.existsSync(creationsPath)) {
      const creations = JSON.parse(fs.readFileSync(creationsPath, 'utf-8'));
      for (const item of creations) {
        const match = deliveries.find(d => d.userId === item.userId);
        if (match && !item.url) {
          item.url = match.videoUrl;
        }
      }
      fs.writeFileSync(creationsPath, JSON.stringify(creations, null, 2), 'utf-8');
      console.log('\n📝 Updated data/creations.json with completed video URLs.');
    }
  } catch (e) {
    console.error('Error updating creations.json:', e.message);
  }

  console.log('\n🎉 Video delivery process complete!');
  process.exit(0);
}

deliverVideos().catch(console.error);
