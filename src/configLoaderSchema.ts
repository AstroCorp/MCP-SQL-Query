import { prettifyError, z } from 'zod';

import { ConfigValidationError } from './errors';
import type { AppConfig } from './types';

/** Motores admitidos en cada conexión. */
const SERVER_TYPES = ['mysql', 'mariadb', 'postgres'] as const;

const databaseNameSchema = z
	.string()
	.trim()
	.min(1, 'Database name cannot be empty')
	.max(63, 'Database name allows at most 63 characters')
	.regex(/^[A-Za-z0-9_]+$/, 'Database name can only contain letters, numbers, and _');

const ipSchema = z
	.string()
	.trim()
	.pipe(
		z.union([z.ipv4(), z.ipv6(), z.hostname()], {
			error: 'ip must be an IPv4 address, an IPv6 address, or a hostname',
		}),
	);

/** Una conexión: un usuario y las bases a las que puede acceder. */
const connectionSchema = z
	.strictObject({
		serverType: z.enum(SERVER_TYPES, {
			error: 'serverType must be mysql, mariadb, or postgres',
		}),
		ip: ipSchema,
		port: z
			.int('port must be an integer')
			.min(1, 'port must be between 1 and 65535')
			.max(65535, 'port must be between 1 and 65535'),
		user: z
			.string()
			.trim()
			.min(1, 'user cannot be empty')
			.max(128, 'user allows at most 128 characters'),
		password: z.string().max(1024, 'password allows at most 1024 characters'),
		databases: z
			.array(databaseNameSchema)
			.min(1, 'Each connection must include at least one database')
			.refine((databases) => new Set(databases).size === databases.length, {
				error: 'Databases in a connection cannot be repeated',
			}),
		readOnly: z
			.boolean({
				error:
					'readOnly must be a boolean: true limits queries to SELECT, DESCRIBE, and EXPLAIN; false accepts any query',
			})
			.describe('true allows only SELECT, DESCRIBE, and EXPLAIN. false allows any query.'),
	});

const columnNameSchema = z
	.string()
	.trim()
	.min(1, 'Column name cannot be empty')
	.max(63, 'Column name allows at most 63 characters')
	.regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Column name can only contain letters, numbers, and _');

/** Configuración del servidor: timeout global, columnas excluidas y conexiones. */
const configSchema = z.strictObject({
	maxTimeoutMs: z
		.int('maxTimeoutMs must be an integer in milliseconds')
		.positive('maxTimeoutMs must be greater than 0'),
	excludedColumns: z
		.array(columnNameSchema)
		.default([])
		.refine((columns) => new Set(columns.map((column) => column.toLowerCase())).size === columns.length, {
			error: 'excludedColumns cannot contain the same column twice',
		}),
	connections: z.array(connectionSchema),
});

/** Valida un objeto ya parseado y devuelve la configuración tipada. */
export const parseConfig = (input: unknown): AppConfig => {
	const result = configSchema.safeParse(input);

	if (!result.success) {
		throw new ConfigValidationError(prettifyError(result.error));
	}

	return result.data;
};
