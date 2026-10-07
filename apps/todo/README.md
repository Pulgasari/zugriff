# todo

web: <https://zugriff.dev/todo/>

Tasks for one person, offline. A task is typed in one line and read while it
is typed: `call anna tomorrow 9:00 #family !2 every week +home` becomes the
title `call anna`, due tomorrow at 9, tagged, priority 2, weekly, in the list
`home`. What was read shows as chips under the field, a chip removed keeps its
words in the title. English is always understood, German too, weekday names in
the language of the page.

## features

- **views**: today (overdue, today, high priority without a date), upcoming
  (by day, four weeks, then later), someday, a list, a tag, done, search
- **swipe** a row right to tick it, left to delete it, both with an undo in
  the toast. delete or backspace on a focused row deletes as well
- **editor** in the context area: title, due day and time, repeat, a reminder,
  priority, list, tags, notes in markdown, subtasks
- **repeat**: every n days, weeks, months, years, on weekdays, from the due
  date or from when it was done. ticking makes the next one, subtasks included
- **reminders**: notifications while the app is open, what was missed at the
  next start. in the android app the local notifications plugin
- **sync**: a `todo.json` in a granted folder or on a webdav server, merged
  task by task by `changed`, a deleted task travels as a tombstone
- **export and import**: json, and todo.txt
- **keys**: `n` new, `/` search, `t` today, `u` upcoming, `x` tick, `e` edit,
  `escape` close, `ctrl + z` undo

## files

| file                    | what it is |
|-------------------------|------------|
| `app.js`                | the frame, the views and their groups, actions and keys |
| `components/Task.js`    | a row, a group of rows, the add field with its chips |
| `components/Editor.js`  | the task in the context area |
| `components/Config.js`  | settings: shared fields, sync, reminders, export and import |
| `modules/parse.js`      | one line of text to a task |
| `modules/dates.js`      | days as local strings, the next due of a repeat, labels |
| `modules/store.js`      | tasks and lists in `@bunker/db` and as signals, undo, todo.txt |
| `modules/sync.js`       | the json file in a folder or on webdav |
| `modules/reminders.js`  | notifications, browser and android |
| `modules/frame.js`      | the handles of the `app-root`, what the views share |

## open

- sorting a list by hand (`sortable`): the dom order it changes fights with
  preact's, needs a keyed bridge first
- the markdown bridge to `apps/notes`, a calendar view, several lists per task
