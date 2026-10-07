// todo :: components/Task.js
// a task as a row, the field that adds one and a titled group of rows.
//
// a row swiped right is ticked, swiped left deleted, both with an undo in a
// toast. delete or backspace on a focused row deletes it as well.

import { dismissable }                                    from '@aufbau/gestures';
import { useEffect, useMemo, useRef, useState }           from 'preact/hooks';

import { dayLabel, dayOf, dueDay, dueLabel, repeatLabel } from '../modules/dates.js';
import { edit, selected }                                 from '../modules/frame.js';
import { parse }                                          from '../modules/parse.js';
import * as store                                         from '../modules/store.js';

const app  = zugriff.app;

// :::::: UNDO ::::::::::::::::::::::::::::::::::::::::::::::::

// a toast with an undo button, its message the children of <pop-toast>
export function undoToast (text) {
  const toast  = app.toast({ message: '', duration: 5000 });
  const label  = Object.assign(document.createElement('span'), { textContent: text + ' ' });
  const button = Object.assign(document.createElement('button'), { className: 'undo', textContent: 'undo', type: 'button' });
  button.addEventListener('click', async () => { await store.undo(); toast.dismiss?.(); });
  toast.append(label, button);
}

export async function tickTask (id) {
  const task = store.get(id);
  const next = await store.tick(id);
  if (!task.done) undoToast(next && next.id !== id ? `done, next ${dueLabel(next.due)}` : 'done');
}

export async function removeTask (id) {
  if (selected.peek() === id) selected.value = null;
  await store.remove(id);
  undoToast('deleted');
}

// :::::: ROW :::::::::::::::::::::::::::::::::::::::::::::::::

// a pan that moved the row is no click on it
function useSwipe (id) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let moved = false;

    const handle = dismissable(node, {
      directions : ['left', 'right'],
      onDismiss  : async ({ direction }) => {
        await (direction === 'right' ? tickTask(id) : removeTask(id));
        requestAnimationFrame(() => { if (node.isConnected) handle.reset(); });
      },
      onMove     : ({ offset }) => { if (Math.abs(offset) > 8) moved = true; },
    });

    const down  = () => { moved = false; };
    const click = event => { if (moved) { event.stopPropagation(); event.preventDefault(); moved = false; } };
    node.addEventListener('pointerdown', down, true);
    node.addEventListener('click', click, true);

    return () => {
      handle.destroy();
      node.removeEventListener('pointerdown', down, true);
      node.removeEventListener('click', click, true);
    };
  }, [id]);
  return ref;
}

function Meta ({ task }) {
  const listName = task.list !== store.INBOX && store.lists.value.find(list => list.id === task.list)?.name;
  const subtasks = store.tasks.value.filter(item => item.parent === task.id);
  const overdue  = !task.done && task.due && dueDay(task.due) < dayOf();

  const parts = [
    task.due        && html`<span class=${overdue ? 'due overdue' : 'due'}><svg-icon icon='lucide:calendar' />${dueLabel(task.due)}</span>`,
    task.repeat     && html`<span title=${repeatLabel(task.repeat)}><svg-icon icon='lucide:repeat' /></span>`,
    task.remind     && html`<span><svg-icon icon='lucide:bell' /></span>`,
    task.notes      && html`<span><svg-icon icon='lucide:sticky-note' /></span>`,
    subtasks.length && html`<span><svg-icon icon='lucide:list-checks' />${subtasks.filter(item => item.done).length}/${subtasks.length}</span>`,
    listName        && html`<span class='list'>${listName}</span>`,
    ...task.tags.map(name => html`<span class='tag'>#${name}</span>`),
  ].filter(Boolean);

  return parts.length ? html`<span class='meta'>${parts}</span>` : null;
}

export function TaskRow ({ task }) {
  const ref = useSwipe(task.id);
  return html`
    <div ref=${ref} class='task' data-priority=${task.priority || null} data-done=${task.done ? '' : null} aria-current=${selected.value === task.id ? 'true' : null}>
      <button class='check' type='button' aria-pressed=${task.done ? 'true' : 'false'} aria-label=${task.done ? 'reopen' : 'tick'} onClick=${() => tickTask(task.id)}>
        <svg-icon icon=${task.done ? 'lucide:circle-check' : 'lucide:circle'} />
      </button>
      <button class='body' type='button' onClick=${() => edit(task.id)}>
        <span class='title'>${task.title}</span>
        <${Meta} task=${task} />
      </button>
    </div>
  `;
}

export function Section ({ title, tasks, empty, collapsed = false }) {
  const [open, setOpen] = useState(!collapsed);
  if (!tasks.length && !empty) return null;
  return html`
    <section class='group'>
      ${title && html`<h3><button type='button' onClick=${() => setOpen(!open)}>${title}<span class='count'>${tasks.length || ''}</span></button></h3>`}
      ${open && (tasks.length ? tasks.map(task => html`<${TaskRow} key=${task.id} task=${task} />`) : html`<p class='hint'>${empty}</p>`)}
    </section>
  `;
}

// :::::: ADD :::::::::::::::::::::::::::::::::::::::::::::::::

// one line, read while it is typed. what was read shows as chips, a chip
// removed gives its words back to the title. `defaults` fill what the line
// does not say: the list of a list view, today in the today view
export function AddBar ({ defaults = {}, placeholder = 'add a task, e.g. call anna tomorrow 9:00 #family !2' }) {
  const [text, setText]     = useState('');
  const [ignore, setIgnore] = useState([]);
  const parsed = useMemo(() => parse(text, { ignore }), [text, ignore]);

  async function submit (event) {
    event.preventDefault();
    if (!parsed.title.trim()) return;
    const extra = {};
    if (defaults.list && !parsed.list) extra.list = defaults.list;
    if (defaults.tag)                  parsed.tags.push(defaults.tag);
    if (defaults.due && !parsed.due && !parsed.someday) parsed.due = defaults.due;
    await store.add(parsed, extra);
    setText('');
    setIgnore([]);
  }

  return html`
    <form class='add' onSubmit=${submit}>
      <div class='add-field'>
        <svg-icon icon='lucide:plus' />
        <input id='todo-add' type='text' enterkeyhint='done' autocomplete='off' placeholder=${placeholder}
               value=${text} onInput=${event => setText(event.currentTarget.value)} />
      </div>
      ${parsed.tokens.length > 0 && html`
        <div class='chips'>
          ${parsed.tokens.map(token => html`
            <button type='button' class='chip' data-kind=${token.kind} title='keep as text' onClick=${() => setIgnore([...ignore, token.text])}>
              ${token.kind === 'date' && parsed.due ? dayLabel(dueDay(parsed.due)) : token.label}<svg-icon icon='lucide:x' />
            </button>
          `)}
        </div>
      `}
    </form>
  `;
}

export default TaskRow;
