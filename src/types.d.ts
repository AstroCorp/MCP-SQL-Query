/** Motor de la conexión. */
export type SqlServerType = 'mysql' | 'mariadb' | 'postgres';

/** Lectura o escritura de una consulta. */
export type SqlAccess = 'read' | 'write';

/** Una conexión: un usuario y las bases a las que puede acceder. */
export interface ConnectionConfig {
	serverType: SqlServerType;
	ip: string;
	port: number;
	user: string;
	password: string;
	databases: string[];
	readOnly: boolean;
}

/** Configuración del servidor: timeout global, columnas excluidas y conexiones. */
export interface AppConfig {
	maxTimeoutMs: number;
	/** Columnas que una conexión de solo lectura no puede consultar. La comparación no distingue mayúsculas. */
	excludedColumns: string[];
	connections: ConnectionConfig[];
}
