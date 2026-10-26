import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/configLoader';
import { registerExecuteQueryTool } from '../src/tools/executeQueryTool';
import { registerListConnectionsTool } from '../src/tools/listConnectionsTool';
import type { AppConfig } from '../src/types';

const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../connections.json');

const clients: Client[] = [];

afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
});

const connect = async (config: AppConfig): Promise<Client> => {
	const server = new McpServer({ name: 'test', version: '1.0.0' });
	registerListConnectionsTool(server, config);
	registerExecuteQueryTool(server, config);

	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: 'test-client', version: '1.0.0' });
	clients.push(client);

	await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

	return client;
};

const textOf = (result: unknown): string => {
	if (typeof result !== 'object' || result === null || !('content' in result) || !Array.isArray(result.content)) {
		throw new Error('Tool result has no content');
	}

	const first: unknown = result.content[0];

	if (typeof first !== 'object' || first === null || !('text' in first) || typeof first.text !== 'string') {
		throw new Error('Tool result has no text');
	}

	return first.text;
};

describe('execute_query tool', () => {
	it('registers the connection list and the query tool', async () => {
		const client = await connect({ maxTimeoutMs: 15000, connections: [] });
		const listed = await client.listTools();

		expect(listed.tools.map((tool) => tool.name)).toEqual(['list_connections', 'execute_query']);
		expect(listed.tools.find((tool) => tool.name === 'execute_query')?.description).toContain('readOnly');
	});

	it('lists server type, databases, and access without secrets', async () => {
		const client = await connect({
			maxTimeoutMs: 15000,
			connections: [
				{
					serverType: 'mysql',
					ip: '10.0.0.8',
					port: 3306,
					user: 'readonly',
					password: 'secret',
					databases: ['app', 'analytics'],
					readOnly: true,
				},
				{
					serverType: 'mariadb',
					ip: '10.0.0.9',
					port: 3307,
					user: 'app',
					password: 'secret',
					databases: ['app'],
					readOnly: false,
				},
			],
		});
		const result = await client.callTool({ name: 'list_connections', arguments: {} });
		const text = textOf(result);

		expect(result.isError).toBeUndefined();
		expect(JSON.parse(text)).toEqual([
			{ serverType: 'mysql', databases: ['app', 'analytics'], access: 'read-only' },
			{ serverType: 'mariadb', databases: ['app'], access: 'read-write' },
		]);
		expect(text).not.toContain('10.0.0.8');
		expect(text).not.toContain('secret');
		expect(text).not.toContain('readonly');
	});

	it('returns the query error as an MCP error result', async () => {
		const client = await connect({ maxTimeoutMs: 15000, connections: [] });
		const result = await client.callTool({
			name: 'execute_query',
			arguments: { sql: 'SELECT 1', serverType: 'mysql', database: 'app' },
		});

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain('No mysql connection includes database "app"');
	});

	it('rejects an empty query before execution', async () => {
		const client = await connect({ maxTimeoutMs: 15000, connections: [] });
		const result = await client.callTool({
			name: 'execute_query',
			arguments: { sql: '   ', serverType: 'mysql', database: 'app' },
		});

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain('expected string to have >=1 characters');
	});

	it('returns account names as JSON text', async () => {
		const config = await loadConfig(configPath);
		const client = await connect(config);
		const result = await client.callTool({
			name: 'execute_query',
			arguments: { sql: 'SELECT name FROM accounts ORDER BY id', serverType: 'postgres', database: 'app' },
		});

		expect(result.isError).toBeUndefined();
		expect(textOf(result)).toContain('ada');
		expect(textOf(result)).toContain('grace');
	});

	it('serializes Buffer values as base64', async () => {
		const config = await loadConfig(configPath);
		const client = await connect(config);
		const result = await client.callTool({
			name: 'execute_query',
			arguments: {
				sql: "SELECT CAST('ab' AS BINARY) AS raw",
				serverType: 'mysql',
				database: 'app',
			},
		});

		expect(result.isError).toBeUndefined();
		expect(textOf(result)).toContain('"raw":"YWI="');
	});
});
