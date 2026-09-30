# files

A file manager over a folder from your **own disk**. You grant one folder with
the File System Access API and it becomes the root. Nothing is uploaded and
nothing is copied, only the directory handle is kept, so a returning visit just
asks for permission again.

## views

| view       | route        | what it is |
|------------|--------------|------------|
| `library`  | `#/`         | the folder: breadcrumb, filter, grid or list, folders open in place |
| `preview`  | `#/preview`  | one file: type, size, an image inline, download. a sketch for now |
| `settings` | `#/settings` | the shared settings (palette, skin, geometry, density, font), how entries open, the folder |

The views are `<app-view>`s in an `<app-root routing="hash">` (`@aufbau/components`),
so the address is the state and back and forward work. The dock switches them.

## opening entries

`Settings → Open with`:

- `auto` (default): a tap on touch screens, a double click with a mouse
- `a tap`: one click opens
- `a double click`: one click selects, a double click or Enter opens

## how it's built

| file            | what it is |
|-----------------|------------|
| `app.js`        | the app: state, the three views, the dock |
| `modules/db.js` | the one granted folder handle (`@bunker/db`) and the permission dance |
| `app.css`       | the frame layout and the look of an entry, the rest is aufbau's |

Built from `app-root`, `app-view`, `div-x`, `div-y`, `input-search`
(`@aufbau/components`) and `aufbau-index`, `aufbau-item`, `aufbau-crumbs`,
`aufbau-picker` (`@aufbau/elements`). The listing follows the folder, its
permission and the path by itself (`effect`).

The former explorer (`FileExplorer`, `explorer.css`) stays in `.shared` for the
other apps that embed it.
