import dotenv from 'dotenv';
dotenv.config();

export const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  higgsfieldMcpUrl: process.env.HIGGSFIELD_MCP_URL || 'https://mcp.higgsfield.ai/mcp',
  allowedUsers: process.env.ALLOWED_USERS
    ? process.env.ALLOWED_USERS.split(',').map((id) => id.trim()).filter(Boolean)
    : [],
  defaultVideoModel: process.env.DEFAULT_VIDEO_MODEL || 'seedance_2_5',
  defaultAspectRatio: process.env.DEFAULT_ASPECT_RATIO || '16:9',

  // Force Channel Subscription Settings
  forceChannelId: process.env.FORCE_CHANNEL_ID || '', // e.g., "@earnifyXAutomation" or "-1001234567890"
  forceChannelLink: process.env.FORCE_CHANNEL_LINK || 'https://t.me/earnifyXAutomation',
};
