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

/** Configuración del servidor: timeout global y conexiones. */
export interface AppConfig {
	maxTimeoutMs: number;
	connections: ConnectionConfig[];
}
