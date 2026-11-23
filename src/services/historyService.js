import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DATA_DIR = path.resolve('data');
const CREATIONS_FILE = path.join(DATA_DIR, 'creations.json');
const DOWNLOAD_DIR = path.resolve('downloads', 'videos');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

let creations = [];

try {
  if (fs.existsSync(CREATIONS_FILE)) {
    creations = JSON.parse(fs.readFileSync(CREATIONS_FILE, 'utf-8'));
  }
} catch (e) {
  creations = [];
}

function saveCreations() {
  try {
    // Keep last 1000 creations to avoid memory bloat
    if (creations.length > 1000) {
      creations = creations.slice(0, 1000);
    }
    fs.writeFileSync(CREATIONS_FILE, JSON.stringify(creations, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving creations.json:', e);
  }
}

/**
 * Background local file downloader
 */
async function autoSaveLocally(record, duration = '5s') {
  if (!record.url || !record.url.startsWith('http')) return;
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeUser = (record.username || 'user').replace(/[^a-zA-Z0-9_]/g, '');
    const cleanId = record.id || Math.random().toString(36).substring(2, 8);

    const ext = record.type === 'video' ? 'mp4' : record.type === 'audio' ? 'mp3' : 'png';
    const mediaFileName = `${timestamp}_${safeUser}_${cleanId}.${ext}`;
    const promptFileName = `${timestamp}_${safeUser}_${cleanId}_prompt.txt`;

    const mediaPath = path.join(DOWNLOAD_DIR, mediaFileName);
    const promptPath = path.join(DOWNLOAD_DIR, promptFileName);

    // Save prompt txt
    const promptContent = `========================================================
EarnifyX Video Generation Archive
========================================================
ID           : ${record.id}
User         : ${record.firstName} (${record.username}) [${record.userId}]
Type         : ${record.type}
Duration     : ${duration}
Aspect Ratio : ${record.ratio || '9:16'}
Created At   : ${new Date().toLocaleString('en-IN')}
Direct URL   : ${record.url}

PROMPT:
--------------------------------------------------------
${record.prompt}
========================================================
`;
    fs.writeFileSync(promptPath, promptContent, 'utf-8');

    // Download media stream
    const writer = fs.createWriteStream(mediaPath);
    const response = await axios({
      url: record.url,
      method: 'GET',
      responseType: 'stream',
      timeout: 120000,
    });
    response.data.pipe(writer);

    writer.on('finish', () => {
      console.log(`📁 Auto-archived to local folder: ${mediaFileName}`);
    });
    writer.on('error', (err) => {
      console.warn(`⚠️ Failed to auto-archive file ${mediaFileName}:`, err.message);
    });
  } catch (err) {
    console.warn('⚠️ Auto-archive skipped:', err.message);
  }
}

export class HistoryService {
  /**
   * Log a successful generation and automatically download to local folder
   */
  static logCreation({ userId, username, firstName, prompt, type = 'video', url, ratio = '9:16', duration = '5s' }) {
    const record = {
      id: Math.random().toString(36).substring(2, 9),
      userId: userId?.toString(),
      username: username ? (username.startsWith('@') ? username : `@${username}`) : 'Anonymous',
      firstName: firstName || 'Creator',
      prompt,
      type,
      ratio,
      url: url || '',
      createdAt: new Date().toISOString(),
    };

    creations.unshift(record); // Add to beginning
    saveCreations();

    // Asynchronously archive media + prompt file locally
    autoSaveLocally(record, duration).catch(() => {});

    return record;
  }

  /**
   * Get user's recent creations
   */
  static getUserHistory(userId, limit = 5) {
    const id = userId.toString();
    return creations.filter((c) => c.userId === id).slice(0, limit);
  }

  /**
   * Get global recent creations across all users (for Admin audit)
   */
  static getGlobalHistory(limit = 10) {
    return creations.slice(0, limit);
  }
}
