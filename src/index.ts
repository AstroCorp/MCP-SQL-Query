#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './configLoader';
import { registerExecuteQueryTool } from './tools/executeQueryTool';
import { registerListConnectionsTool } from './tools/listConnectionsTool';

// connections.json vive en la raíz, tanto desde src como desde dist.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(projectRoot, 'connections.json');

// Crea el servidor MCP.
const server = new McpServer(
	{ name: 'MCP-SQL-Query', version: '1.0.0' },
	{ capabilities: { tools: {} } },
);

// Carga la configuración, registra la herramienta y conecta el transporte stdio.
const main = async (): Promise<void> => {
	const config = await loadConfig(configPath);

	registerListConnectionsTool(server, config);
	registerExecuteQueryTool(server, config);

	const transport = new StdioServerTransport();

	await server.connect(transport);
};

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : error;

	console.error('[MCP-SQL-Query] Fatal error:', message);

	process.exit(1);
});
