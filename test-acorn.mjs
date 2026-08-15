import * as acorn from 'https://cdn.jsdelivr.net/npm/acorn@8.18.0/+esm';
import jsx from 'https://cdn.jsdelivr.net/npm/acorn-jsx/+esm';
import { tsPlugin } from 'https://cdn.jsdelivr.net/npm/@sveltejs/acorn-typescript/+esm';

const TSXParser = acorn.Parser.extend(jsx(), tsPlugin());

try {
  TSXParser.parse(`const x = 1;\nx.replace(/\\\`[^\\\`]*\\\`/g, 'STR');`, { ecmaVersion: 2022, sourceType: 'module' });
  console.log('OK');
} catch (e) {
  console.error('Error:', e.message);
}
