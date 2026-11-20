// DOM-free terminal logic: history, local meta-commands, routing input to the adapter.
// Lines starting with ":" are handled locally; everything else goes to the remote PTY.
export const ERR_TEXT = {
  NO_BACKEND: { en: 'No sandbox backend is configured. This terminal is not connected to any Linux machine.', ar: 'لا يوجد خادم بيئات معزولة مُعدّ. هذه الطرفية غير متصلة بأي جهاز Linux.' },
  NOT_CONNECTED: { en: 'Not connected — command was NOT executed. Type :help for local commands.', ar: 'غير متصل — لم يُنفَّذ الأمر. اكتب ‎:help‎ لعرض الأوامر المحلية.' },
  AUTH_FAILED: { en: 'Could not obtain a session ticket.', ar: 'تعذّر الحصول على تذكرة جلسة.' },
  SOCKET_ERROR: { en: 'Connection error.', ar: 'خطأ في الاتصال.' },
};

const HELP = {
  en: [
    'Local commands (run in your browser, not on a server):',
    '  :help      show this help',
    '  :clear     clear the screen',
    '  :history   show input history',
    '  :status    show connection status',
    '  :connect   connect to your workspace',
    'Anything else is sent to the remote Linux shell when connected.',
  ],
  ar: [
    'أوامر محلية (تعمل في متصفحك، لا على خادم):',
    '  :help      عرض هذه المساعدة',
    '  :clear     مسح الشاشة',
    '  :history   عرض سجل الإدخال',
    '  :status    عرض حالة الاتصال',
    '  :connect   الاتصال بمساحة العمل',
    'أي شيء آخر يُرسل إلى صدفة Linux البعيدة عند الاتصال.',
  ],
};

export class TerminalController {
  constructor({ adapter, print, clear, lang = () => 'en', maxHistory = 200 }) {
    this.adapter = adapter; this.print = print; this.clearScreen = clear; this.lang = lang;
    this.history = []; this.cursor = 0; this.maxHistory = maxHistory;
    adapter.on('output', (d) => this.print(d, 'out'));
    adapter.on('error', (code) => this.print(ERR_TEXT[code]?.[this.lang()] ?? code, 'err'));
    adapter.on('exit', (c) => this.print(`[process exited: ${c}]`, 'sys'));
  }

  submit(line) {
    const input = line.replace(/\s+$/, '');
    if (input.trim()) {
      if (this.history[this.history.length - 1] !== input) this.history.push(input);
      if (this.history.length > this.maxHistory) this.history.shift();
    }
    this.cursor = this.history.length;
    this.print(input, 'in');
    const trimmed = input.trim();
    if (!trimmed) return;
    if (trimmed.startsWith(':')) return this.local(trimmed.slice(1).split(/\s+/)[0]);
    this.adapter.send(input + '\n');
  }

  local(cmd) {
    const l = this.lang();
    switch (cmd) {
      case 'help': HELP[l].forEach((x) => this.print(x, 'dim')); break;
      case 'clear': this.clearScreen(); break;
      case 'history': this.history.forEach((h, i) => this.print(`${String(i + 1).padStart(4)}  ${h}`, 'dim')); break;
      case 'status': this.print(`state: ${this.adapter.state}`, 'sys'); break;
      case 'connect': this.adapter.connect(); break;
      default: this.print(l === 'ar' ? `أمر محلي غير معروف: :${cmd}` : `unknown local command: :${cmd}`, 'err');
    }
  }

  /** Navigate history. dir = -1 (older) or +1 (newer). Returns the line to show. */
  navigate(dir) {
    this.cursor = Math.max(0, Math.min(this.history.length, this.cursor + dir));
    return this.history[this.cursor] ?? '';
  }
}
