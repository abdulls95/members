import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DisconnectedAdapter, WebSocketAdapter } from '../../assets/js/terminal/adapters.js';
import { TerminalController } from '../../assets/js/terminal/controller.js';

function harness(adapter) {
  const lines = []; let cleared = 0;
  const ctl = new TerminalController({ adapter, print: (s, k) => lines.push([k, s]), clear: () => { cleared++; }, lang: () => 'en' });
  return { ctl, lines, cleared: () => cleared };
}

test('disconnected adapter never claims to execute commands', () => {
  const a = new DisconnectedAdapter(); const { ctl, lines } = harness(a);
  ctl.submit('rm -rf /');
  assert.deepEqual(lines[0], ['in', 'rm -rf /']);
  assert.equal(lines[1][0], 'err');
  assert.match(lines[1][1], /NOT executed/);
});

test('local meta-commands and history', () => {
  const { ctl, lines, cleared } = harness(new DisconnectedAdapter());
  ctl.submit(':help'); assert.ok(lines.some(([k, s]) => k === 'dim' && s.includes(':clear')));
  ctl.submit(':clear'); assert.equal(cleared(), 1);
  ctl.submit('ls'); ctl.submit('ls'); ctl.submit('pwd');
  assert.deepEqual(ctl.history, [':help', ':clear', 'ls', 'pwd'], 'consecutive duplicates collapsed');
  assert.equal(ctl.navigate(-1), 'pwd'); assert.equal(ctl.navigate(-1), 'ls'); assert.equal(ctl.navigate(1), 'pwd'); assert.equal(ctl.navigate(1), '');
  ctl.submit(':bogus'); assert.match(lines.at(-1)[1], /unknown local command/);
});

class FakeWS {
  static last;
  constructor(url) { this.url = url; this.sent = []; FakeWS.last = this; }
  send(d) { this.sent.push(JSON.parse(d)); }
  close() { this.onclose?.(); }
}

test('websocket adapter: ticket auth, framing, output, state', async () => {
  const states = [];
  const a = new WebSocketAdapter({ url: 'wss://api.test/pty', getTicket: async () => 'tk/1', WebSocketImpl: FakeWS });
  a.on('state', (s) => states.push(s));
  const { ctl, lines } = harness(a);

  ctl.submit('ls'); // before connect
  assert.match(lines.at(-1)[1], /NOT executed/);

  await a.connect();
  assert.equal(FakeWS.last.url, 'wss://api.test/pty?ticket=tk%2F1');
  FakeWS.last.onopen();
  assert.deepEqual(states, ['connecting', 'connected']);

  ctl.submit('uname -a');
  assert.deepEqual(FakeWS.last.sent[0], { type: 'input', data: 'uname -a\n' });
  a.resize(120, 40);
  assert.deepEqual(FakeWS.last.sent[1], { type: 'resize', cols: 120, rows: 40 });

  FakeWS.last.onmessage({ data: JSON.stringify({ type: 'output', data: 'Linux' }) });
  FakeWS.last.onmessage({ data: 'not json' }); // ignored safely
  FakeWS.last.onmessage({ data: JSON.stringify({ type: 'exit', code: 0 }) });
  assert.deepEqual(lines.slice(-2), [['out', 'Linux'], ['sys', '[process exited: 0]']]);

  a.close();
  assert.equal(states.at(-1), 'disconnected');
});

test('websocket adapter: ticket failure surfaces an error and stays disconnected', async () => {
  const a = new WebSocketAdapter({ url: 'wss://x', getTicket: async () => { throw new Error('401'); }, WebSocketImpl: FakeWS });
  const { lines } = harness(a);
  await a.connect();
  assert.equal(a.state, 'disconnected');
  assert.match(lines.at(-1)[1], /session ticket/);
});
