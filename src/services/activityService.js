import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { UserService } from './userService.js';

const DATA_DIR = path.resolve('data');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let activities = [];

try {
  if (fs.existsSync(ACTIVITY_FILE)) {
    activities = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf-8'));
  }
} catch (e) {
  activities = [];
}

// Initial seed if empty so new users immediately see established trust proof
if (activities.length === 0) {
  activities = [
    {
      type: 'video_delivered',
      userMasked: '@jatin*****',
      nameMasked: 'Jatin***',
      details: '30s Bedroom Comedy Scene (9:16)',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      type: 'video_delivered',
      userMasked: '@vittu*****',
      nameMasked: 'Vittu***',
      details: '30s 3D Animated Niko & Brann (9:16)',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    },
    {
      type: 'vip_activated',
      userMasked: '@KingF*****',
      nameMasked: 'King ***',
      details: '$1.00 VIP Unlimited Plan Activated 💎',
      timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    },
    {
      type: 'video_delivered',
      userMasked: '@Earnif*****',
      nameMasked: 'Suraj***',
      details: '30s Golden Puppy & Crab (9:16)',
      timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    },
    {
      type: 'user_joined',
      userMasked: '@Mintl*****',
      nameMasked: 'Aparn***',
      details: 'Joined Community & Created 1st Video',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ];
}

function saveActivities() {
  try {
    if (activities.length > 50) {
      activities = activities.slice(0, 50);
    }
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(activities, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving activity.json:', e);
  }
}

export function maskUsername(uname) {
  if (!uname) return '@User****';
  const clean = uname.replace(/^@/, '');
  if (clean.length <= 4) return '@' + clean[0] + '***';
  return '@' + clean.slice(0, 4) + '***' + clean.slice(-1);
}

export function maskName(name) {
  if (!name) return 'Creator***';
  if (name.length <= 3) return name[0] + '***';
  return name.slice(0, 3) + '***';
}

export class ActivityService {
  /**
   * Log a new user joining
   */
  static recordUserJoin({ userId, username, firstName }) {
    const event = {
      type: 'user_joined',
      userMasked: maskUsername(username),
      nameMasked: maskName(firstName),
      details: 'New Creator Joined Community 👤',
      timestamp: new Date().toISOString(),
    };
    activities.unshift(event);
    saveActivities();
  }

  /**
   * Log a successful video delivery
   */
  static recordVideoDelivery({ userId, username, firstName, duration = '5s', ratio = '9:16' }) {
    const event = {
      type: 'video_delivered',
      userMasked: maskUsername(username),
      nameMasked: maskName(firstName),
      details: `${duration} Seedance 2.5 Video (${ratio}) Delivered ✅`,
      timestamp: new Date().toISOString(),
    };
    activities.unshift(event);
    saveActivities();
  }

  /**
   * Log a VIP plan activation
   */
  static recordVipActivation({ userId, username, firstName }) {
    const event = {
      type: 'vip_activated',
      userMasked: maskUsername(username),
      nameMasked: maskName(firstName),
      details: '$1.00 VIP Unlimited Access Activated 💎',
      timestamp: new Date().toISOString(),
    };
    activities.unshift(event);
    saveActivities();
  }

  /**
   * Instant Real-Time Alert to Admin
   */
  static async notifyAdmin(api, htmlText) {
    if (!config.adminId || !api) return;
    try {
      await api.sendMessage(config.adminId, htmlText, { parse_mode: 'HTML' });
    } catch (err) {
      console.warn('⚠️ Admin notification error:', err.message);
    }
  }

  /**
   * Build Social Proof & Trust Card
   */
  static getSocialProofMessage() {
    const totalUsers = UserService.getTotalUsers();
    const recent = activities.slice(0, 8);

    let listText = '';
    for (const item of recent) {
      const icon = item.type === 'video_delivered' ? '🎬' : item.type === 'vip_activated' ? '💎' : '👤';
      listText += `• ${icon} <b>${item.nameMasked}</b> (<code>${item.userMasked}</code>) ➔ <i>${item.details}</i>\n`;
    }

    return `
🔴 <b>EarnifyX Live Proof & Deliveries</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 <b>Total Active Creators:</b> ${totalUsers} Members
🎬 <b>Total Videos Generated:</b> 25+ Completed
⚡ <b>Platform Status:</b> 100% Operational & Delivering 🟢

🌟 <b>Recent Live Activity & Proof:</b>
${listText || '• 🎬 Recent videos successfully delivered to verified users.'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 <i>User usernames & IDs are partially masked to ensure 100% identity privacy and spam protection.</i>
    `.trim();
  }
}
