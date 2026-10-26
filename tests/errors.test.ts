import { describe, expect, it } from 'vitest';

import { ConfigValidationError, QueryExecutionError, SqlClassificationError } from '../src/errors';

describe('custom errors', () => {
	it('keeps the class name on ConfigValidationError', () => {
		const error = new ConfigValidationError('invalid');

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('ConfigValidationError');
		expect(error.message).toBe('invalid');
	});

	it('keeps the class name on SqlClassificationError', () => {
		const error = new SqlClassificationError('unparsed');

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('SqlClassificationError');
		expect(error.message).toBe('unparsed');
	});

	it('keeps the class name on QueryExecutionError', () => {
		const error = new QueryExecutionError('blocked');

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('QueryExecutionError');
		expect(error.message).toBe('blocked');
	});
});
