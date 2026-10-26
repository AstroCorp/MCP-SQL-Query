import { readFile } from 'node:fs/promises';
import { parseConfig } from './configLoaderSchema';
import { ConfigValidationError } from './errors';
import type { AppConfig } from './types';

/** Lee un JSON de conexiones y lo valida con el esquema. */
export const loadConfig = async (filePath: string): Promise<AppConfig> => {
	let raw: string;

	try {
		raw = await readFile(filePath, 'utf8');
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		throw new ConfigValidationError(`Could not read configuration at ${filePath}: ${message}`);
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(raw) as unknown;
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		throw new ConfigValidationError(`File ${filePath} is not valid JSON: ${message}`);
	}

	return parseConfig(parsed);
};
