// Static catalog data. When the backend ships, these move to the API (GET /v1/catalog/*);
// the shapes here are the contract.

export const TOOLS = [
  { id: 'git', name: 'Git', cat: 'dev', risk: 'low', pkg: 'git', d: { en: 'Distributed version control.', ar: 'نظام إدارة الإصدارات الموزّع.' } },
  { id: 'node', name: 'Node.js 22 LTS', cat: 'dev', risk: 'low', pkg: 'nodejs', d: { en: 'JavaScript runtime with npm.', ar: 'بيئة تشغيل JavaScript مع npm.' } },
  { id: 'python', name: 'Python 3.13', cat: 'dev', risk: 'low', pkg: 'python3', d: { en: 'Python with pip and venv.', ar: 'Python مع pip وvenv.' } },
  { id: 'go', name: 'Go', cat: 'dev', risk: 'low', pkg: 'golang', d: { en: 'Go toolchain.', ar: 'أدوات لغة Go.' } },
  { id: 'neovim', name: 'Neovim', cat: 'dev', risk: 'low', pkg: 'neovim', d: { en: 'Modal text editor.', ar: 'محرر نصوص متقدم.' } },
  { id: 'tmux', name: 'tmux', cat: 'sys', risk: 'low', pkg: 'tmux', d: { en: 'Terminal multiplexer.', ar: 'مُقسِّم جلسات الطرفية.' } },
  { id: 'htop', name: 'htop', cat: 'sys', risk: 'low', pkg: 'htop', d: { en: 'Interactive process viewer.', ar: 'عارض تفاعلي للعمليات.' } },
  { id: 'jq', name: 'jq', cat: 'sys', risk: 'low', pkg: 'jq', d: { en: 'JSON processor.', ar: 'معالج JSON.' } },
  { id: 'docker-cli', name: 'Docker CLI (rootless)', cat: 'ops', risk: 'medium', pkg: 'docker-ce-cli', d: { en: 'Container tooling inside your microVM only.', ar: 'أدوات الحاويات داخل بيئتك المعزولة فقط.' } },
  { id: 'terraform', name: 'Terraform', cat: 'ops', risk: 'medium', pkg: 'terraform', d: { en: 'Infrastructure as code.', ar: 'البنية التحتية ككود.' } },
  { id: 'kubectl', name: 'kubectl', cat: 'ops', risk: 'medium', pkg: 'kubectl', d: { en: 'Kubernetes CLI.', ar: 'واجهة أوامر Kubernetes.' } },
  { id: 'nmap', name: 'Nmap', cat: 'sec', risk: 'high', pkg: 'nmap', d: { en: 'Network scanner. Egress limited to lab networks.', ar: 'ماسح شبكات. الاتصال الخارجي مقصور على شبكات المختبر.' } },
  { id: 'wireshark', name: 'tshark', cat: 'sec', risk: 'medium', pkg: 'tshark', d: { en: 'Packet analysis (CLI).', ar: 'تحليل الحزم (سطر أوامر).' } },
  { id: 'sqlmap', name: 'sqlmap', cat: 'sec', risk: 'high', pkg: 'sqlmap', d: { en: 'SQL injection testing. Lab targets only.', ar: 'اختبار حقن SQL. أهداف المختبر فقط.' } },
];

export const TOOL_CATS = {
  dev: { en: 'Development', ar: 'التطوير' }, sys: { en: 'System', ar: 'النظام' },
  ops: { en: 'DevOps', ar: 'DevOps' }, sec: { en: 'Security', ar: 'الأمن' },
};

export const COMMANDS = [
  { c: 'ls -lah', cat: 'files', d: { en: 'List all files with sizes in human units.', ar: 'عرض كل الملفات مع أحجامها بصيغة مقروءة.' } },
  { c: 'find . -type f -name "*.log" -mtime -1', cat: 'files', d: { en: 'Log files changed in the last 24h.', ar: 'ملفات السجل المعدّلة خلال آخر 24 ساعة.' } },
  { c: 'du -sh * | sort -h', cat: 'files', d: { en: 'Directory sizes, smallest to largest.', ar: 'أحجام المجلدات من الأصغر للأكبر.' } },
  { c: 'tar -czf backup.tar.gz ./project', cat: 'files', d: { en: 'Create a compressed archive.', ar: 'إنشاء أرشيف مضغوط.' } },
  { c: 'chmod 640 config.env', cat: 'perm', d: { en: 'Owner read/write, group read, others none.', ar: 'قراءة/كتابة للمالك، قراءة للمجموعة، لا شيء للآخرين.' } },
  { c: 'sudo -l', cat: 'perm', d: { en: 'Show what you may run with sudo.', ar: 'عرض ما يُسمح لك بتشغيله عبر sudo.' } },
  { c: 'ps aux --sort=-%mem | head', cat: 'proc', d: { en: 'Top memory consumers.', ar: 'أكثر العمليات استهلاكًا للذاكرة.' } },
  { c: 'kill -TERM <pid>', cat: 'proc', d: { en: 'Ask a process to exit gracefully.', ar: 'طلب إنهاء عملية بشكل سليم.' } },
  { c: 'journalctl -u nginx --since "1 hour ago"', cat: 'proc', d: { en: 'Service logs from the last hour.', ar: 'سجلات الخدمة خلال الساعة الأخيرة.' } },
  { c: 'ss -tulpn', cat: 'net', d: { en: 'Listening sockets and owning processes.', ar: 'المنافذ المفتوحة والعمليات المالكة لها.' } },
  { c: 'curl -sI https://example.com', cat: 'net', d: { en: 'Fetch only HTTP response headers.', ar: 'جلب ترويسات استجابة HTTP فقط.' } },
  { c: 'dig +short A example.com', cat: 'net', d: { en: 'Resolve an A record.', ar: 'استعلام سجل A.' } },
  { c: 'grep -rn "TODO" src/', cat: 'text', d: { en: 'Search recursively with line numbers.', ar: 'بحث متكرر مع أرقام الأسطر.' } },
  { c: 'awk -F: \'{print $1}\' /etc/passwd', cat: 'text', d: { en: 'Print the first field of each line.', ar: 'طباعة الحقل الأول من كل سطر.' } },
  { c: 'sed -i \'s/old/new/g\' file.txt', cat: 'text', d: { en: 'In-place find and replace.', ar: 'بحث واستبدال داخل الملف.' } },
  { c: 'git log --oneline --graph -20', cat: 'git', d: { en: 'Compact visual history.', ar: 'سجل مختصر مرئي.' } },
  { c: 'git switch -c feature/x', cat: 'git', d: { en: 'Create and switch to a branch.', ar: 'إنشاء فرع والانتقال إليه.' } },
];

export const CMD_CATS = {
  files: { en: 'Files', ar: 'الملفات' }, perm: { en: 'Permissions', ar: 'الصلاحيات' }, proc: { en: 'Processes', ar: 'العمليات' },
  net: { en: 'Network', ar: 'الشبكة' }, text: { en: 'Text', ar: 'النصوص' }, git: { en: 'Git', ar: 'Git' },
};

export const LABS = [
  { id: 'linux-101', level: 1, min: 30, t: { en: 'Linux foundations', ar: 'أساسيات Linux' }, d: { en: 'Filesystem, users, permissions, processes.', ar: 'نظام الملفات، المستخدمون، الصلاحيات، العمليات.' } },
  { id: 'net-recon', level: 2, min: 45, t: { en: 'Network reconnaissance', ar: 'استطلاع الشبكات' }, d: { en: 'Scan a private lab subnet and map its services.', ar: 'افحص شبكة مختبر خاصة واكتشف خدماتها.' } },
  { id: 'web-sqli', level: 2, min: 60, t: { en: 'Web: SQL injection', ar: 'الويب: حقن SQL' }, d: { en: 'Exploit and then fix a vulnerable app.', ar: 'استغل تطبيقًا مصابًا ثم أصلحه.' } },
  { id: 'privesc', level: 3, min: 60, t: { en: 'Linux privilege escalation', ar: 'تصعيد الصلاحيات في Linux' }, d: { en: 'Misconfigured SUID, cron and sudo rules.', ar: 'إعدادات SUID وcron وsudo الخاطئة.' } },
  { id: 'forensics', level: 3, min: 75, t: { en: 'Log forensics', ar: 'التحليل الجنائي للسجلات' }, d: { en: 'Reconstruct an intrusion from logs.', ar: 'أعد بناء حادثة اختراق من السجلات.' } },
  { id: 'hardening', level: 2, min: 45, t: { en: 'Server hardening', ar: 'تقوية الخوادم' }, d: { en: 'SSH, firewall, updates, auditing.', ar: 'SSH والجدار الناري والتحديثات والتدقيق.' } },
];

export const OSINT = [
  { id: 'dns', t: { en: 'DNS & WHOIS', ar: 'DNS وWHOIS' }, d: { en: 'Records, registrar, name servers.', ar: 'السجلات والمسجّل وخوادم الأسماء.' }, input: 'example.com' },
  { id: 'certs', t: { en: 'Certificate transparency', ar: 'شفافية الشهادات' }, d: { en: 'Subdomains from public CT logs.', ar: 'النطاقات الفرعية من سجلات CT العامة.' }, input: 'example.com' },
  { id: 'headers', t: { en: 'HTTP fingerprint', ar: 'بصمة HTTP' }, d: { en: 'Server headers, TLS, security headers.', ar: 'ترويسات الخادم وTLS وترويسات الأمان.' }, input: 'https://example.com' },
  { id: 'ip', t: { en: 'IP / ASN lookup', ar: 'استعلام IP / ASN' }, d: { en: 'Network owner and routing info.', ar: 'مالك الشبكة ومعلومات التوجيه.' }, input: '93.184.216.34' },
  { id: 'meta', t: { en: 'File metadata', ar: 'البيانات الوصفية للملفات' }, d: { en: 'EXIF/document metadata from your own uploads.', ar: 'بيانات EXIF والمستندات من ملفاتك المرفوعة.' }, input: 'upload' },
];

// Honest feature ledger shown on /status. Update as things ship.
export const FEATURES = [
  ['ui', 'live', { en: 'App shell, navigation, responsive layout', ar: 'هيكل التطبيق والتنقل والتصميم المتجاوب' }, { en: 'Static, runs entirely in the browser.', ar: 'ثابت ويعمل بالكامل في المتصفح.' }],
  ['i18n', 'live', { en: 'Arabic / English, RTL / LTR', ar: 'العربية / الإنجليزية، RTL / LTR' }, { en: 'Key parity enforced by tests.', ar: 'تطابق المفاتيح مضمون بالاختبارات.' }],
  ['cmd', 'live', { en: 'Command library (browse, search, copy)', ar: 'مكتبة الأوامر (تصفح، بحث، نسخ)' }, { en: 'Static catalog.', ar: 'كتالوج ثابت.' }],
  ['term', 'preview', { en: 'Terminal UI + WebSocket PTY client', ar: 'واجهة الطرفية + عميل WebSocket PTY' }, { en: 'Client is built and unit-tested; no sandbox server exists yet, so no command runs.', ar: 'العميل مبني ومختبر؛ لا يوجد خادم بيئات بعد، لذلك لا يُنفّذ أي أمر.' }],
  ['rbac', 'preview', { en: 'Roles & permissions model', ar: 'نموذج الأدوار والصلاحيات' }, { en: 'Model + UI gating done; real enforcement needs the API.', ar: 'النموذج وتقييد الواجهة جاهزان؛ التطبيق الفعلي يحتاج الـ API.' }],
  ['mkt', 'preview', { en: 'Tool marketplace', ar: 'سوق الأدوات' }, { en: 'Catalog UI only; install needs a workspace.', ar: 'واجهة الكتالوج فقط؛ التثبيت يحتاج مساحة عمل.' }],
  ['osint', 'preview', { en: 'OSINT modules', ar: 'وحدات OSINT' }, { en: 'UI only; queries must run server-side with logging and rate limits.', ar: 'واجهة فقط؛ الاستعلامات يجب أن تعمل على الخادم مع تسجيل وحدود.' }],
  ['labs', 'preview', { en: 'Security labs', ar: 'المختبرات الأمنية' }, { en: 'Catalog UI only; labs need isolated lab networks.', ar: 'واجهة الكتالوج فقط؛ تحتاج شبكات مختبر معزولة.' }],
  ['auth', 'planned', { en: 'Authentication & sessions', ar: 'المصادقة والجلسات' }, { en: 'Designed in docs/ARCHITECTURE.md.', ar: 'مصمّمة في docs/ARCHITECTURE.md.' }],
  ['sandbox', 'planned', { en: 'Isolated Linux environments (Firecracker)', ar: 'بيئات Linux معزولة (Firecracker)' }, { en: 'Designed; not implemented or tested. Needs KVM hosts.', ar: 'مصمّمة؛ غير منفّذة ولا مختبرة. تحتاج خوادم تدعم KVM.' }],
  ['files', 'planned', { en: 'Files & persistent volumes', ar: 'الملفات والتخزين الدائم' }, { en: 'Depends on sandbox.', ar: 'يعتمد على البيئات المعزولة.' }],
  ['ai', 'planned', { en: 'AI assistant gateway', ar: 'بوابة المساعد الذكي' }, { en: 'Server-side only; keys never in the browser.', ar: 'على الخادم فقط؛ المفاتيح لا تكون في المتصفح.' }],
  ['admin', 'planned', { en: 'Admin, quotas, audit log, monitoring', ar: 'الإدارة والحصص وسجل التدقيق والمراقبة' }, { en: 'UI skeleton exists; data needs the API.', ar: 'هيكل الواجهة موجود؛ البيانات تحتاج الـ API.' }],
];
