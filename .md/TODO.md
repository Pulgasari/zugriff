# todo

## apps (allgemein)

- [x] `app.html` mit `index.html` vereinigen (zu `index.htnl`) + `vercel.json` dementsprechend anpassen
- [x] in `index.html` bzw `.shared/js/boot.js` die starttransition solider und nicer machen (ich denke sollte smoother sein, nix mit layoutshifting sondern eher so chilliges einblenden)
- [ ] alle apps in `/apps` aufs neue muster der runtime, imports, module, components/views usw umstellen

## apps (builds)

- [ ] signatur von `autopack: true` bzw. `capacitor: true` in `.shared/js/data/apps.js` ändern zu `build: { android: 'capacitor' }` bzw. `build: { android: 'bubblewrap' }`
- [ ] generell mal kontrollieren, ob das aktuell überhaupt gebuildet wird. ich kanns zumindest nirgendwo ne apk finden. (finde das eh unübersichtlich. könnnen die apks nich irgendwo direkt gesammelt landen?)
- [ ] dieses secret-key bzgl. app-signing einrichten (ich weiss nicht wie?)
- [ ] ich bekam soeben diese info: `Splash Screen & App Launch: Reine PWAs nutzen den Chromium-Standard-Splashscreen. Capacitor nutzt die native Android 12+ SplashScreen API für kantenlose Übergänge ohne Ladeverzögerung.`. was lässt sich damit so anstellen? nicer ladescreen?

## service worker (`.shared/js/service.js`)
- [ ] sollte auch zeug von `https://code.pulgasari.dev/*` cachen (staleWhileRevalidate, ist in entwicklung, verändert sich öfters)
- [ ] sollte zeug von `esm.sh` und co dauerhaft/aggressiv cachen (quasi nur erneuern wenn version höher, aber konkrete version is unveränderlich)
