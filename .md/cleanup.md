# cleanup

## buttons

```javascript
<${Button} class='back' onClick=${() => go('latest')} icon='arrow-left' />
<button class="back" onClick=${() => go('latest')}><${Icon} name="mdi:arrow-left" /> Back</button>

<button class="fe-btn small" onClick=${chooseFolder}>
  <${Icon} name="mdi:folder-swap-outline" /> Change
</button>
<button class="fe-btn small ghost" onClick=${closeFolder}>
  <${Icon} name="close" /> Close
</button>
```

## `IconButton`

viele apps bauen ne eigene `IconBtn` component. in `zugriff/.shared/js/components/IconButton.js` liegt bereits ne fertige. daher sollten diese überall verwendet werden.

## toasts

viele apps bauen ne eigene toasts-logik. fortan hängt an de globalen runtime (muss nicht extra importiert werden) direkt ein toast-system, das getriggert werden kann.

```javascript
zugriff.toast.error('...');
zugriff.toast.success('...');
```


## app wrapper

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

vermutlich wärs hier sinnvoll generell mal in den importmaps von `zugriff/.shared/js/boot.js` und `pulgasari.github.io/importmap.js` (ich mein das repo) auf diese `htm/preact` (glabe so heisst das) umzustellen, dass diese `<>...</>` syntax unterstützt.

## aufbau/elements

in `aufbau/elements` finden sich viele nützliche webcomponents, von denen hier mal gebrauch gemacht werden kann.

- `<aufbau-reader>`
- `<aufbau-tree>`

und bestimmt auch noch andere. 

evtl. wäre die eineoder andere aufbau-wc auch noch etwas sinnvoll und generisch zu erweitern.

##

```javascript
import { boot, config }  from '/.shared/js/app.js?slug=files';
import { Icon, FileExplorer, AppSettings } from '/.shared/js/components/index.js';
import * as fs   from '/.shared/js/filesystem/fsaccess.js';
import * as pwa  from '/.shared/js/lib/pwa.js';
```

```javascript
const { AppSettings, FileExplorer, Icon } = zugriff.components;

zugriff.fs
zugriff.app.boot
zugriff.app.config
```
