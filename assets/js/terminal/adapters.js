// Transport adapters for the terminal. The UI never talks to a socket directly.
//
// Wire protocol (JSON text frames, mirrored in backend/api/pty-protocol.md):
//   client → server  {type:"input",  data:string}
//                    {type:"resize", cols:number, rows:number}
//                    {type:"ping"}
//   server → client  {type:"output", data:string}
//                    {type:"exit",   code:number}
//                    {type:"error",  message:string}
//                    {type:"pong"}

class Emitter {
  constructor() { this.h = {}; }
  on(ev, fn) { (this.h[ev] ||= new Set()).add(fn); return () => this.h[ev].delete(fn); }
  emit(ev, ...a) { this.h[ev]?.forEach((fn) => fn(...a)); }
}

/** Used when no backend is configured. Never pretends to run commands. */
export class DisconnectedAdapter extends Emitter {
  constructor() { super(); this.state = 'disconnected'; }
  connect() { this.emit('state', this.state); this.emit('error', 'NO_BACKEND'); }
  send() { this.emit('error', 'NOT_CONNECTED'); }
  resize() {}
  close() {}
}

/** Real PTY transport. Authenticates with a short-lived ticket fetched from the API (never a stored secret). */
export class WebSocketAdapter extends Emitter {
  constructor({ url, getTicket, WebSocketImpl = globalThis.WebSocket }) {
    super();
    this.url = url; this.getTicket = getTicket; this.WS = WebSocketImpl;
    this.state = 'disconnected'; this.ws = null;
  }
  setState(s) { this.state = s; this.emit('state', s); }
  async connect() {
    if (this.ws) return;
    this.setState('connecting');
    let ticket;
    try { ticket = await this.getTicket(); } catch (e) { this.setState('disconnected'); this.emit('error', 'AUTH_FAILED'); return; }
    const ws = new this.WS(`${this.url}?ticket=${encodeURIComponent(ticket)}`);
    this.ws = ws;
    ws.onopen = () => this.setState('connected');
    ws.onclose = () => { this.ws = null; this.setState('disconnected'); };
    ws.onerror = () => this.emit('error', 'SOCKET_ERROR');
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'output') this.emit('output', String(msg.data));
      else if (msg.type === 'exit') this.emit('exit', msg.code);
      else if (msg.type === 'error') this.emit('error', String(msg.message));
    };
  }
  frame(obj) {
    if (!this.ws || this.state !== 'connected') { this.emit('error', 'NOT_CONNECTED'); return false; }
    this.ws.send(JSON.stringify(obj)); return true;
  }
  send(data) { return this.frame({ type: 'input', data }); }
  resize(cols, rows) { return this.frame({ type: 'resize', cols, rows }); }
  close() { this.ws?.close(); }
}
