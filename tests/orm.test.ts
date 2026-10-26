import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/configLoader';
import { QueryExecutionError } from '../src/errors';
import { executeQuery } from '../src/orm';
import type { AppConfig, SqlServerType } from '../src/types';

const configPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../connections.json');

const namesFrom = (result: unknown): unknown[] => {
	if (typeof result !== 'object' || result === null || !('rows' in result) || !Array.isArray(result.rows)) {
		throw new Error('Expected query rows');
	}

	return result.rows.map((row: unknown) => {
		if (typeof row !== 'object' || row === null || !('name' in row)) {
			throw new Error('Expected a name column');
		}

		return row.name;
	});
};

describe('executeQuery before opening a connection', () => {
	const config: AppConfig = {
		maxTimeoutMs: 15000,
		connections: [
			{
				serverType: 'mysql',
				ip: 'mysql',
				port: 3306,
				user: 'readonly',
				password: 'password',
				databases: ['app'],
				readOnly: true,
			},
			{
				serverType: 'mysql',
				ip: 'mysql',
				port: 3306,
				user: 'app',
				password: 'password',
				databases: ['app'],
				readOnly: false,
			},
		],
	};

	it('rejects a database that no connection includes', async () => {
		await expect(executeQuery(config, 'SELECT 1', 'mysql', 'missing')).rejects.toThrow(QueryExecutionError);
		await expect(executeQuery(config, 'SELECT 1', 'mysql', 'missing')).rejects.toThrow(
			'No mysql connection includes database "missing"',
		);
	});

	it('rejects more than one connection for the same engine and database', async () => {
		await expect(executeQuery(config, 'SELECT 1', 'mysql', 'app')).rejects.toThrow(QueryExecutionError);
		await expect(executeQuery(config, 'SELECT 1', 'mysql', 'app')).rejects.toThrow(
			'More than one mysql connection includes database "app"',
		);
	});

	it('rejects a write on a read-only connection before opening the database', async () => {
		const readOnly: AppConfig = {
			...config,
			connections: config.connections.filter((connection) => connection.readOnly),
		};

		await expect(executeQuery(readOnly, 'DELETE FROM accounts', 'mysql', 'app')).rejects.toThrow(
			'This connection is read-only. Only SELECT, DESCRIBE, and EXPLAIN of a read statement are allowed.',
		);
		await expect(executeQuery(readOnly, 'SELECT 1; DELETE FROM accounts', 'mysql', 'app')).rejects.toThrow(
			'This connection is read-only. Only SELECT, DESCRIBE, and EXPLAIN of a read statement are allowed.',
		);
	});

	it('rejects SQL that cannot be classified on a read-only connection', async () => {
		const readOnly: AppConfig = {
			...config,
			connections: config.connections.filter((connection) => connection.readOnly),
		};

		await expect(executeQuery(readOnly, 'NOT SQL', 'mysql', 'app')).rejects.toThrow(/SQL could not be parsed/);
	});
});

describe('executeQuery against the configured servers', () => {
	const load = () => loadConfig(configPath);

	it('loads the docker connections', async () => {
		const config = await load();

		expect(config.maxTimeoutMs).toBe(15000);
		expect(config.connections.map((connection) => connection.serverType)).toEqual(['mysql', 'mariadb', 'postgres']);
		expect(config.connections.find((connection) => connection.serverType === 'mysql')?.databases).toEqual([
			'app',
			'analytics',
		]);
	});

	it.each([
		['mysql', 'app'],
		['mysql', 'analytics'],
		['mariadb', 'app'],
		['postgres', 'app'],
	] as const)('reads accounts on %s %s', async (serverType: SqlServerType, database: string) => {
		const config = await load();
		const result = await executeQuery(config, 'SELECT name FROM accounts ORDER BY id', serverType, database);

		expect(namesFrom(result)).toEqual(['ada', 'grace']);
	});

	it('describes a table on the read-only mysql connection', async () => {
		const config = await load();
		const result = await executeQuery(config, 'DESCRIBE accounts', 'mysql', 'app');

		expect(result).toMatchObject({ rows: expect.any(Array) });
		if (typeof result !== 'object' || result === null || !('rows' in result) || !Array.isArray(result.rows)) {
			throw new Error('Expected query rows');
		}
		expect(result.rows.length).toBeGreaterThan(0);
	});

	it.each(['mysql', 'postgres'] as const)('explains a read on %s', async (serverType) => {
		const config = await load();
		const result = await executeQuery(config, 'EXPLAIN SELECT name FROM accounts', serverType, 'app');

		expect(result).toBeTypeOf('object');
	});

	it('rejects a write on mysql and postgres', async () => {
		const config = await load();

		await expect(executeQuery(config, 'DELETE FROM accounts', 'mysql', 'app')).rejects.toThrow(QueryExecutionError);
		await expect(executeQuery(config, 'DELETE FROM accounts', 'postgres', 'app')).rejects.toThrow(QueryExecutionError);
	});

	it('inserts and deletes on the writable mariadb connection', async () => {
		const config = await load();

		await executeQuery(config, 'DELETE FROM accounts WHERE id = 99', 'mariadb', 'app');

		try {
			await executeQuery(config, "INSERT INTO accounts (id, name) VALUES (99, 'linus')", 'mariadb', 'app');
			const result = await executeQuery(config, 'SELECT name FROM accounts WHERE id = 99', 'mariadb', 'app');

			expect(namesFrom(result)).toEqual(['linus']);
		} finally {
			await executeQuery(config, 'DELETE FROM accounts WHERE id = 99', 'mariadb', 'app');
		}
	});

	it('sets the mysql execution timeout and stops a long read', async () => {
		const config = await load();
		const short: AppConfig = { ...config, maxTimeoutMs: 200 };
		const configured = await executeQuery(short, 'SELECT @@SESSION.max_execution_time AS ms', 'mysql', 'app');

		expect(JSON.stringify(configured)).toContain('200');
		// El temporizador se comprueba entre filas, no dentro de SLEEP o BENCHMARK.
		await expect(
			executeQuery(
				short,
				'WITH RECURSIVE seq AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 5000000) SELECT SUM(n) FROM seq',
				'mysql',
				'app',
			),
		).rejects.toThrow();
	});

	it('stops a long mariadb statement', async () => {
		const config = await load();
		const short: AppConfig = { ...config, maxTimeoutMs: 200 };

		await expect(executeQuery(short, 'SELECT SLEEP(2)', 'mariadb', 'app')).rejects.toThrow();
	});

	it('stops a long postgres statement', async () => {
		const config = await load();
		const short: AppConfig = { ...config, maxTimeoutMs: 200 };

		await expect(executeQuery(short, 'SELECT pg_sleep(2)', 'postgres', 'app')).rejects.toThrow();
	});
});
