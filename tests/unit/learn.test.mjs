import test from 'node:test';
import assert from 'node:assert/strict';
import { createPractice, executePractice, LESSONS } from '../../assets/js/learn/practice.js';
import { learn } from '../../assets/js/views/learn.js';
import { setLang } from '../../assets/js/core/i18n.js';

test('six Linux practice lessons can be completed without backend or Linux', () => {
  const state = createPractice();
  const commands = ['pwd', 'ls', 'cd projects', 'cat hello.txt', 'mkdir lab', 'touch test.txt'];
  for (const command of commands) {
    const result = executePractice(state, command);
    assert.equal(result.ok, true, command + ': ' + result.output);
  }
  assert.equal(LESSONS.length, 6);
  assert.deepEqual(state.completed, LESSONS.map((lesson) => lesson.id));
  assert.equal(state.cwd, '/home/student/projects');
  assert.equal(state.files['/home/student/projects/lab'].type, 'dir');
  assert.equal(state.files['/home/student/projects/test.txt'].type, 'file');
});

test('practice sandbox cannot leave home, execute shell operators or host commands', () => {
  const state = createPractice();
  for (const command of ['cd /etc', 'cat ../../etc/passwd', 'ls /home', 'echo test > file', 'pwd; whoami', 'ls | cat', '$(whoami)', 'sudo whoami', 'curl https://example.org', 'rm -rf /']) {
    const result = executePractice(state, command);
    assert.equal(result.ok, false, command);
  }
  assert.equal(state.cwd, '/home/student');
  assert.equal(Object.keys(state.files).length, 5);
});

test('practice supports limited navigation and reset without persisting shell secrets', () => {
  const state = createPractice();
  assert.equal(executePractice(state, 'cd projects').ok, true);
  assert.equal(executePractice(state, 'cd ..').ok, true);
  assert.equal(state.cwd, '/home/student');
  assert.equal(executePractice(state, 'cat README.txt').ok, true);
  assert.equal(executePractice(state, 'mkdir notes').ok, false);
  assert.equal(executePractice(state, 'clear').clear, true);
  const reset = createPractice();
  assert.deepEqual(reset.completed, []);
  assert.equal(reset.cwd, '/home/student');
});

test('Academy renders a visible practice-only notice in both languages', () => {
  for (const locale of ['ar', 'en']) {
    setLang(locale);
    const rendered = learn.render();
    assert.match(rendered, /CORNOD/);
    assert.match(rendered, /learn-form/);
    assert.match(rendered, /learn-lessons/);
    assert.match(rendered, locale === 'ar' ? /محاكاة تعليمية/ : /Learning simulation/);
    assert.doesNotMatch(rendered, /<script|onerror=|onclick=/i);
  }
  setLang('ar');
});
