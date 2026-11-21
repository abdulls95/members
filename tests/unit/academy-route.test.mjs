import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../assets/js/app.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../../assets/js/views/pages.js', import.meta.url), 'utf8');

test('Academy is visible and the disconnected terminal is retired', () => {
  assert.match(source, /path: '\/learn'.*group: 'build'.*view: learn/);
  assert.match(source, /path: '\/terminal'.*group: 'legacy'.*view: learn/);
  assert.doesNotMatch(source, /import \{ terminal \} from/);
  assert.doesNotMatch(home, /href="#\/terminal"/);
  assert.match(home, /href="#\/learn"/);
});
