import { describe, expect, it } from 'vitest';

import { SqlClassificationError } from '../src/errors';
import { classifyQuery, SQL_SERVER_TYPES } from '../src/queryAnalyzer';
import type { SqlServerType } from '../src/types';

const readOn = (serverType: SqlServerType, sql: string): void => {
	expect(classifyQuery(sql, serverType)).toBe('read');
};

const writeOn = (serverType: SqlServerType, sql: string): void => {
	expect(classifyQuery(sql, serverType)).toBe('write');
};

describe('classifyQuery', () => {
	it('exposes the three server types', () => {
		expect(SQL_SERVER_TYPES).toEqual(['mysql', 'mariadb', 'postgres']);
	});

	it.each(SQL_SERVER_TYPES)('treats a plain SELECT as read on %s', (serverType) => {
		readOn(serverType, 'SELECT 1');
		readOn(serverType, '  select id, name from accounts  ');
	});

	it.each(['mysql', 'mariadb'] as const)('treats DESCRIBE and DESC as read on %s', (serverType) => {
		readOn(serverType, 'DESCRIBE accounts');
		readOn(serverType, 'DESC accounts');
	});

	it.each(SQL_SERVER_TYPES)('treats EXPLAIN of a read as read on %s', (serverType) => {
		readOn(serverType, 'EXPLAIN SELECT 1');
		readOn(serverType, 'EXPLAIN ANALYZE SELECT 1');
		readOn(serverType, 'EXPLAIN (ANALYZE, BUFFERS) SELECT 1');
		readOn(serverType, 'EXPLAIN FORMAT JSON SELECT 1');
		readOn(serverType, '-- note\nEXPLAIN SELECT 1');
	});

	it.each(SQL_SERVER_TYPES)('treats a WITH of a SELECT as read on %s', (serverType) => {
		readOn(serverType, 'WITH cte AS (SELECT 1 AS id) SELECT id FROM cte');
	});

	it('treats a UNION of reads as read', () => {
		readOn('mysql', 'SELECT 1 UNION SELECT 2');
		readOn('postgres', 'SELECT 1 UNION SELECT 2');
	});

	it.each(SQL_SERVER_TYPES)('treats INSERT, UPDATE, and DELETE as write on %s', (serverType) => {
		writeOn(serverType, "INSERT INTO accounts (id, name) VALUES (1, 'ada')");
		writeOn(serverType, "UPDATE accounts SET name = 'ada' WHERE id = 1");
		writeOn(serverType, 'DELETE FROM accounts WHERE id = 1');
	});

	it.each(['mysql', 'mariadb'] as const)('treats SELECT INTO OUTFILE as write on %s', (serverType) => {
		writeOn(serverType, "SELECT id, name INTO OUTFILE '/tmp/accounts.txt' FROM accounts");
	});

	it.each(['mysql', 'mariadb'] as const)('treats FOR UPDATE, SHOW, and EXPLAIN of a write as write on %s', (serverType) => {
		writeOn(serverType, 'SELECT id FROM accounts FOR UPDATE');
		writeOn(serverType, 'SHOW TABLES');
		writeOn(serverType, 'EXPLAIN DELETE FROM accounts');
	});

	it('treats LOCK IN SHARE MODE as write on mysql', () => {
		writeOn('mysql', 'SELECT id FROM accounts LOCK IN SHARE MODE');
	});

	it('does not treat an unparsed LOCK IN SHARE MODE on mariadb as read', () => {
		expect(() => classifyQuery('SELECT id FROM accounts LOCK IN SHARE MODE', 'mariadb')).toThrow(SqlClassificationError);
	});

	it('treats a data-modifying CTE as write on postgres', () => {
		writeOn('postgres', 'WITH removed AS (DELETE FROM accounts) SELECT 1');
	});

	it('does not treat an unparsed data-modifying CTE on mysql as read', () => {
		expect(() => classifyQuery('WITH removed AS (DELETE FROM accounts) SELECT 1', 'mysql')).toThrow(
			SqlClassificationError,
		);
	});

	it.each(SQL_SERVER_TYPES)('rejects SQL the parser cannot classify on %s', (serverType) => {
		expect(() => classifyQuery('NOT SQL', serverType)).toThrow(SqlClassificationError);
		expect(() => classifyQuery('NOT SQL', serverType)).toThrow(/SQL could not be parsed/);
	});

	it.each(SQL_SERVER_TYPES)('rejects an empty query on %s', (serverType) => {
		expect(() => classifyQuery('   ', serverType)).toThrow(SqlClassificationError);
		expect(() => classifyQuery('   ', serverType)).toThrow('SQL query is empty');
	});

	it('rejects EXPLAIN when the explained statement cannot be parsed', () => {
		expect(() => classifyQuery('EXPLAIN NOT SQL', 'postgres')).toThrow(SqlClassificationError);
	});

	it('rejects EXPLAIN with a broken option list', () => {
		expect(() => classifyQuery('EXPLAIN (ANALYZE SELECT 1', 'postgres')).toThrow(SqlClassificationError);
	});

	it('does not treat an unparsed locking read on postgres as read', () => {
		expect(() => classifyQuery('SELECT id FROM accounts FOR UPDATE', 'postgres')).toThrow(SqlClassificationError);
	});
});

describe('concatenated statements', () => {
	it.each(SQL_SERVER_TYPES)('stays read when every statement is a read on %s', (serverType) => {
		readOn(serverType, 'SELECT 1; SELECT 2');
		readOn(serverType, 'SELECT 1; SELECT 2; SELECT 3');
		readOn(serverType, 'SELECT id FROM accounts; SELECT name FROM accounts');
	});

	it.each(SQL_SERVER_TYPES)('is write when a write appears before a read on %s', (serverType) => {
		writeOn(serverType, 'DELETE FROM accounts; SELECT 1');
		writeOn(serverType, "INSERT INTO accounts (id, name) VALUES (1, 'ada'); SELECT 1");
		writeOn(serverType, "UPDATE accounts SET name = 'ada'; SELECT name FROM accounts");
	});

	it.each(SQL_SERVER_TYPES)('is write when a write appears after a read on %s', (serverType) => {
		writeOn(serverType, 'SELECT 1; DELETE FROM accounts');
		writeOn(serverType, "SELECT 1; INSERT INTO accounts (id, name) VALUES (1, 'ada')");
		writeOn(serverType, "SELECT name FROM accounts; UPDATE accounts SET name = 'ada'");
	});

	it.each(SQL_SERVER_TYPES)('is write when the write is between reads on %s', (serverType) => {
		writeOn(serverType, 'SELECT 1; DELETE FROM accounts; SELECT 2');
		writeOn(serverType, "SELECT 1; UPDATE accounts SET name = 'ada' WHERE id = 1; SELECT 2");
	});

	it.each(SQL_SERVER_TYPES)('is write when every statement writes on %s', (serverType) => {
		writeOn(
			serverType,
			"INSERT INTO accounts (id, name) VALUES (1, 'ada'); UPDATE accounts SET name = 'grace' WHERE id = 1; DELETE FROM accounts WHERE id = 1",
		);
	});

	it.each(['mysql', 'mariadb'] as const)('keeps a describe batch as read on %s', (serverType) => {
		readOn(serverType, 'DESCRIBE accounts; SELECT id FROM accounts');
		readOn(serverType, 'DESC accounts; EXPLAIN SELECT 1');
	});

	it.each(['mysql', 'mariadb'] as const)('is write when SHOW, a lock, or INTO OUTFILE follows a read on %s', (serverType) => {
		writeOn(serverType, 'SELECT 1; SHOW TABLES');
		writeOn(serverType, 'SELECT id FROM accounts FOR UPDATE; SELECT 1');
		writeOn(serverType, "SELECT 1; SELECT id, name INTO OUTFILE '/tmp/accounts.txt' FROM accounts");
	});

	it.each(['mysql', 'mariadb'] as const)('does not treat an explain batch the parser cannot split as read on %s', (serverType) => {
		expect(() => classifyQuery('EXPLAIN SELECT 1; EXPLAIN DELETE FROM accounts', serverType)).toThrow(
			SqlClassificationError,
		);
	});

	it('treats a leading EXPLAIN of a delete as write on postgres', () => {
		writeOn('postgres', 'EXPLAIN DELETE FROM accounts; SELECT 1');
	});

	it('does not treat a trailing EXPLAIN the parser misses as read on postgres', () => {
		expect(() => classifyQuery('SELECT 1; EXPLAIN DELETE FROM accounts', 'postgres')).toThrow(SqlClassificationError);
	});

	it.each(SQL_SERVER_TYPES)('does not treat a batch with unparsed SQL as read on %s', (serverType) => {
		expect(() => classifyQuery('SELECT 1; NOT SQL', serverType)).toThrow(SqlClassificationError);
		expect(() => classifyQuery('NOT SQL; SELECT 1', serverType)).toThrow(SqlClassificationError);
	});
});
