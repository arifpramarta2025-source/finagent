/** Reads a server-sent stream that may be cut at any byte. Each event carries one JSON object. */
export function createSseParser(onEvent: (event: unknown) => void) {
  let buffer = '';

  const readBlock = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (data) onEvent(JSON.parse(data));
  };

  return function push(chunk: string): void {
    buffer += chunk;
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    blocks.forEach(readBlock);
  };
}
