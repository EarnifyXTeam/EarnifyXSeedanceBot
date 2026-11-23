import fs from 'fs';
import path from 'path';
import axios from 'axios';

const VIDEO_DIR = path.resolve('downloads', 'videos');
const PROMPT_DIR = path.resolve('downloads', 'prompts');

const newVideos = [
  {
    id: '3d93003a-a9ae-4da8-af2d-08fa3c6296bd',
    fileName: '26_3d93003a.mp4',
    promptFileName: '26_3d93003a_prompt.txt',
    url: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_101020_3d93003a-a9ae-4da8-af2d-08fa3c6296bd.mp4',
    prompt: 'Seedance 2.5 cinematic video generation via Telegram bot',
    duration: '10s',
    ratio: '9:16'
  },
  {
    id: '988e17a1-f6cd-4b81-92f5-7e3ed1dbf690',
    fileName: '27_988e17a1.mp4',
    promptFileName: '27_988e17a1_prompt.txt',
    url: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_100608_988e17a1-f6cd-4b81-92f5-7e3ed1dbf690.mp4',
    prompt: 'Seedance 2.5 dynamic motion video generation',
    duration: '5s',
    ratio: '9:16'
  },
  {
    id: '8ba58010-2e15-4b22-b9ea-175c0adc3007',
    fileName: '28_8ba58010.mp4',
    promptFileName: '28_8ba58010_prompt.txt',
    url: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_092353_8ba58010-2e15-4b22-b9ea-175c0adc3007.mp4',
    prompt: 'Seedance 2.5 ultra realistic render',
    duration: '5s',
    ratio: '9:16'
  },
  {
    id: '867cd81b-d862-4cf8-b0bf-4254bf4215e5',
    fileName: '29_867cd81b.mp4',
    promptFileName: '29_867cd81b_prompt.txt',
    url: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_085747_867cd81b-d862-4cf8-b0bf-4254bf4215e5.mp4',
    prompt: 'Seedance 2.5 cinematic motion shot',
    duration: '5s',
    ratio: '9:16'
  },
  {
    id: '9c944261-b46c-44d4-8574-aed19981d70a',
    fileName: '30_9c944261.mp4',
    promptFileName: '30_9c944261_prompt.txt',
    url: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261123_084142_9c944261-b46c-44d4-8574-aed19981d70a.mp4',
    prompt: 'Seedance 2.5 high speed action capture',
    duration: '5s',
    ratio: '9:16'
  },
  {
    id: '3e68e2f9-5815-4993-a8a0-162e6ad92130',
    fileName: '31_3e68e2f9.mp4',
    promptFileName: '31_3e68e2f9_prompt.txt',
    url: 'https://d8j0ntlcm91z4.cloudfront.net/user_3MTN50wnWMSnpGT5KYU5L0MycDP/hf_20261122_194704_3e68e2f9-5815-4993-a8a0-162e6ad92130.mp4',
    prompt: 'Seedance 2.5 initial test generation',
    duration: '5s',
    ratio: '9:16'
  }
];

async function downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 120000,
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function run() {
  if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
  if (!fs.existsSync(PROMPT_DIR)) fs.mkdirSync(PROMPT_DIR, { recursive: true });

  console.log(`⬇️ Downloading ${newVideos.length} new videos to laptop...`);

  for (let i = 0; i < newVideos.length; i++) {
    const v = newVideos[i];
    const videoPath = path.join(VIDEO_DIR, v.fileName);
    const promptPath = path.join(PROMPT_DIR, v.promptFileName);

    // Save prompt
    const promptContent = `========================================================
EarnifyX | Seedance 2.5 Video Generation
========================================================
Job ID       : ${v.id}
File Name    : ${v.fileName}
Duration     : ${v.duration}
Aspect Ratio : ${v.ratio}
Model        : seedance_2_5
Direct URL   : ${v.url}

PROMPT:
--------------------------------------------------------
${v.prompt}
========================================================
`;
    fs.writeFileSync(promptPath, promptContent, 'utf-8');

    if (fs.existsSync(videoPath) && fs.statSync(videoPath).size > 10000) {
      console.log(`[${i + 1}/${newVideos.length}] ⏩ Already exists: ${v.fileName}`);
    } else {
      console.log(`[${i + 1}/${newVideos.length}] ⬇️ Downloading: ${v.fileName}...`);
      await downloadFile(v.url, videoPath);
      const sizeMb = (fs.statSync(videoPath).size / (1024 * 1024)).toFixed(2);
      console.log(`[${i + 1}/${newVideos.length}] ✅ Saved: ${v.fileName} (${sizeMb} MB)`);
    }
  }

  console.log('\n🎉 All missing videos downloaded successfully!');
}

run().catch((e) => {
  console.error('Error downloading:', e);
  process.exit(1);
});
