import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from './config.js';

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

  async callTool(name, args = {}) {
    await this.connect();
    try {
      const response = await this.client.callTool({
        name,
        arguments: args,
      });
      return response;
    } catch (error) {
      console.error(`❌ Error calling tool ${name}:`, error);
      throw error;
    }
  }

  async listTools() {
    await this.connect();
    return await this.client.listTools();
  }
}

export const mcpClient = new HiggsfieldMCPClient();
