# fs — doppelfassade (skizze)

> status: **skizze zum weiterzeichnen**. kein spec, keine implementierung. nur
> interface-form + begründung + offene fragen.

## problem

die apps laufen **hauptsächlich als android-app (capacitor)**, aber auch im browser.
darunter liegen zwei plattform-apis mit grundverschiedener form:

- **browser** — File System Access: **handle-objekte** (stateful cursor). der standard.
  aber `showDirectoryPicker` fehlt im android-webview.
- **capacitor** — `@capacitor/filesystem` + `@capawesome/…/file-picker`: **flache
  funktionen über pfad-/uri-strings**. es gibt keine handles.

der springende punkt: in **einer** nativen session leben **beide** repräsentationen
gleichzeitig —

- opfs  → echte browser-handles (der webview ist chromium)
- gewährter SAF-ordner → `content://`-uris

→ die frage "welche repräsentation" ist **pro objekt, nicht pro plattform**. ein
per-`isNative()`-switch kann das nicht bedienen.

## idee

statt eine plattform-form der anderen aufzuzwingen (der heutige `CapDirHandle`-shim
tut so, als *wäre* eine uri ein handle): jede op **dispatcht auf einen getaggten,
self-contained locator**. kein shim — handles bleiben handles, uris bleiben uris.
die dispatch-tabelle *ist* der adapter.

## der locator (`ref`)

```js
// ein ref ist immer vollständig und trägt sein eigenes tag.
// wird IMMER am rand normalisiert (beim picken/scannen); im inneren
// fliegt nie ein nackter string herum.
ref = { kind: 'handle', handle }   // echtes FileSystemHandle (browser-grant ODER opfs)
    | { kind: 'uri',    uri }       // capacitor content:// uri

const isHandle = r => r?.kind === 'handle';
const isUri    = r => r?.kind === 'uri';
```

- handle-ref = self-contained. uri-ref = self-contained (absolute uri).
- ein **relativer pfad allein ist kein ref** (er braucht immer eine wurzel).

## drei predikat-achsen — getrennt halten

```
plattform :  isSupported()          // kann diese umgebung überhaupt picken?
ding-art  :  isDir(ref) / isFile(ref)
ref-art   :  isHandle(ref) / isUri(ref)
```

(im heutigen entwurf steckten die drei unsortiert in einem `fs.is*` — das liest
sich, als wären sie dieselbe sorte. sind sie nicht.)

## api-oberfläche

```
-- picken (liefert immer normalisierte refs) --
pickDir()                    -> ref
pickFile()                   -> ref

-- read / enumerate (ref ist self-contained) --
read(ref)                    -> bytes | text
list(ref)                    -> [childRef, ...]
getMeta(ref)                 -> { size, mtime, type, ext, kind }
exists(ref)                  -> bool

-- mutate (parent-scoped, siehe unten) --
create(parentRef, name, { kind })   // 'file' | 'dir'
write(ref, data)
delete(parentRef, name)
move(ref, newParentRef, newName)    // rename = move in denselben parent

-- persistenz eines refs (überlebt reload) --
toJSON(ref)                  -> serialisierbarer descriptor
fromJSON(descriptor)         -> ref
```

**read ist symmetrisch, write ist asymmetrisch.** grund:
- browser-mutation ist **parent-scoped** — es gibt kein `handle.delete()`; man löscht
  ein kind über `parent.removeEntry(name)`, erzeugt über `parent.getFileHandle(name,{create})`.
- capacitor-mutation ist **absolut** — `deleteFile({uri})`, `writeFile({uri})`.

deshalb nehmen mutations-ops `(parentRef, name)` statt eines einzelnen `ref`.

## dispatch-muster (kein shim)

```js
// beispiel delete — je op zwei zweige, direkt, ohne fake-handle
async function del (parent, name) {
  if (isHandle(parent)) return parent.handle.removeEntry(name, { recursive: true });
  if (isUri(parent))    return Filesystem().deleteFile({ path: joinUri(parent.uri, name) });
  throw new TypeError('unknown ref');
}
```

## op → plattform-mapping (referenz)

| op            | browser (handle-ref)                          | capacitor (uri-ref)                  |
|---------------|-----------------------------------------------|--------------------------------------|
| pickDir       | `showDirectoryPicker()`                       | `FilePicker.pickDirectory()`         |
| pickFile      | `showOpenFilePicker()`                        | `FilePicker.pickFiles()`             |
| list          | `dir.entries()` (async iterator)              | `Filesystem.readdir({path})`         |
| read          | `fh.getFile()` → Blob/text                    | `Filesystem.readFile({path})` (b64)  |
| getMeta       | `fh.getFile()` → File felder                  | `Filesystem.stat({path})`            |
| create file   | `parent.getFileHandle(name,{create})`         | `Filesystem.writeFile({path,data:''})` |
| create dir    | `parent.getDirectoryHandle(name,{create})`    | `Filesystem.mkdir({path})`           |
| write         | `fh.createWritable()` → write/close           | `Filesystem.writeFile({path,data})`  |
| delete        | `parent.removeEntry(name,{recursive})`        | `Filesystem.deleteFile / rmdir({path})` |
| move/rename   | **copy + delete** (kein move im interface)    | `Filesystem.rename({from,to})` (nativ!) |
| permission    | `handle.query/requestPermission({mode})`      | immer `granted` (SAF-grant persistiert) |
| same          | `handle.isSameEntry(other)`                   | `a.uri === b.uri`                    |
| persist ref   | handle (structured clone → idb) + re-permission | `{ uri }` descriptor               |
| usage/quota   | `navigator.storage.estimate()`                | dito (nur origin-storage/opfs; SAF hat kein quota) |

(schöne asymmetrie: **rename/copy** kann capacitor nativ, der browser nicht.)

## metadaten: EIN `getMeta`

```js
getMeta(ref) -> { size, mtime, type, ext, kind }   // ein getFile()/stat()
```

granulare getter (`getSize`, `getMimeType`, `lastModified`) sind **dünne ableitungen**
daraus — sonst macht jeder sein eigenes `getFile()`/`stat()`, also 3–4× i/o für
dasselbe. `getExt` ist reine string-arbeit, braucht **kein** i/o.

## bewusst NICHT in dieser ebene

- **kein `@aufbau/signals`.** die fassade ist reine io + dispatch, **zustandslos**.
  reaktiver state (die heutige `FolderLibrary` mit `sources`/`perms`/`scanning`) liegt
  als optionaler controller *darüber* — nicht in der io-ebene.
- keine ui, kein storage-schema, kein picker-lifecycle. nur "was tue ich mit einem ref".

## offene fragen (zum weiterzeichnen)

- **relative sub-pfade im browser**: trägt jeder scan-node sein child-handle (aus dem
  walk), oder `{ rootHandle, path[] }` + lazy auflösen? (heute: node trägt handle.)
- **write auf SAF**: eine *neue* datei unter einem `content://`-tree anzulegen ist
  best-effort (überschreiben ist zuverlässig). akzeptabel, oder braucht's mehr?
- **ref-persistenz**: teil der fassade (`toJSON`/`fromJSON`) oder außerhalb? uri ist
  trivial, handle braucht idb + re-permission beim nächsten start.
- **opfs**: läuft mit durch die fassade (als handle-ref) — passt, weil opfs eh welt-1
  ist. dann ist `zugriff.opfs` nur noch ein bequemer einstieg, kein sonderpfad.
- **naming/aufhängung**: `zugriff.fs.*`, dispatch pro call. ok so?
- **scan/tree + syncSource/MetaQueue**: bleiben eine ebene drüber (bauen auf `list`/
  `read`/`getMeta` der fassade auf), oder teil davon?

## bilanz

- **gewinn**: der fragilste brocken (der ~200-zeilen fake-handle-shim) fällt weg;
  keiner tut so als ob; der gemischte opfs+SAF-fall funktioniert von natur aus, weil
  pro-`ref` dispatcht wird.
- **kein gratis-lunch**: weiterhin zwei implementierungen pro verb (byHandle/byUri) —
  die arbeit verschwindet nicht, sie wird nur ehrlich verteilt statt in eine
  fake-klasse gepresst. der per-call-branch kostet praktisch nichts.
