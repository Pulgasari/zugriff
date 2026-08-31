# cleanup

ich will in `zugriff/apps` mal gründlich aufräumen. ich hab bissl chaotisch notiert hier. lies dir hier erstmal gründlich durch, fokus auf was ich im sinn habe, danndie ganzen genannten stellen udn verzeicznisse usw gründlich untersuchen, dann plan, dann feuer frei!

## buttons

```javascript
// aktuell oft:
<button class="back" onClick=${() => go('latest')}>
  <${Icon} name="mdi:arrow-left" /> Back
</button>

// besser
<${Button} class='back' icon='arrow-left' label='Back' onClick=${() => go('latest')} />
```

### `IconButton`

viele apps bauen ne eigene `IconBtn` component. in `zugriff/.shared/js/components/IconButton.js` liegt bereits ne fertige. daher sollten diese überall verwendet werden.

### ausserdem:

in `.shared/js/data/icons.js` ist schon ne liste mit standard-icons, dessen namen verwendet werden sollen möglichst. und die liste kann gern erweitert werden. wird von `.shared/js/components/Icon.js` verstanden.

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

- `<aufbau-index>`
- `<aufbau-input>` (hatzb direkt ne variante für search inputs)
- `<aufbau-progress>`
- `<aufbau-reader>`
- `<aufbau-toc>`
- `<aufbau-tree>`

und bestimmt auch noch andere. 

evtl. wäre die eineoder andere aufbau-wc auch noch etwas sinnvoll und generisch zu erweitern.

## weitere components:

ich finde ausserdem wiederholt `Empty` components, die in mehreren apps reproduziert werden.

## imports

sowas is mir alles viel zu chaotisch.

```javascript
import { boot, config }  from '/.shared/js/app.js?slug=files';
import { Icon, FileExplorer, AppSettings } from '/.shared/js/components/index.js';
import * as fs   from '/.shared/js/filesystem/fsaccess.js';
import * as pwa  from '/.shared/js/lib/pwa.js';
```

da vieles von dem zeug eh überall notwendig ist, habe ich angefangen in `.shared/js/runtime.js` zu konstruieren und denk mir dass das langfristtig sehr viel sauberer und einfacher machen wird.

```javascript
const { AppSettings, FileExplorer, Icon } = zugriff.components;

zugriff.fs
zugriff.app.boot
zugriff.app.config
```
