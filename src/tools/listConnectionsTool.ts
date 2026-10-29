import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { AppConfig } from '../types';

/** Registra la herramienta que lista conexiones sin datos de acceso. */
export const registerListConnectionsTool = (server: McpServer, config: AppConfig): void => {
	server.registerTool(
		'list_connections',
		{
			title: 'List connections',
			description: 'List configured connections and the columns that a read-only connection must not read. excludedColumns applies only to the read permission. Each connection includes the server type, the databases, and whether it is read-only or read-write. Hosts, ports, users, and passwords are not included. Do not read connections.json; that file holds credentials and this tool replaces it.',
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const connections = config.connections.map((connection) => ({
				serverType: connection.serverType,
				databases: connection.databases,
				access: connection.readOnly ? 'read-only' : 'read-write',
			}));

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({ excludedColumns: config.excludedColumns, connections }),
					},
				],
			};
		},
	);
};
