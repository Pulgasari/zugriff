# apps

the zugriff apps, written in rat. `.shared/` holds what they have in common, `zugriff.config.js` the config every app spreads into its own.

---

## quicklinks

built (`www/`, `rat build`, the build workflow):
[cli](https://zugriff.dev/cli/) ·
[code](https://zugriff.dev/code/) ·
[downloader](https://zugriff.dev/downloader/) ·
[ebooks](https://zugriff.dev/ebooks/) ·
[feeds](https://zugriff.dev/feeds/) ·
[files](https://zugriff.dev/files/) ·
[icons](https://zugriff.dev/icons/) ·
[images](https://zugriff.dev/images/) ·
[looksmaxx](https://zugriff.dev/looksmaxx/) ·
[noisy](https://zugriff.dev/noisy/) ·
[notes](https://zugriff.dev/notes/) ·
[podcasts](https://zugriff.dev/podcasts/) ·
[prompts](https://zugriff.dev/prompts/) ·
[todo](https://zugriff.dev/todo/) ·
[tools](https://zugriff.dev/tools/) ·
[vectorizer](https://zugriff.dev/vectorizer/) ·
[videos](https://zugriff.dev/videos/)

sources (`apps/`, no build): they load rat from the checkout next to this repo (`../rat`). a view that mounts a component with the params of its route takes it as `component={X}`, not `src`: a build follows an import, not a string

**md:**
[`TODO.md`](TODO.md)
