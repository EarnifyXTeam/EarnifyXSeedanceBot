# 🎬 EarnifyXSeedanceBot

> **Next-Gen AI Video Generation Telegram Bot Powered by Seedance 2.5 & Higgsfield MCP.**  
> Crafted with ❤️ for the **earnifyXAutomation** Community.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![MCP Powered](https://img.shields.io/badge/Powered%20By-Higgsfield%20MCP-blue.svg)](https://higgsfield.ai/)
[![Telegram Bot](https://img.shields.io/badge/Telegram-@EarnifyXSeedanceBot-blue?logo=telegram)](https://t.me/EarnifyXSeedanceBot)

---

## 🌟 Overview

**EarnifyXSeedanceBot** brings state-of-the-art AI video and media generation right to your Telegram chat. Utilizing Higgsfield's remote **Model Context Protocol (MCP)**, this bot enables instant access to top-tier generative models including **Seedance 2.0 / 2.5**, **Nano Banana Pro**, and ultra-realistic voice models with zero manual workflow friction.

---

## ✨ Features

- 🎥 **Seedance 2.5 Video Generation:** Cinematic camera movements, high-framerate rendering, and realistic motion physics.
- 🖼️ **High-Res AI Images:** Stunning 4K visuals, photorealism, and custom aspect ratios.
- 🎙️ **Studio Voice & Speech:** ElevenLabs v3 and Minimax Speech HD integration for natural voiceovers.
- ⚡ **16 Parallel Tasks:** Concurrent rendering architecture for blazing fast delivery.
- 🚀 **Cloud-Ready:** Lightweight and optimized for 24/7 continuous hosting (AIC Cloud, VPS, Docker).

---

## 🤖 Bot Commands

| Command | Description | Example |
| :--- | :--- | :--- |
| `/start` | Welcome message & interactive dashboard | `/start` |
| `/video <prompt>` | Generate cinematic video with Seedance 2.5 | `/video drone shot over cyberpunk neon city` |
| `/image <prompt>` | Generate high-res photorealistic image | `/image futuristic cybernetic tiger in rainforest` |
| `/audio <text>` | Generate high-quality AI voiceover | `/audio Welcome to the future of AI automation.` |
| `/status` | Check generation queue and account credits | `/status` |
| `/help` | Complete usage guide & tips | `/help` |

---

## 🛠️ Tech Stack & Architecture

- **Runtime:** Node.js (v18+)
- **Framework:** [GrammY](https://grammy.dev/)
- **Protocol:** Model Context Protocol (MCP) via `@modelcontextprotocol/sdk` & `mcp-remote`
- **Backend AI:** Higgsfield AI Remote MCP (`https://mcp.higgsfield.ai/mcp`)

---

## 🚀 Quick Setup & Deployment

### 1. Clone the Repository
```bash
git clone https://github.com/EarnifyXTeam/EarnifyXSeedanceBot.git
cd EarnifyXSeedanceBot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token_here"
HIGGSFIELD_MCP_URL="https://mcp.higgsfield.ai/mcp"
```

### 4. Authenticate MCP (One-Time)
```bash
npx -y mcp-remote https://mcp.higgsfield.ai/mcp
```

### 5. Start the Bot
```bash
# Development
npm run dev

# Production with PM2 (24/7 on AIC Cloud / VPS)
pm2 start src/index.js --name "EarnifyXSeedanceBot"
```

---

## 👥 Community & Support

Join the **earnifyXAutomation** community to learn AI automation, access free prompts, and build profitable AI workflows:

- 💬 **Telegram:** [@EarnifyXSeedanceBot](https://t.me/EarnifyXSeedanceBot)
- 🌐 **Community:** earnifyXAutomation

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
