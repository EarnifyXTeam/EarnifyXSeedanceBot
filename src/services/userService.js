import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory user cache
let users = {};

// Load users from disk
try {
  if (fs.existsSync(USERS_FILE)) {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    users = JSON.parse(raw);
  }
} catch (e) {
  console.warn('⚠️ Could not load users.json, starting with empty store:', e.message);
  users = {};
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.error('❌ Error saving users.json:', e);
  }
}

// Active generation locks to prevent concurrent spam
const activeGenerations = new Set();
// Cooldown tracker (userId -> timestamp of last generation)
const cooldowns = new Map();

export class UserService {
  /**
   * Register or update a real user
   */
  static registerUser(from) {
    if (!from || from.is_bot) return null;

    const id = from.id.toString();
    const now = new Date().toISOString();

    if (!users[id]) {
      users[id] = {
        id,
        username: from.username ? `@${from.username}` : '',
        firstName: from.first_name || '',
        lastName: from.last_name || '',
        joinedAt: now,
        lastActive: now,
        totalGenerations: 0,
        isBanned: false,
      };
      console.log(`👤 New real user registered: ${users[id].firstName} (${users[id].username || id})`);
    } else {
      users[id].lastActive = now;
      if (from.username) users[id].username = `@${from.username}`;
    }

    saveUsers();
    return users[id];
  }

  static isBanned(userId) {
    const id = userId.toString();
    return !!users[id]?.isBanned;
  }

  static banUser(userId) {
    const id = userId.toString();
    if (users[id]) {
      users[id].isBanned = true;
      saveUsers();
      return true;
    }
    return false;
  }

  static unbanUser(userId) {
    const id = userId.toString();
    if (users[id]) {
      users[id].isBanned = false;
      saveUsers();
      return true;
    }
    return false;
  }

  static recordGeneration(userId) {
    const id = userId.toString();
    if (users[id]) {
      users[id].totalGenerations = (users[id].totalGenerations || 0) + 1;
      users[id].lastActive = new Date().toISOString();
      saveUsers();
    }
  }

  static getTotalUsers() {
    return Object.keys(users).length;
  }

  /**
   * Anti-Spam: Check if user is already running a generation
   */
  static isGenerating(userId) {
    return activeGenerations.has(userId.toString());
  }

  static startGenerating(userId) {
    activeGenerations.add(userId.toString());
  }

  static stopGenerating(userId) {
    activeGenerations.delete(userId.toString());
  }

  /**
   * Anti-Spam: Check cooldown (default 15 seconds)
   */
  static checkCooldown(userId, cooldownSeconds = 15) {
    const id = userId.toString();
    const now = Date.now();
    const lastTime = cooldowns.get(id);

    if (lastTime) {
      const diff = (now - lastTime) / 1000;
      if (diff < cooldownSeconds) {
        return Math.ceil(cooldownSeconds - diff);
      }
    }

    cooldowns.set(id, now);
    return 0; // No cooldown active
  }
}
