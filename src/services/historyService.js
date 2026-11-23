import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const CREATIONS_FILE = path.join(DATA_DIR, 'creations.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

export class HistoryService {
  /**
   * Log a successful generation
   */
  static logCreation({ userId, username, firstName, prompt, type = 'video', url, ratio = '9:16' }) {
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
