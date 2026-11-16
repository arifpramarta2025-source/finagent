import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

function serverFiles(): string[] {
  const inFolder = readdirSync(new URL('../server/', import.meta.url), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => `server/${file}`);
  return ['server.ts', ...inFolder];
}

test('no Gemini key is written into the server code', () => {
  const files = serverFiles();
  assert.ok(files.length > 5, 'server files were not found');
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}|['"]AQ\.[0-9A-Za-z_-]{20,}['"]/, file);
  }
});
