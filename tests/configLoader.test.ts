import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/configLoader';
import { ConfigValidationError } from '../src/errors';

const directories: string[] = [];

afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const writeConfig = async (contents: string): Promise<string> => {
	const directory = await mkdtemp(path.join(tmpdir(), 'mcp-sql-query-'));
	directories.push(directory);
	const filePath = path.join(directory, 'connections.json');
	await writeFile(filePath, contents);
	return filePath;
};

describe('loadConfig', () => {
	it('reads and validates a JSON file', async () => {
		const filePath = await writeConfig(
			JSON.stringify({
				maxTimeoutMs: 15000,
				connections: [
					{
						serverType: 'postgres',
						ip: 'postgres',
						port: 5432,
						user: 'readonly',
						password: 'password',
						databases: ['app'],
						readOnly: true,
					},
				],
			}),
		);

		await expect(loadConfig(filePath)).resolves.toMatchObject({
			maxTimeoutMs: 15000,
			connections: [{ serverType: 'postgres', databases: ['app'] }],
		});
	});

	it('reports a missing file', async () => {
		const filePath = path.join(tmpdir(), 'mcp-sql-query-missing', 'connections.json');

		await expect(loadConfig(filePath)).rejects.toThrow(ConfigValidationError);
		await expect(loadConfig(filePath)).rejects.toThrow(`Could not read configuration at ${filePath}`);
	});

	it('reports invalid JSON', async () => {
		const filePath = await writeConfig('{');

		await expect(loadConfig(filePath)).rejects.toThrow(ConfigValidationError);
		await expect(loadConfig(filePath)).rejects.toThrow(`File ${filePath} is not valid JSON`);
	});

	it('reports a JSON value that does not match the schema', async () => {
		const filePath = await writeConfig('{"maxTimeoutMs": 0, "connections": []}');

		await expect(loadConfig(filePath)).rejects.toThrow(ConfigValidationError);
		await expect(loadConfig(filePath)).rejects.toThrow(/maxTimeoutMs/);
	});
});
