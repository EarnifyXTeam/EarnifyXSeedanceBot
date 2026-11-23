import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

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
        credits: 0,
        isVip: false,
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

  static getUser(userId) {
    return users[userId.toString()] || null;
  }

  /**
   * Check if user is eligible to generate a video
   * Rule: 1 video free trial, then paid (credits or VIP)
   */
  static checkAccess(userId) {
    const id = userId.toString();
    const adminId = (config.adminId || '').toString();

    // 1. Super Admin bypass (unlimited access)
    if (adminId && id === adminId) {
      return { allowed: true, reason: 'admin', remaining: 9999 };
    }

    const user = users[id] || { totalGenerations: 0, credits: 0, isVip: false };

    // 2. VIP bypass
    if (user.isVip) {
      return { allowed: true, reason: 'vip', remaining: 9999 };
    }

    // 3. Paid Credits
    if ((user.credits || 0) > 0) {
      return { allowed: true, reason: 'credits', remaining: user.credits };
    }

    // 4. Free 1st video trial
    if ((user.totalGenerations || 0) < 1) {
      return { allowed: true, reason: 'free_trial', remaining: 1 };
    }

    // 5. Free trial exhausted and no credits
    return { allowed: false, reason: 'paywall_required', remaining: 0 };
  }

  /**
   * Deduct credit or record generation after start
   */
  static consumeAccess(userId) {
    const id = userId.toString();
    const adminId = (config.adminId || '').toString();

    if (users[id]) {
      if (id !== adminId && !users[id].isVip && (users[id].credits || 0) > 0) {
        users[id].credits = Math.max(0, users[id].credits - 1);
      }
      users[id].totalGenerations = (users[id].totalGenerations || 0) + 1;
      users[id].lastActive = new Date().toISOString();
      saveUsers();
    }
  }

  static addCredits(userId, amount) {
    const id = userId.toString();
    if (users[id]) {
      users[id].credits = (users[id].credits || 0) + Number(amount);
      saveUsers();
      return users[id].credits;
    }
    return 0;
  }

  static setVip(userId, isVip = true) {
    const id = userId.toString();
    if (users[id]) {
      users[id].isVip = !!isVip;
      saveUsers();
      return true;
    }
    return false;
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
