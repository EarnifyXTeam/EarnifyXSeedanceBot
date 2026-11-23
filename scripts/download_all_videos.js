import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { mcpClient } from '../src/mcpClient.js';

const VIDEO_DIR = path.resolve('downloads', 'videos');
const PROMPT_DIR = path.resolve('downloads', 'prompts');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

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

async function main() {
  console.log('🚀 Fetching all Higgsfield generations to save locally...');
  await ensureDir(VIDEO_DIR);
  await ensureDir(PROMPT_DIR);

  // 1. Fetch generations list from MCP
  const res = await mcpClient.callTool('show_generations', {}, 30000);
  const text = res?.content?.[0]?.text || '';
  const lines = text.split('\n');

  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('items[') || trimmed.startsWith('next_cursor')) continue;

    // Format: id,type,status,model,"url",createdAt
    const parts = trimmed.split(',');
    if (parts.length >= 5) {
      const id = parts[0].trim();
      const type = parts[1]?.trim();
      const status = parts[2]?.trim();
      const model = parts[3]?.trim();
      const rawUrl = parts[4]?.replace(/^"|"$/g, '').trim();
      const createdAt = parts[5]?.trim();

      if (id && rawUrl && rawUrl.startsWith('http') && status === 'completed') {
        items.push({ id, type, status, model, url: rawUrl, createdAt });
      }
    }
  }

  console.log(`📌 Found ${items.length} completed items from Higgsfield.`);

  if (items.length === 0) {
    console.log('No completed videos found to download.');
    process.exit(0);
  }

  // 2. Fetch prompt details in batches using show_generation_by_ids
  console.log('🔍 Fetching prompt details for each generation...');
  const batchJobs = items.map((item, idx) => ({ index: idx, job_id: item.id }));

  let jobDetails = new Map();
  try {
    const detailsRes = await mcpClient.callTool('show_generation_by_ids', { jobs: batchJobs }, 60000);
    const detailItems = detailsRes?.structuredContent?.items || [];
    for (const d of detailItems) {
      jobDetails.set(d.id, d);
    }
  } catch (err) {
    console.warn('⚠️ Could not fetch all details in one batch, will fetch individually if needed:', err.message);
  }

  // 3. Download each video and write prompt file
  const summaryList = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const indexNum = String(i + 1).padStart(2, '0');
    let detail = jobDetails.get(item.id);

    if (!detail) {
      try {
        const singleRes = await mcpClient.callTool('show_generation_by_ids', { jobs: [{ index: 0, job_id: item.id }] }, 15000);
        detail = singleRes?.structuredContent?.items?.[0];
      } catch (e) {
        // non-fatal
      }
    }

    const promptText = detail?.params?.prompt || '(Prompt not returned by API)';
    const duration = detail?.params?.duration ? `${detail.params.duration}s` : 'unknown';
    const aspectRatio = detail?.params?.aspect_ratio || '9:16';
    const model = detail?.model || item.model || 'seedance_2_5';
    const cleanId = item.id.slice(0, 8);

    const videoFileName = `${indexNum}_${cleanId}.mp4`;
    const promptFileName = `${indexNum}_${cleanId}_prompt.txt`;
    const videoFilePath = path.join(VIDEO_DIR, videoFileName);
    const promptFilePath = path.join(PROMPT_DIR, promptFileName);

    // Write Prompt File
    const promptContent = `========================================================
EarnifyX | Seedance 2.5 Video Generation
========================================================
Job ID       : ${item.id}
File Name    : ${videoFileName}
Duration     : ${duration}
Aspect Ratio : ${aspectRatio}
Model        : ${model}
Direct URL   : ${item.url}
Created At   : ${detail?.createdAt ? new Date(detail.createdAt * 1000).toLocaleString('en-IN') : 'N/A'}

PROMPT:
--------------------------------------------------------
${promptText}
========================================================
`;
    fs.writeFileSync(promptFilePath, promptContent, 'utf-8');

    // Download Video if not already downloaded
    if (fs.existsSync(videoFilePath) && fs.statSync(videoFilePath).size > 10000) {
      console.log(`[${indexNum}/${items.length}] ⏩ Already downloaded: ${videoFileName}`);
    } else {
      console.log(`[${indexNum}/${items.length}] ⬇️ Downloading: ${videoFileName}...`);
      try {
        await downloadFile(item.url, videoFilePath);
        console.log(`[${indexNum}/${items.length}] ✅ Saved: ${videoFileName} (${(fs.statSync(videoFilePath).size / (1024 * 1024)).toFixed(2)} MB)`);
      } catch (dlErr) {
        console.error(`❌ Failed to download ${item.url}:`, dlErr.message);
      }
    }

    summaryList.push({
      index: indexNum,
      id: item.id,
      videoFile: videoFileName,
      promptFile: promptFileName,
      duration,
      aspectRatio,
      prompt: promptText,
      url: item.url,
    });
  }

  // 4. Generate README.md index in downloads folder
  let readme = `# 🎬 EarnifyX Seedance 2.5 Video Library\n\n`;
  readme += `Total Videos: **${summaryList.length}**\n\n`;
  readme += `| # | Preview / File | Duration | Ratio | Prompt | Direct Link |\n`;
  readme += `|---|---|---|---|---|---|\n`;

  for (const s of summaryList) {
    const shortPrompt = s.prompt.length > 100 ? s.prompt.slice(0, 100) + '...' : s.prompt;
    readme += `| ${s.index} | **\`${s.videoFile}\`** | ${s.duration} | ${s.aspectRatio} | ${shortPrompt.replace(/\n/g, ' ')} | [Download CDN](${s.url}) |\n`;
  }

  fs.writeFileSync(path.join(path.resolve('downloads'), 'README.md'), readme, 'utf-8');

  console.log(`\n🎉 All ${summaryList.length} videos downloaded and saved into:\n📁 ${VIDEO_DIR}\n📝 Prompts in: ${PROMPT_DIR}`);
  console.log(`📄 Check ${path.join(path.resolve('downloads'), 'README.md')} for the complete catalog!`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
