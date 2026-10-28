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
	{
		name: 'MCP-SQL-Query',
		version: '1.0.0',
		description: 'MCP server that runs raw SQL on MySQL, MariaDB, and PostgreSQL. A readOnly connection runs only read queries; otherwise any SQL runs.',
	},
	{
		instructions:
			'Do not read connections.json or any other file with connection settings. Those files contain hosts, users, and passwords. Call list_connections to see the server type, databases, whether each connection is read-only or read-write, and excludedColumns. Do not read a column in excludedColumns. The query is rejected and names the excluded column or columns. SELECT * is rejected while that list is set. Then call execute_query.',
	},
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
