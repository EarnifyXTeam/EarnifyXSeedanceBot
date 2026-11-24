import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.js';
import os from 'os';
import path from 'path';
import fs from 'fs';

function ensureMcpAuthTokens() {
  try {
    const authDestDir = path.join(os.homedir(), '.mcp-auth', 'mcp-remote-v1');
    if (!fs.existsSync(authDestDir)) {
      fs.mkdirSync(authDestDir, { recursive: true });
    }

    const srcAuthDir = path.resolve('src', 'auth');
    if (fs.existsSync(srcAuthDir)) {
      const files = fs.readdirSync(srcAuthDir);
      for (const file of files) {
        const srcFile = path.join(srcAuthDir, file);
        const destFile = path.join(authDestDir, file);

        let shouldCopy = false;
        if (!fs.existsSync(destFile)) {
          shouldCopy = true;
        } else if (file.endsWith('_tokens.json')) {
          try {
            const srcToken = JSON.parse(fs.readFileSync(srcFile, 'utf8'));
            const destToken = JSON.parse(fs.readFileSync(destFile, 'utf8'));
            // If src token has later expiry or dest token is expired, overwrite
            if ((srcToken.expires_at || 0) > (destToken.expires_at || 0) || (destToken.expires_at && destToken.expires_at < Date.now())) {
              shouldCopy = true;
            }
          } catch (_) {
            shouldCopy = true;
          }
        } else {
          shouldCopy = true;
        }

        if (shouldCopy) {
          fs.copyFileSync(srcFile, destFile);
          console.log(`🔑 Synchronized MCP token file: ${file}`);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ MCP auth auto-provisioning warning:', err.message);
  }
}

function syncBackMcpTokens() {
  try {
    const authDestDir = path.join(os.homedir(), '.mcp-auth', 'mcp-remote-v1');
    const srcAuthDir = path.resolve('src', 'auth');
    if (fs.existsSync(authDestDir) && fs.existsSync(srcAuthDir)) {
      const files = fs.readdirSync(authDestDir);
      for (const file of files) {
        const destFile = path.join(authDestDir, file);
        const srcFile = path.join(srcAuthDir, file);
        if (file.endsWith('_tokens.json')) {
          try {
            const destToken = JSON.parse(fs.readFileSync(destFile, 'utf8'));
            const srcToken = fs.existsSync(srcFile) ? JSON.parse(fs.readFileSync(srcFile, 'utf8')) : {};
            if ((destToken.expires_at || 0) > (srcToken.expires_at || 0)) {
              fs.copyFileSync(destFile, srcFile);
            }
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
}

class HiggsfieldMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.connectingPromise = null;
  }

  async connect() {
    if (this.isConnected && this.client && this.transport) {
      return this.client;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      try {
        ensureMcpAuthTokens();
        console.log('🔄 Connecting to Higgsfield Remote MCP Server...');
        const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

        this.transport = new StdioClientTransport({
          command: npxCommand,
          args: ['-y', 'mcp-remote', config.higgsfieldMcpUrl],
        });

        this.transport.onclose = () => {
          console.warn('⚠️ Higgsfield MCP connection closed. Will reconnect on next request.');
          this.isConnected = false;
          this.client = null;
          this.transport = null;
        };

        this.transport.onerror = (err) => {
          console.warn('⚠️ Higgsfield MCP transport notice:', err?.message || err);
          this.isConnected = false;
          this.client = null;
          this.transport = null;
        };

        this.client = new Client(
          {
            name: 'Claude Desktop',
            version: '0.7.0',
          },
          {
            capabilities: {
              tools: {},
            },
          }
        );

        await this.client.connect(this.transport);
        this.isConnected = true;
        syncBackMcpTokens();
        console.log('✅ Connected successfully to Higgsfield MCP!');
        return this.client;
      } catch (error) {
        this.isConnected = false;
        this.client = null;
        this.transport = null;
        console.error('❌ Failed to connect to Higgsfield MCP:', error);
        throw error;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  async callTool(name, args = {}, timeoutMs = 300000, retryCount = 1) {
    await this.connect();
    try {
      // Explicit CallToolResultSchema ensures options.timeout (300s) is correctly recognized by Protocol
      const response = await this.client.callTool(
        {
          name,
          arguments: args,
        },
        CallToolResultSchema,
        { timeout: timeoutMs }
      );
      return response;
    } catch (error) {
      const isConnectionError =
        !this.isConnected ||
        !this.client ||
        error.message?.includes('Not connected') ||
        error.message?.includes('Connection closed') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('broken pipe') ||
        error.message?.includes('closed');

      if (isConnectionError && retryCount > 0) {
        console.warn(`🔄 MCP connection lost while calling ${name}. Auto-reconnecting and retrying...`);
        this.isConnected = false;
        this.client = null;
        this.transport = null;
        try {
          await this.connect();
          return await this.callTool(name, args, timeoutMs, retryCount - 1);
        } catch (reconnectErr) {
          console.error('❌ Failed to reconnect to Higgsfield MCP:', reconnectErr.message);
          throw reconnectErr;
        }
      }

      // Suppress logging on background polling snapshots to keep terminal clean
      if (!name.includes('show_generations') && !name.includes('jobs_wait') && !name.includes('show_generation_by_ids')) {
        console.error(`❌ Error calling tool ${name}:`, error.message);
      }
      throw error;
    }
  }

  async listTools() {
    await this.connect();
    return await this.client.listTools();
  }
}

export const mcpClient = new HiggsfieldMCPClient();
