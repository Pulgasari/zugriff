// todo :: components/Editor.js
// the task in the context area: every field writes on change, an undo takes
// the last change back. subtasks as a list below, with their own add field.

import { useState } from 'preact/hooks';

import { dueDay, dueTime, repeatLabel } from '../modules/dates.js';
import { closeEditor, selected }        from '../modules/frame.js';
import * as store                       from '../modules/store.js';
import { removeTask, TaskRow }          from './Task.js';


const PRIORITIES = [['0', 'none'], ['1', 'low'], ['2', 'medium'], ['3', 'high']];
const UNITS      = [['', 'never'], ['day', 'days'], ['week', 'weeks'], ['month', 'months'], ['year', 'years']];

const valueOf = event => event.currentTarget.value ?? '';

function Field ({ label, children }) {
  return html`<label class='field'><span>${label}</span>${children}</label>`;
}

function Subtasks ({ task }) {
  const [text, setText] = useState('');
  const subtasks = store.tasks.value.filter(item => item.parent === task.id).sort(store.byOrder);

  async function add (event) {
    event.preventDefault();
    if (!text.trim()) return;
    await store.add({ title: text.trim() }, { list: task.list, parent: task.id });
    setText('');
  }

  return html`
    <section class='subtasks'>
      <h4>subtasks</h4>
      ${subtasks.map(item => html`<${TaskRow} key=${item.id} task=${item} />`)}
      <form class='add' onSubmit=${add}>
        <div class='add-field'>
          <svg-icon icon='lucide:plus'></svg-icon>
          <input type='text' placeholder='add a subtask' value=${text} onInput=${event => setText(event.currentTarget.value)} />
        </div>
      </form>
    </section>
  `;
}

function Repeat ({ task, set }) {
  const repeat = task.repeat ?? {};
  const change = changes => {
    const next = { every: 1, from: 'due', on: null, ...repeat, ...changes };
    set({ repeat: next.unit ? next : null });
  };

  return html`
    <${Field} label='repeat'>
      <div class='row'>
        <input-number min='1' max='99' value=${String(repeat.every ?? 1)} onChange=${event => change({ every: Math.max(1, Number(valueOf(event)) || 1) })}></input-number>
        <input-value look='combobox' value=${repeat.unit ?? ''} onChange=${event => change({ unit: valueOf(event) || null, on: null })}>
          ${UNITS.map(([value, label]) => html`<input-option value=${value}>${label}</input-option>`)}
        </input-value>
      </div>
      ${task.repeat && html`
        <input-value look='segments' value=${repeat.from ?? 'due'} onChange=${event => change({ from: valueOf(event) })}>
          <input-option value='due'>from the due date</input-option>
          <input-option value='done'>from when done</input-option>
        </input-value>
        <small>${repeatLabel(task.repeat)}</small>
      `}
    <//>
  `;
}

export function Editor () {
  const task = store.tasks.value.find(item => item.id === selected.value);
  if (!task) return html`<app-panel heading='Task'><p class='hint'>Pick a task to edit it.</p></app-panel>`;

  const set  = changes => store.update(task.id, changes);
  const day  = dueDay(task.due) ?? '';
  const time = dueTime(task.due) ?? '';

  const setDue = (nextDay, nextTime) => set({ due: nextDay ? (nextTime ? `${nextDay}T${nextTime}` : nextDay) : null });

  // keyed by the task, so the fields are built anew for another one
  return html`
    <app-panel heading='Task' key=${task.id}>
      <div class='editor'>
        <${Field} label='title'>
          <input-text value=${task.title} onChange=${event => valueOf(event).trim() && set({ title: valueOf(event).trim() })}></input-text>
        <//>

        <div class='row'>
          <${Field} label='due'>
            <input-date value=${day} onChange=${event => setDue(valueOf(event), time)}></input-date>
          <//>
          <${Field} label='time'>
            <input-time value=${time} onChange=${event => setDue(day || store.today(), valueOf(event))}></input-time>
          <//>
        </div>

        <${Repeat} task=${task} set=${set} />

        <${Field} label='remind'>
          <input-datetime value=${task.remind ?? ''} onChange=${event => set({ remind: valueOf(event) || null })}></input-datetime>
        <//>

        <${Field} label='priority'>
          <input-value look='segments' value=${String(task.priority ?? 0)} onChange=${event => set({ priority: Number(valueOf(event)) || 0 })}>
            ${PRIORITIES.map(([value, label]) => html`<input-option value=${value}>${label}</input-option>`)}
          </input-value>
        <//>

        <${Field} label='list'>
          <input-value look='combobox' value=${task.list} onChange=${event => valueOf(event) && set({ list: valueOf(event) })}>
            ${store.lists.value.map(list => html`<input-option value=${list.id}>${list.name}</input-option>`)}
          </input-value>
        <//>

        <${Field} label='tags'>
          <input-chips value=${task.tags.join(',')} suggestions=${store.tags.value.join(', ')}
                       onChange=${event => set({ tags: [...new Set(event.currentTarget.values.map(name => name.toLowerCase()))] })}></input-chips>
        <//>

        <${Field} label='notes'>
          <write-md value=${task.notes} placeholder='notes, markdown' onChange=${event => set({ notes: valueOf(event) })}></write-md>
        <//>

        ${!task.parent && html`<${Subtasks} task=${task} />`}

        <div class='actions'>
          <btn-push icon='lucide:trash-2' label='delete' onClick=${() => { removeTask(task.id); closeEditor(); }} />
          <btn-push icon='lucide:check' label='close' onClick=${closeEditor} />
        </div>
      </div>
    </app-panel>
  `;
}

export default Editor;
