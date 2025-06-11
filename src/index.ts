#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';
import { getUserTransactions, compareWithOneInch, generateSwapReport } from './tools/index.js';

// Load environment variables
dotenv.config();

class DefiAnalyzerServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'defi-analyzer',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_user_transactions',
          description: 'Get recent swap transactions for a wallet address from Dune Analytics',
          inputSchema: {
            type: 'object',
            properties: {
              walletAddress: {
                type: 'string',
                description: 'Ethereum wallet address to analyze',
              },
              limit: {
                type: 'number',
                description: 'Number of recent transactions to fetch (default: 10)',
                default: 10,
              },
            },
            required: ['walletAddress'],
          },
        },
        {
          name: 'compare_with_1inch',
          description: 'Compare actual swaps with optimal 1inch routes to calculate potential savings',
          inputSchema: {
            type: 'object',
            properties: {
              walletAddress: {
                type: 'string',
                description: 'Ethereum wallet address to analyze',
              },
            },
            required: ['walletAddress'],
          },
        },
        {
          name: 'generate_swap_report',
          description: 'Generate a comprehensive DeFi swap efficiency report with recommendations',
          inputSchema: {
            type: 'object',
            properties: {
              walletAddress: {
                type: 'string',
                description: 'Ethereum wallet address to analyze',
              },
            },
            required: ['walletAddress'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'get_user_transactions':
            const transactions = await getUserTransactions(
              args.walletAddress,
              args.limit || 10
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    data: transactions,
                    message: `Found ${transactions.length} recent swap transactions`,
                  }, null, 2),
                },
              ],
            };

          case 'compare_with_1inch':
            const comparison = await compareWithOneInch(args.walletAddress);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(comparison, null, 2),
                },
              ],
            };

          case 'generate_swap_report':
            const report = await generateSwapReport(args.walletAddress);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(report, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: errorMessage,
                message: 'An error occurred while processing your request',
              }, null, 2),
            },
          ],
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DeFi Analyzer MCP Server started 🚀');
  }
}

// Start the server
const server = new DefiAnalyzerServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
