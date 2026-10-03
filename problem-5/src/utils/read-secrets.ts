import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isPlainObject, type PlainObject } from './merge';

const DEFAULT_SECRETS_FILE = 'secrets.json';

/** Reads the secrets file (JSON). `SECRETS_PATH` overrides the default `./secrets.json`. */
export function readSecrets(file = process.env.SECRETS_PATH ?? DEFAULT_SECRETS_FILE): PlainObject {
  const resolved = path.resolve(file);
  let text: string;
  try {
    text = readFileSync(resolved, 'utf8');
  } catch {
    throw new Error(
      `Cannot read secrets file at ${resolved}. Copy secrets.example.json to secrets.json and fill it in.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Secrets file ${resolved} is not valid JSON`);
  }
  if (!isPlainObject(parsed))
    throw new Error(`Secrets file ${resolved} must contain a JSON object`);
  return parsed;
}
