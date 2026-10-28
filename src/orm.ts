import { MikroORM as MariaDbORM } from '@mikro-orm/mariadb';
import { MikroORM as MySqlORM } from '@mikro-orm/mysql';
import { MikroORM as PostgreSqlORM } from '@mikro-orm/postgresql';

import { QueryExecutionError, SqlClassificationError } from './errors';
import type { AppConfig, ConnectionConfig, SqlServerType } from './types';
import { classifyQuery } from './queryAnalyzer';

type SqlOrm = Awaited<ReturnType<typeof initOrm>>;

/** Crea la instancia del ORM para el motor y la base, sin abrir la conexión. */
const initOrm = async (connection: ConnectionConfig, database: string) => {
	const options = {
		host: connection.ip,
		port: connection.port,
		user: connection.user,
		password: connection.password,
		dbName: database,
		entities: [],
		ensureDatabase: false,
		allowGlobalContext: true,
		debug: false,
		discovery: { warnWhenNoEntities: false },
		pool: { min: 0, max: 4 },
	};

	if (connection.serverType === 'mysql') {
		return MySqlORM.init(options);
	}

	if (connection.serverType === 'mariadb') {
		return MariaDbORM.init(options);
	}

	return PostgreSqlORM.init(options);
};

/** Abre la conexión con la base. */
const openConnection = async (orm: SqlOrm): Promise<void> => {
	await orm.connect();
};

/** Cierra la conexión y libera el pool. */
const closeConnection = async (orm: SqlOrm): Promise<void> => {
	await orm.close(true);
};

/** Ejecuta el SQL. Solo clasifica la consulta cuando la conexión es de solo lectura. */
export const executeQuery = async (
	config: AppConfig,
	sql: string,
	serverType: SqlServerType,
	database: string,
): Promise<unknown> => {
	// Conexiones del motor pedido que incluyen esa base.
	const matches = config.connections.filter(
		(connection) => connection.serverType === serverType && connection.databases.includes(database),
	);

	// Tiene que haber una sola. Cero no se puede ejecutar; más de una no se sabe cuál usar.
	if (matches.length !== 1) {
		throw new QueryExecutionError(
			matches.length === 0
				? `No ${serverType} connection includes database "${database}"`
				: `More than one ${serverType} connection includes database "${database}"`,
		);
	}

	const connection = matches[0];

	// Sin columnas excluidas y con escritura permitida no hace falta parsear.
	if (connection.readOnly || config.excludedColumns.length > 0) {
		try {
			const access = classifyQuery(sql, serverType, config.excludedColumns);

			// readOnly false ejecuta cualquier SQL que no consulte una columna excluida.
			if (connection.readOnly && access !== 'read') {
				throw new QueryExecutionError(
					'This connection is read-only. Only SELECT, DESCRIBE, and EXPLAIN of a read statement are allowed.',
				);
			}
		} catch (error) {
			// El rechazo de escritura ya tiene su mensaje.
			if (error instanceof QueryExecutionError) {
				throw error;
			}

			// El parser no entiende el SQL: tampoco se ejecuta.
			if (error instanceof SqlClassificationError) {
				throw new QueryExecutionError(error.message);
			}

			throw error;
		}
	}

	// Instancia del motor. La conexión todavía no está abierta.
	const orm = await initOrm(connection, database);

	try {
		await openConnection(orm);
		const db = orm.em.getConnection();

		return await db.transactional(
			async (transaction) => {
				// MySQL limita los SELECT en milisegundos.
				if (connection.serverType === 'mysql') {
					await db.execute(
						`SET SESSION max_execution_time = ${config.maxTimeoutMs}`,
						[],
						'run',
						transaction,
					);
				// MariaDB limita cualquier sentencia, pero el valor va en segundos.
				} else if (connection.serverType === 'mariadb') {
					await db.execute(
						`SET SESSION max_statement_time = ${(config.maxTimeoutMs / 1000).toFixed(3)}`,
						[],
						'run',
						transaction,
					);
				}

				// 'run' devuelve filas afectadas y, si las hay, las filas.
				return db.execute(sql, [], 'run', transaction);
			},
			{
				// En una conexión de solo lectura la transacción también lo es.
				readOnly: connection.readOnly,
				// Postgres aplica el timeout al empezar la transacción.
				sessionContext:
					connection.serverType === 'postgres'
						? { variables: { statement_timeout: `${config.maxTimeoutMs}ms` } }
						: undefined,
			},
		);
	} finally {
		// Se cierra aunque la consulta falle.
		await closeConnection(orm);
	}
};
