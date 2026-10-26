import { Buffer } from 'node:buffer';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { AppConfig } from '../types';
import { SQL_SERVER_TYPES } from '../queryAnalyzer';
import { executeQuery } from '../orm';

// JSON.stringify llama a toJSON antes del replacer, y Buffer.toJSON no es base64.
const serialize = (value: unknown): unknown => {
	if (typeof value === 'bigint') {
		return value.toString();
	}

	if (Buffer.isBuffer(value)) {
		return value.toString('base64');
	}

	if (Array.isArray(value)) {
		return value.map((item) => serialize(item));
	}

	if (typeof value === 'object' && value !== null && value.constructor === Object) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
	}

	return value;
};

const toJson = (value: unknown): string => JSON.stringify(serialize(value));

// Registra la herramienta que ejecuta SQL
export const registerExecuteQueryTool = (server: McpServer, config: AppConfig): void => {
	server.registerTool(
		'execute_query',
		{
			title: 'Execute SQL',
			description: 'Execute a raw SQL query on a configured connection. Whether it runs depends on that connection\'s readOnly permission. When readOnly is true, only SELECT, DESCRIBE, and EXPLAIN of a read statement are executed; write queries and SQL that cannot be classified are rejected. When readOnly is false, any query is executed.',
			inputSchema: {
				sql: z.string().trim().min(1).describe('Raw SQL query.'),
				serverType: z.enum(SQL_SERVER_TYPES).describe('Connection engine: mysql, mariadb, or postgres.'),
				database: z.string().trim().min(1).describe('Database name from the connection config.'),
			},
			annotations: {
				readOnlyHint: false,
			},
		},
		async ({ sql, serverType, database }) => {
			try {
				const result = await executeQuery(config, sql, serverType, database);

				return {
					content: [{ type: 'text', text: toJson(result) }],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				
				return {
					isError: true,
					content: [{ type: 'text', text: message }],
				};
			}
		},
	);
};
