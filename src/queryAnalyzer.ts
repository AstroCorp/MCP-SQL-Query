import { createRequire } from 'node:module';
import type { Parser as SqlParser } from 'node-sql-parser';

import { SqlClassificationError } from './errors';
import type { SqlAccess, SqlServerType } from './types';

/** node-sql-parser es CommonJS; el named import falla en ESM. */
const require = createRequire(import.meta.url);
const { Parser } = require('node-sql-parser') as { Parser: new () => SqlParser };

const parser = new Parser();

/** El parser no acepta 'postgres': el dialecto se llama Postgresql. */
const PARSER_DATABASE = {
	mysql: 'MySQL',
	mariadb: 'MariaDB',
	postgres: 'Postgresql',
} as const;

export const SQL_SERVER_TYPES = ['mysql', 'mariadb', 'postgres'] as const satisfies readonly SqlServerType[];

interface AstNode {
	type?: string;
	into?: { position?: string | null; keyword?: string; expr?: unknown };
	locking_read?: string | null;
	with?: unknown;
	expr?: unknown;
	stmt?: unknown;
	ast?: unknown;
	_next?: unknown;
}

/** Opciones de EXPLAIN que no son la sentencia. FORMAT va aparte porque lleva un valor. */
const EXPLAIN_OPTIONS = new Set(['analyze', 'verbose', 'extended', 'partitions']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

/** Aplana la salida del parser hasta nodos con type. */
const statements = (value: unknown): AstNode[] => {
	// Un lote de sentencias llega como array. Hay que mirarlas todas.
	if (Array.isArray(value)) {
		return value.flatMap(statements);
	}

	if (!isRecord(value)) {
		return [];
	}

	// MySQL mete la sentencia de un WITH dentro de ast. El envoltorio no se clasifica.
	if (isRecord(value.ast)) {
		return statements(value.ast);
	}

	// Un CTE llega como { stmt } sin type. stmt es la sentencia de verdad.
	if (typeof value.type !== 'string' && value.stmt !== undefined) {
		return statements(value.stmt);
	}

	return [value as AstNode];
};

/** Un SELECT deja de ser lectura si vuelca filas o las bloquea. */
const selectChangesData = (node: AstNode): boolean => {
	const into = node.into;
	// position null es el INTO vacío que el parser pone en todo SELECT. No escribe.
	const writes =
		into !== undefined && (into.position != null || into.keyword != null || into.expr != null);
	// FOR UPDATE y LOCK IN SHARE MODE bloquean filas: no son una lectura.
	const locks = typeof node.locking_read === 'string' && node.locking_read.length > 0;

	return writes || locks;
};

/** Hijos que pueden convertir en escritura una sentencia que por fuera parece lectura. */
const nestedStatements = (node: AstNode): AstNode[] => {
	const nested: AstNode[] = [];

	// WITH ... DELETE ... SELECT seguiría pareciendo un SELECT si no se mira el CTE.
	if (Array.isArray(node.with)) {
		for (const clause of node.with) {
			if (isRecord(clause)) {
				nested.push(...statements(clause.stmt));
			}
		}
	}

	// EXPLAIN INSERT tiene que ser escritura: el veredicto es el de la sentencia explicada.
	if (node.type === 'explain') {
		nested.push(...statements(node.expr));
	}

	// En un UNION el otro lado cuelga de _next. Una escritura ahí contamina el conjunto.
	nested.push(...statements(node._next));

	return nested;
};

/**
 * Lectura solo en SELECT sin efectos, DESCRIBE, o EXPLAIN de una lectura.
 * Lo demás, o un hijo que escriba, es escritura.
 */
const isReadStatement = (node: AstNode): boolean => {
	const nested = nestedStatements(node);

	// El hijo se resuelve antes: un padre de lectura no tapa una escritura interna.
	if (nested.some((child) => !isReadStatement(child))) {
		return false;
	}

	if (node.type === 'select') {
		return !selectChangesData(node);
	}

	// El parser llama desc tanto a DESCRIBE como a DESC. Solo inspeccionan el esquema.
	if (node.type === 'desc' || node.type === 'describe') {
		return true;
	}

	// EXPLAIN sin cuerpo no se puede comprobar, así que no se fía como lectura.
	return node.type === 'explain' && nested.length > 0;
};

/** Salta blancos y comentarios para llegar a la palabra siguiente. */
const skipTrivia = (sql: string, start: number): number => {
	let cursor = start;

	while (cursor < sql.length) {
		const char = sql[cursor];
		const next = sql[cursor + 1];

		if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
			cursor += 1;
			continue;
		}

		// -- y # son comentarios de línea. Si se dejan, parecen el inicio de la sentencia.
		if ((char === '-' && next === '-') || char === '#') {
			const offset = char === '#' ? 1 : 2;
			cursor += offset;
			while (cursor < sql.length && sql[cursor] !== '\n') {
				cursor += 1;
			}
			continue;
		}

		if (char === '/' && next === '*') {
			const end = sql.indexOf('*/', cursor + 2);
			// Sin cierre no se adivina dónde acaba el comentario.
			if (end === -1) {
				return cursor;
			}
			cursor = end + 2;
			continue;
		}

		break;
	}

	return cursor;
};

/** Identificador desde start. null si ahí no empieza una palabra. */
const readWord = (sql: string, start: number): { word: string; next: number } | null => {
	// Una opción de EXPLAIN es una palabra. Un número, una comilla o un símbolo ya es la sentencia.
	if (!/[A-Za-z_]/.test(sql[start] ?? '')) {
		return null;
	}

	let cursor = start + 1;
	while (cursor < sql.length && /[A-Za-z0-9_]/.test(sql[cursor] ?? '')) {
		cursor += 1;
	}

	return { word: sql.slice(start, cursor), next: cursor };
};

/**
 * start apunta a '('. Devuelve la posición justo después del ')' que lo cierra.
 * null si el grupo no cierra.
 */
const skipParentheses = (sql: string, start: number): number | null => {
	let depth = 0;
	let cursor = start;
	let quote: "'" | '"' | '`' | null = null;

	while (cursor < sql.length) {
		const char = sql[cursor];

		if (quote !== null) {
			// '' "" `` es una comilla escapada, no el fin de la cadena.
			if (char === quote && sql[cursor + 1] === quote) {
				cursor += 2;
				continue;
			}
			if (char === quote) {
				quote = null;
			}
			cursor += 1;
			continue;
		}

		// Un paréntesis dentro de un literal no abre ni cierra el grupo de opciones.
		if (char === "'" || char === '"' || char === '`') {
			quote = char;
			cursor += 1;
			continue;
		}

		if (char === '(') {
			depth += 1;
		} else if (char === ')') {
			depth -= 1;
			if (depth === 0) {
				return cursor + 1;
			}
		}

		cursor += 1;
	}

	return null;
};

/**
 * Postgres no parsea EXPLAIN. Quita el prefijo y las opciones y devuelve la sentencia.
 * null si no es EXPLAIN, si las opciones están rotas o si detrás no queda nada.
 */
const statementAfterExplain = (sql: string): string | null => {
	let cursor = skipTrivia(sql, 0);
	const keyword = readWord(sql, cursor);

	// Si no empieza por EXPLAIN, el fallo de parseo original es el que hay que devolver.
	if (keyword?.word.toLowerCase() !== 'explain') {
		return null;
	}

	cursor = keyword.next;

	while (cursor < sql.length) {
		const before = cursor;
		cursor = skipTrivia(sql, cursor);

		// EXPLAIN sin sentencia detrás no se puede clasificar.
		if (cursor >= sql.length) {
			return null;
		}

		// (ANALYZE, BUFFERS) agrupa opciones. No es el inicio de la sentencia.
		if (sql[cursor] === '(') {
			const afterGroup = skipParentheses(sql, cursor);
			if (afterGroup === null || afterGroup <= before) {
				return null;
			}
			cursor = afterGroup;
			continue;
		}

		const option = readWord(sql, cursor);
		// Lo que no es una palabra ya es la sentencia: se deja de quitar opciones.
		if (option === null) {
			break;
		}

		const name = option.word.toLowerCase();
		if (EXPLAIN_OPTIONS.has(name)) {
			cursor = option.next;
		} else if (name === 'format') {
			// FORMAT y FORMAT = JSON se quitan enteros. El valor no es la sentencia.
			cursor = skipTrivia(sql, option.next);
			if (sql[cursor] === '=') {
				cursor = skipTrivia(sql, cursor + 1);
			}
			const value = readWord(sql, cursor);
			if (value === null) {
				return null;
			}
			cursor = value.next;
		} else {
			break;
		}

		// Si el cursor no avanza, el bucle no terminaría. Se aborta el recorte.
		if (cursor <= before) {
			return null;
		}
	}

	const statement = sql.slice(cursor).trim();
	return statement === '' ? null : statement;
};

/** Primera línea del error del parser: el resto es el SQL repetido. */
const parserMessage = (error: unknown): string => {
	const message = error instanceof Error ? error.message : String(error);
	const firstLine = message.split('\n')[0] ?? message;
	return `SQL could not be parsed: ${firstLine}`;
};

/**
 * Parsea con el dialecto del motor.
 * Si el texto es un EXPLAIN que el parser rechaza, clasifica solo la sentencia interior.
 */
const parseStatements = (sql: string, database: string): AstNode[] => {
	try {
		return statements(parser.astify(sql, { database }));
	} catch (error) {
		const statement = statementAfterExplain(sql);
		// No era un EXPLAIN: el error de parseo se propaga y no se marca como lectura.
		if (statement === null) {
			throw new SqlClassificationError(parserMessage(error));
		}

		try {
			// Mismo nodo que un EXPLAIN nativo, para usar la misma regla de clasificación.
			return [{ type: 'explain', expr: parser.astify(statement, { database }) }];
		} catch (innerError) {
			throw new SqlClassificationError(parserMessage(innerError));
		}
	}
};

/** read solo si cada sentencia del lote es de lectura. */
export const classifyQuery = (sql: string, serverType: SqlServerType): SqlAccess => {
	const nodes = parseStatements(sql.trim(), PARSER_DATABASE[serverType]);

	// Vacío no es escritura ni lectura: no hay nada que ejecutar.
	if (nodes.length === 0) {
		throw new SqlClassificationError('SQL query is empty');
	}

	// Una sola escritura bloquea el lote. En readOnly no se abre la base.
	return nodes.every(isReadStatement) ? 'read' : 'write';
};
