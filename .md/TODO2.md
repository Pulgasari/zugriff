# TODO2

- [ ] create `.shared/js/components/ActionMenu.js` nach dem vorbild von `ContextMenu.js` damit fortan so nachfolgender messy code vergangenheit ist:
```javascript
<div class="ed-actions">
            <button class="btn primary" onClick=${() => player.play(episode)}>
              <${Icon} name=${isPlaying ? 'mdi:pause' : 'mdi:play'} />
              ${isPlaying ? 'Pause' : st.position && !st.done ? 'Resume' : 'Play'}
            </button>
            <${IconButton} icon=${st.saved ? 'mdi:bookmark' : 'mdi:bookmark-outline'}
                        label=${st.saved ? 'Remove from list' : 'Save for later'}
                        active=${st.saved} size=${20} onClick=${() => db.toggleSaved(id)} />
            <${IconButton} icon=${st.done ? 'mdi:check-circle' : 'mdi:check-circle-outline'}
                        label=${st.done ? 'Mark unplayed' : 'Mark as done'}
                        active=${st.done} size=${20} onClick=${() => db.toggleDone(id)} />
            ${episode.link && html`<a class="btn ghost" href=${episode.link} target="_blank" rel="noopener">
              <${Icon} name="mdi:open-in-new" /> Episode page</a>`}
          </div>
```

- [ ] create `./shared/js/components/View.js' als rahmen für die views der apps

Du fängst wieder an den alten messy dreck zu reproduzieren.
du triffst falsche annahmen. Und du scheisst wieder den code mit sinnlosen kommentaren voll.

ich finde den aktuellen code so schlimm, weil überall unnötig komplex ist, deswegeb refactore ich.

und so n scheiss wie "primary button" schaff ich ab
dieses icon only​ is völlig sinnlos. Wenns icon obly sein soll lässt man halt label weg.
