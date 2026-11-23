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
        const destFile = path.join(authDestDir, file);
        if (!fs.existsSync(destFile)) {
          fs.copyFileSync(path.join(srcAuthDir, file), destFile);
          console.log(`🔑 Auto-provisioned MCP token: ${file}`);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ MCP auth auto-provisioning warning:', err.message);
  }
}

class HiggsfieldMCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.connectingPromise = null;
  }

  async connect() {
    if (this.isConnected && this.client) {
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
        console.log('✅ Connected successfully to Higgsfield MCP!');
        return this.client;
      } catch (error) {
        this.isConnected = false;
        this.client = null;
        console.error('❌ Failed to connect to Higgsfield MCP:', error);
        throw error;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  async callTool(name, args = {}, timeoutMs = 300000) {
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
      // Suppress logging on background polling snapshots to keep terminal clean
      if (!name.includes('show_generations') && !name.includes('jobs_wait')) {
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
