import { getLang, t } from '../core/i18n.js';
import { html, raw, pageHead, esc } from '../core/ui.js';
import { createPractice, executePractice, LESSONS } from '../learn/practice.js';

let progress = createPractice();
const isAr = () => getLang() === 'ar';
const tx = (ar, en) => isAr() ? ar : en;

function lessonCards() {
  return LESSONS.map((lesson, i) => {
    const done = progress.completed.includes(lesson.id);
    return html`<article class="card learn-lesson ${done ? 'learn-done' : ''}" data-lesson="${lesson.id}">
      <div class="meta mono">LESSON ${String(i+1).padStart(2,'0')} · ${done ? '✓' : '○'}</div>
      <h3>${tx(lesson.ar, lesson.en)}</h3>
      <p>${tx(lesson.detailAr, lesson.detailEn)}</p>
      <p class="meta">${tx(lesson.taskAr, lesson.taskEn)}</p>
      <code class="learn-hint" dir="ltr">${lesson.hint}</code>
    </article>`;
  }).join('');
}

export const learn = {
  render: () => html`${raw(pageHead('learn.title', 'learn.sub', 'live'))}
    <div class="notice" role="note"><strong>${t('learn.noticeTitle')}</strong><span>${t('learn.notice')}</span></div>
    <div class="learn-summary card">
      <div><div class="eyebrow">CORNOD ACADEMY / LEVEL 01</div>
        <h2>${t('learn.course')}</h2><p>${t('learn.intro')}</p></div>
      <div class="learn-score" id="learn-score" aria-live="polite">${progress.completed.length} / ${LESSONS.length}</div>
    </div>
    <div class="learn-layout">
      <section aria-label="${t('learn.terminalLabel')}">
        <div class="term learn-terminal">
          <div class="term-bar"><span>cornod@practice</span><span class="spacer"></span><span class="tag live">${t('learn.local')}</span></div>
          <div class="term-out" id="learn-output" role="log" aria-live="polite"></div>
          <form class="term-in" id="learn-form" autocomplete="off">
            <label class="ps1" for="learn-command">student:$</label>
            <input id="learn-command" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" aria-label="${t('learn.inputLabel')}" maxlength="256">
            <button class="btn sm primary" type="submit">${t('learn.run')}</button>
          </form>
        </div>
        <div class="toolbar mt-12">
          <button class="btn" id="learn-reset" type="button">${t('learn.reset')}</button>
          <span class="muted">${t('learn.progressNote')}</span>
        </div>
      </section>
      <section>
        <h2>${t('learn.exercises')}</h2>
        <div id="learn-lessons" class="grid">${raw(lessonCards())}</div>
      </section>
    </div>`,
  mount: (root) => {
    const out = root.querySelector('#learn-output');
    const input = root.querySelector('#learn-command');
    const lessonList = root.querySelector('#learn-lessons');
    const score = root.querySelector('#learn-score');
    const history = [];
    let pos = 0;
    function print(message, kind = 'out') {
      const el = document.createElement('div');
      el.className = 'term-line ' + kind;
      el.dir = 'auto';
      el.textContent = message;
      out.appendChild(el);
      // Keep only the last 120 lines to bound memory.
      while (out.children.length > 120) out.firstChild.remove();
      out.scrollTop = out.scrollHeight;
    }
    function refresh() {
      lessonList.innerHTML = lessonCards();
      score.textContent = progress.completed.length + ' / ' + LESSONS.length;
    }
    function run(event) {
      event.preventDefault();
      const command = input.value.trim();
      input.value = '';
      if (!command) return;
      history.push(command);
      if (history.length > 60) history.shift();
      pos = history.length;
      print('student:$ ' + command, 'in');
      const result = executePractice(progress, command);
      if (result.clear) out.textContent = '';
      else if (result.output) print(result.output, result.ok ? 'out' : 'err');
      if (result.completedLesson) {
        const lesson = LESSONS.find((l) => l.id === result.completedLesson);
        print('✓ ' + tx('أحسنت! أكملت: ' + lesson.ar, 'Great work! Completed: ' + lesson.en), 'sys');
        refresh();
      }
    }
    function keydown(e) {
      if (e.key === 'ArrowUp' && history.length) {
        e.preventDefault(); pos = Math.max(0, pos - 1); input.value = history[pos];
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault(); pos = Math.min(history.length, pos + 1); input.value = history[pos] ?? '';
      }
    }
    function reset() {
      progress = createPractice(); history.length = 0; pos = 0;
      out.textContent = '';
      print(tx('تمت إعادة بيئة التدريب إلى البداية.', 'Practice reset to the beginning.'), 'sys');
      refresh(); input.focus();
    }
    const form = root.querySelector('#learn-form');
    const resetButton = root.querySelector('#learn-reset');
    form.addEventListener('submit', run);
    input.addEventListener('keydown', keydown);
    resetButton.addEventListener('click', reset);
    print(tx('مرحبًا في CORNOD Academy. اكتب help ثم ابدأ الدرس الأول.', 'Welcome to CORNOD Academy. Type help and start lesson one.'), 'sys');
    return () => {
      form.removeEventListener('submit', run);
      input.removeEventListener('keydown', keydown);
      resetButton.removeEventListener('click', reset);
    };
  }
};
