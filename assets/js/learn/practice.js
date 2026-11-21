// CORNOD Learn: deliberately local command-learning model.
// NOT Linux, not a shell, no eval/spawn/fetch, no backend, no host filesystem.
const INITIAL = Object.freeze({
  '/home/student': { type: 'dir' },
  '/home/student/README.txt': { type: 'file', text: 'Welcome to CORNOD Learn!\nPractice pwd, ls, cd, cat and mkdir.' },
  '/home/student/projects': { type: 'dir' },
  '/home/student/projects/hello.txt': { type: 'file', text: 'Hello from your practice folder!' },
  '/home/student/notes': { type: 'dir' }
});

export const LESSONS = Object.freeze([
  { id: 'pwd', ar: 'أعرف مكانك', en: 'Where am I?', detailAr: 'الأمر pwd يطبع المجلد الحالي.', detailEn: 'pwd prints the current directory.', taskAr: 'اكتب pwd', taskEn: 'Type pwd', hint: 'pwd', success: (command, output) => command === 'pwd' && output === '/home/student' },
  { id: 'ls', ar: 'استعرض الملفات', en: 'List files', detailAr: 'الأمر ls يعرض الملفات والمجلدات.', detailEn: 'ls lists files and directories.', taskAr: 'اكتب ls', taskEn: 'Type ls', hint: 'ls', success: (command, output) => command === 'ls' && output.includes('projects') },
  { id: 'cd', ar: 'انتقل بين المجلدات', en: 'Change directories', detailAr: 'استخدم cd للانتقال إلى مجلد داخل النظام التدريبي.', detailEn: 'cd changes your practice directory.', taskAr: 'اكتب cd projects', taskEn: 'Type cd projects', hint: 'cd projects', success: (command, _output, state) => command === 'cd projects' && state.cwd === '/home/student/projects' },
  { id: 'cat', ar: 'اقرأ ملفًا', en: 'Read a file', detailAr: 'الأمر cat يقرأ محتوى ملف نصي.', detailEn: 'cat displays a text file.', taskAr: 'اكتب cat hello.txt وأنت داخل projects', taskEn: 'Type cat hello.txt from projects', hint: 'cat hello.txt', success: (command, output) => command === 'cat hello.txt' && output.includes('Hello from') },
  { id: 'mkdir', ar: 'أنشئ مجلدًا', en: 'Make a directory', detailAr: 'الأمر mkdir ينشئ مجلدًا جديدًا.', detailEn: 'mkdir creates a directory.', taskAr: 'اكتب mkdir lab داخل projects', taskEn: 'Type mkdir lab inside projects', hint: 'mkdir lab', success: (command, _output, state) => command === 'mkdir lab' && state.files['/home/student/projects/lab']?.type === 'dir' },
  { id: 'touch', ar: 'أنشئ ملفًا', en: 'Create a file', detailAr: 'الأمر touch ينشئ ملفًا فارغًا.', detailEn: 'touch creates an empty file.', taskAr: 'اكتب touch test.txt داخل projects', taskEn: 'Type touch test.txt inside projects', hint: 'touch test.txt', success: (command, _output, state) => command === 'touch test.txt' && state.files['/home/student/projects/test.txt']?.type === 'file' }
]);

function normalize(cwd, input = '.') {
  if (typeof input !== 'string' || !input || input.length > 128) throw new Error('INVALID_PATH');
  const parts = (input.startsWith('/') ? [] : cwd.split('/').filter(Boolean));
  for (const part of input.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else if (part === '~') return normalize('/home/student', input.slice(2) || '.');
    else parts.push(part);
  }
  const resolved = '/' + parts.join('/');
  if (resolved !== '/home/student' && !resolved.startsWith('/home/student/')) throw new Error('OUTSIDE_PRACTICE');
  return resolved;
}

function argsOf(command) {
  const trimmed = String(command ?? '').trim();
  if (trimmed.length > 256) throw new Error('TOO_LONG');
  if (!trimmed) return [];
  // This is an intentionally small learning parser: no piping, quoting, redirection,
  // substitutions, shell variables or executable commands.
  if (/[;&|><`$\\\n\r]/.test(trimmed)) throw new Error('UNSUPPORTED_SYNTAX');
  return trimmed.split(/\s+/);
}

export function createPractice() {
  const files = Object.fromEntries(Object.entries(INITIAL).map(([key,value]) => [key,{ ...value }]));
  return { cwd: '/home/student', files, completed: [], attempts: 0 };
}

export function executePractice(state, source) {
  try {
    const args = argsOf(source);
    if (!args.length) return { output: '', ok: true };
    const [cmd, ...params] = args;
    if (state.attempts++ >= 2000) return { output: 'Practice limit reached. Reset to continue.', ok: false };
    const one = (allowZero = false) => {
      if (params.length !== 1 && !(allowZero && params.length === 0)) throw new Error('USAGE');
      return params[0];
    };
    const at = (p) => normalize(state.cwd, p);
    const entry = (p) => state.files[p];
    const mustDir = (p) => { if (entry(p)?.type !== 'dir') throw new Error('NOT_A_DIRECTORY'); };
    let output = '';
    switch (cmd) {
      case 'help':
        if (params.length) throw new Error('USAGE');
        output = 'Commands: help, pwd, ls, cd, cat, mkdir, touch, clear, whoami, echo\nThis is a browser practice simulator, NOT real Linux.';
        break;
      case 'pwd':
        if (params.length) throw new Error('USAGE');
        output = state.cwd;
        break;
      case 'whoami':
        if (params.length) throw new Error('USAGE');
        output = 'student (practice identity, not OS user)';
        break;
      case 'echo':
        output = params.join(' ');
        break;
      case 'ls': {
        const path = at(one(true) || '.'); mustDir(path);
        output = Object.keys(state.files).filter((item) => item !== path && item.startsWith(path + '/'))
          .map((item) => item.slice(path.length + 1))
          .filter((item) => !item.includes('/')).sort().join('  ') || '(empty)';
        break;
      }
      case 'cd': {
        const path = at(one(true) || '/home/student'); mustDir(path); state.cwd = path;
        break;
      }
      case 'cat': {
        const path = at(one()); if (entry(path)?.type !== 'file') throw new Error('FILE_NOT_FOUND');
        output = entry(path).text;
        break;
      }
      case 'mkdir':
      case 'touch': {
        const path = at(one()); const parent = path.slice(0, path.lastIndexOf('/')) || '/';
        mustDir(parent);
        if (entry(path)) throw new Error('ALREADY_EXISTS');
        if (Object.keys(state.files).length >= 100) throw new Error('FILE_LIMIT');
        state.files[path] = cmd === 'mkdir' ? { type: 'dir' } : { type: 'file', text: '' };
        break;
      }
      case 'clear':
        if (params.length) throw new Error('USAGE');
        return { output: '', clear: true, ok: true };
      default:
        return { output: `Command not in learning simulator: ${cmd}. Type help.`, ok: false };
    }
    const fullCommand = args.join(' ');
    const lesson = LESSONS.find((item) => !state.completed.includes(item.id) && item.success(fullCommand, output, state));
    if (lesson) state.completed.push(lesson.id);
    return { output, ok: true, completedLesson: lesson?.id || null };
  } catch (err) {
    const messages = {
      INVALID_PATH: 'Invalid path', OUTSIDE_PRACTICE: 'Outside the practice home is blocked',
      TOO_LONG: 'Command too long', UNSUPPORTED_SYNTAX: 'Shell operators are disabled in this simulator',
      USAGE: 'Incorrect command arguments', NOT_A_DIRECTORY: 'Directory does not exist',
      FILE_NOT_FOUND: 'File not found', ALREADY_EXISTS: 'File or directory already exists',
      FILE_LIMIT: 'Practice file limit reached'
    };
    return { output: messages[err.message] || 'Invalid input', ok: false };
  }
}
