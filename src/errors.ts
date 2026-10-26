/** El JSON de configuración no cumple el esquema. */
export class ConfigValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigValidationError';
	}
}

/** El SQL no se pudo clasificar. */
export class SqlClassificationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SqlClassificationError';
	}
}

/** La consulta no se ejecuta: conexión ambigua o bloqueada por readOnly. */
export class QueryExecutionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'QueryExecutionError';
	}
}
