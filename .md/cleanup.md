# cleanup

## buttons

```javascript
<${Button} class='back' onClick=${() => go('latest')} icon='arrow-left' />
<button class="back" onClick=${() => go('latest')}><${Icon} name="mdi:arrow-left" /> Back</button>
```

##

viele apps bauen ne eigene `IconBtn` component. in `zugriff/.shared/js/components/IconButton.js` liegt bereits ne fertige. daher sollten diese überall verwendet werden.

## toasts

viele apps bauen ne eigene toasts-logik. fortan hängt an de globalen runtime (muss nicht extra importiert werden) direkt ein toast-system, das getriggert werden kann.

```javascript
zugriff.toast.error('...');
zugriff.toast.success('...');
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
