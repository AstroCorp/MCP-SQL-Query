import { describe, expect, it } from 'vitest';

import { parseConfig } from '../src/configLoaderSchema';
import { ConfigValidationError } from '../src/errors';

const validConnection = {
	serverType: 'mysql',
	ip: '127.0.0.1',
	port: 3306,
	user: 'readonly',
	password: 'password',
	databases: ['app'],
	readOnly: true,
};

const validConfig = {
	maxTimeoutMs: 15000,
	connections: [validConnection],
};

describe('parseConfig', () => {
	it('accepts a valid configuration', () => {
		expect(parseConfig(validConfig)).toEqual(validConfig);
	});

	it('accepts an empty connection list', () => {
		expect(parseConfig({ maxTimeoutMs: 1, connections: [] })).toEqual({
			maxTimeoutMs: 1,
			connections: [],
		});
	});

	it('trims ip, user, and database names', () => {
		const config = parseConfig({
			maxTimeoutMs: 15000,
			connections: [
				{
					...validConnection,
					ip: ' mysql ',
					user: ' readonly ',
					databases: [' app '],
				},
			],
		});

		expect(config.connections[0]).toMatchObject({
			ip: 'mysql',
			user: 'readonly',
			databases: ['app'],
		});
	});

	it('accepts a hostname, an IPv6 address, and an empty password', () => {
		expect(
			parseConfig({
				maxTimeoutMs: 15000,
				connections: [
					{ ...validConnection, ip: 'db.internal' },
					{ ...validConnection, ip: '::1', serverType: 'postgres', password: '' },
				],
			}).connections,
		).toHaveLength(2);
	});

	it('accepts the port bounds', () => {
		expect(parseConfig({ ...validConfig, connections: [{ ...validConnection, port: 1 }] }).connections[0]?.port).toBe(1);
		expect(
			parseConfig({ ...validConfig, connections: [{ ...validConnection, port: 65535 }] }).connections[0]?.port,
		).toBe(65535);
	});

	it.each([
		[{ ...validConfig, maxTimeoutMs: 0 }, 'maxTimeoutMs'],
		[{ ...validConfig, maxTimeoutMs: 1.5 }, 'maxTimeoutMs'],
		[{ ...validConfig, extra: true }, 'extra'],
		[{ ...validConfig, connections: [{ ...validConnection, serverType: 'oracle' }] }, 'serverType'],
		[{ ...validConfig, connections: [{ ...validConnection, ip: 'not a host' }] }, 'ip'],
		[{ ...validConfig, connections: [{ ...validConnection, port: 0 }] }, 'port'],
		[{ ...validConfig, connections: [{ ...validConnection, port: 65536 }] }, 'port'],
		[{ ...validConfig, connections: [{ ...validConnection, user: ' ' }] }, 'user'],
		[{ ...validConfig, connections: [{ ...validConnection, databases: [] }] }, 'database'],
		[{ ...validConfig, connections: [{ ...validConnection, databases: ['app', 'app'] }] }, 'repeated'],
		[{ ...validConfig, connections: [{ ...validConnection, databases: ['bad-name'] }] }, 'Database name'],
		[{ ...validConfig, connections: [{ ...validConnection, readOnly: 'yes' }] }, 'readOnly'],
	])('rejects %j', (input, fragment) => {
		expect(() => parseConfig(input)).toThrow(ConfigValidationError);
		expect(() => parseConfig(input)).toThrow(new RegExp(fragment, 'i'));
	});
});
