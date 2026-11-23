import dotenv from 'dotenv';
dotenv.config();

// Helper to normalize Telegram channel ID
function normalizeChannelId(id) {
  if (!id) return '';
  id = id.trim();
  if (id.startsWith('@')) return id;
  if (id.startsWith('-100')) return id;
  if (id.startsWith('100')) return `-${id}`;
  if (!id.startsWith('-')) return `-100${id}`;
  return id;
}

export const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  higgsfieldMcpUrl: process.env.HIGGSFIELD_MCP_URL || 'https://mcp.higgsfield.ai/mcp',
  allowedUsers: process.env.ALLOWED_USERS
    ? process.env.ALLOWED_USERS.split(',').map((id) => id.trim()).filter(Boolean)
    : [],
  defaultVideoModel: process.env.DEFAULT_VIDEO_MODEL || 'seedance_2_5',
  defaultAspectRatio: process.env.DEFAULT_ASPECT_RATIO || '9:16', // Default 9:16 for Reels/Shorts

  // Admin and Binance Pay Configuration
  adminId: process.env.ADMIN_ID || '7150803046',
  binancePayApiKey: process.env.BINANCE_PAY_API_KEY || '',
  binancePaySecretKey: process.env.BINANCE_PAY_SECRET_KEY || '',
  binancePayId: process.env.BINANCE_PAY_ID || '',
  usdtWalletAddress: process.env.USDT_WALLET_ADDRESS || '',

  // Dual Force Channels
  forceChannels: [
    {
      id: normalizeChannelId(process.env.FORCE_CHANNEL_1_ID || '1003998464283'),
      link: process.env.FORCE_CHANNEL_1_LINK || 'https://t.me/EarnifyXAutomationIN',
      name: 'EarnifyX Automation',
    },
    {
      id: normalizeChannelId(process.env.FORCE_CHANNEL_2_ID || '1004449253535'),
      link: process.env.FORCE_CHANNEL_2_LINK || 'https://t.me/EarnifyXCommunity',
      name: 'EarnifyX Community',
    },
  ],
};
