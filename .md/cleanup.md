# cleanup

```javascript
<${Button} class='back' onClick=${() => go('latest')} icon='arrow-left' />
<button class="back" onClick=${() => go('latest')}><${Icon} name="mdi:arrow-left" /> Back</button>
```

## 

die apps wrappen sich selbst komplett sinnlos selbst innerhalb von `#app` und obendrein noch als eigener class-name. zum beispiel:

```html
<div id='app'>
  <div class=''pc-app'>
    <div class='pc-body'>...</div>
  </div>
</div>
```

das soll sein:

```html
<div id='app'>
  <div id='app-main'>...</div>
</div>
```
