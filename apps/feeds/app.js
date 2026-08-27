// apps/feeds/app.js
//
// a feed reader that runs entirely on the device. subscriptions, entries and
// read-state live in IndexedDB via @bunker/db (db.js); feeds are fetched and
// parsed in the browser (feed.js), direct first and then through a CORS proxy
// the user sets in settings. reading means opening the original — nothing is
// embedded or reader-mode'd here.
//
// YouTube gets its own department: a channel url / @handle is resolved to its
// RSS feed, and those entries render as video cards in a separate section
// instead of article rows.

// :::::: IMPORTS :::::::::::::::::::::::::::::::::::::::::::

// ::: vendors
import { html, signal, computed, useEffect, useRef } from '@aufbau/kits/preact-htm';

// ::: shared
import { boot, config } from './../../shared/js/app.js?slug=feeds';
import { stored }       from './../../shared/js/lib/signals.js';
import { appGroup }     from './../../shared/js/lib/settings.js';
import {
  Icon,
  Image,
  SettingsGroups
} from './../../shared/js/components/index.js';

// ::: local
import * as db           from './db.js';
import { DEFAULT_PROXY } from './feed.js';

// :::::: SETTINGS + UI STATE :::::::::::::::::::::::::::::::

const proxy   = stored(DEFAULT_PROXY, 'feeds:proxy');
const route   = signal({ name: 'latest' });   // { name:'latest'|'youtube'|'feed', id? }
const dialog  = signal(null);                  // 'add' | 'settings' | null
const addVal  = signal('');
const navOpen = signal(false);                 // mobile drawer
const toast   = signal(null);                  // { text, kind }
const busy    = signal('');                    // a label while a long task runs

let toastTimer = null;
function flash (text, kind = 'ok') {
  toast.value = { text, kind };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.value = null, kind === 'err' ? 5000 : 2800);
}

const go = (name, id) => { route.value = { name, id }; navOpen.value = false; };

// :::::: DERIVED :::::::::::::::::::::::::::::::::::::::::::

const articleFeeds = computed(() => db.feeds.value.filter(f => f.kind !== 'youtube'));
const youtubeFeeds = computed(() => db.feeds.value.filter(f => f.kind === 'youtube'));

// the list + heading for whatever the route points at
const currentView = computed(() => {
  const r = route.value;
  if (r.name === 'youtube') return { title: 'YouTube', icon: 'mdi:youtube', kind: 'youtube', list: db.latestVideos.value };
  if (r.name === 'feed') {
    const f = db.feedById(r.id);
    if (!f) return { title: 'Gone', icon: 'mdi:rss', kind: 'feed', list: [] };
    return { title: f.title, icon: f.kind === 'youtube' ? 'mdi:youtube' : 'mdi:rss', kind: f.kind, list: db.itemsByFeed.value[f.id] || [], feed: f };
  }
  return { title: 'Latest', icon: 'mdi:playlist-star', kind: 'feed', list: db.latestArticles.value };
});

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

function fmtWhen (ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24)    return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7)     return `${d} d ago`;
  return new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const feedName = it => db.feedById(it.feedId)?.title || hostOf(it.link);

function openItem (it) {
  db.markRead(it.key);
  if (it.link) window.open(it.link, '_blank', 'noopener,noreferrer');
}

// :::::: ACTIONS :::::::::::::::::::::::::::::::::::::::::::

async function submitAdd () {
  const input = addVal.value.trim();
  if (!input) return;
  busy.value = 'Adding feed…';
  try {
    const rec = await db.addFeed(input, proxy.value);
    flash(`Added ${rec.title}`);
    addVal.value = '';
    dialog.value = null;
    go('feed', rec.id);
  } catch (err) {
    flash(err.message || String(err), 'err');
  } finally { busy.value = ''; }
}

async function refreshCurrent () {
  const r = route.value;
  busy.value = 'Refreshing…';
  try {
    if (r.name === 'feed' && r.id) {
      const n = await db.refresh(r.id, proxy.value);
      flash(n ? `${n} new` : 'up to date');
    } else {
      const n = await db.refreshAll(proxy.value, (d, t) => busy.value = `Refreshing ${d}/${t}…`);
      flash(n ? `${n} new` : 'up to date');
    }
  } catch (err) { flash(err.message || String(err), 'err'); }
  finally { busy.value = ''; }
}

async function removeFeed (f) {
  if (!confirm(`Unfollow “${f.title}”? Its stored entries are removed too.`)) return;
  if (route.value.id === f.id) go('latest');
  await db.removeFeed(f.id);
  flash('Unfollowed');
}

function markAllRead () {
  const list = currentView.value.list;
  db.markAllRead(list);
  flash(`Marked ${list.length} read`);
}

// :::::: SIDEBAR :::::::::::::::::::::::::::::::::::::::::::

function NavItem ({ name, id, icon, label, count }) {
  const r = route.value;
  const active = r.name === name && r.id === id;
  return html`
    <button class=${'nav-item' + (active ? ' active' : '')} onClick=${() => go(name, id)} title=${label}>
      <${Icon} name=${icon} />
      <span class="nav-label">${label}</span>
      ${count > 0 && html`<span class="nav-count">${count}</span>`}
    </button>`;
}

function FeedItem ({ feed: f }) {
  const list   = db.itemsByFeed.value[f.id] || [];
  const unread = db.unreadIn(list);
  const active = route.value.name === 'feed' && route.value.id === f.id;
  const spin   = db.refreshing.value[f.id];
  return html`
    <div class=${'feed-row' + (active ? ' active' : '')}>
      <button class="feed-open" onClick=${() => go('feed', f.id)} title=${f.title}>
        <span class="feed-ic">
          ${spin ? html`<${Icon} name="loading" />`
                 : f.image ? html`<img src=${f.image} alt="" loading="lazy" onError=${e => e.target.style.display = 'none'} />`
                           : html`<${Icon} name=${f.kind === 'youtube' ? 'youtube' : 'rss'} />`}
        </span>
        <span class="feed-name">${f.title}</span>
        ${f.error ? html`<${Icon} name="alert" className="feed-err" />`
                  : unread > 0 && html`<span class="nav-count">${unread}</span>`}
      </button>
      <button class="feed-x" title="Unfollow" onClick=${() => removeFeed(f)}>
        <${Icon} name="close" /></button>
    </div>`;
}

function Sidebar () {
  const arts = articleFeeds.value, tubes = youtubeFeeds.value;
  return html`
    <aside class=${'sidebar' + (navOpen.value ? ' open' : '')}>
      <div class="brand">
        <${Icon} name="rss"/> <span>Feeds</span>
        <button class="ibtn nav-close" aria-label="Close" onClick=${() => navOpen.value = false}>
          <${Icon} name="close"/></button>
      </div>

      <button class="add-btn" onClick=${() => { addVal.value = ''; dialog.value = 'add'; }}>
        <${Icon} name="plus" /> Add feed</button>

      <div class="nav-scroll">
        <div class="nav-group">
          <${NavItem} name="latest" icon="mdi:playlist-star" label="Latest"
                      count=${db.unreadIn(db.latestArticles.value)} />
          ${tubes.length > 0 && html`
            <${NavItem} name="youtube" icon="youtube" label="YouTube"
                        count=${db.unreadIn(db.latestVideos.value)} />`}
        </div>

        ${arts.length > 0 && html`
          <div class="nav-group">
            <div class="nav-title">Feeds</div>
            ${arts.map(f => html`<${FeedItem} key=${f.id} feed=${f} />`)}
          </div>`}

        ${tubes.length > 0 && html`
          <div class="nav-group">
            <div class="nav-title"><${Icon} name="youtube" /> YouTube</div>
            ${tubes.map(f => html`<${FeedItem} key=${f.id} feed=${f} />`)}
          </div>`}

        ${db.feeds.value.length === 0 && html`<p class="nav-hint">No feeds yet — add one above.</p>`}
      </div>

      <div class="side-foot">
        <button class="foot-btn" onClick=${refreshCurrent} disabled=${!!busy.value || !db.feeds.value.length}>
          <${Icon} name="refresh" /> Refresh</button>
        <button class="foot-btn" onClick=${() => dialog.value = 'settings'}>
          <${Icon} name="settings" /> Settings</button>
      </div>
    </aside>`;
}

// :::::: ITEM VIEWS ::::::::::::::::::::::::::::::::::::::::

function ArticleRow ({ item }) {
  const unread = !db.isRead(item.key);
  return html`
    <article class=${'post' + (unread ? '' : ' read')}>
      <span class=${'post-dot' + (unread ? ' on' : '')} aria-hidden="true"></span>
      <div class="post-body">
        <a class="post-title" href=${item.link} target="_blank" rel="noopener noreferrer"
           onClick=${() => db.markRead(item.key)}>${item.title}</a>
        <div class="post-meta">
          <span class="post-src">${feedName(item)}</span>
          <span class="dot">·</span>
          <time>${fmtWhen(item.pubDate)}</time>
        </div>
        ${item.summary && html`<p class="post-sum">${item.summary}</p>`}
      </div>
      ${item.image && html`<a class="post-thumb" href=${item.link} target="_blank" rel="noopener noreferrer"
           onClick=${() => db.markRead(item.key)}><img src=${item.image} alt="" loading="lazy"
           onError=${e => e.target.parentElement.style.display = 'none'} /></a>`}
    </article>`;
}

function VideoCard ({ item }) {
  const unread = !db.isRead(item.key);
  return html`
    <a class=${'vid' + (unread ? '' : ' read')} 
      href=${item.link} target="_blank" rel="noopener noreferrer"
      onClick=${() => db.markRead(item.key)}
      >
      <div class="vid-thumb">
        ${item.image
          ? html`<${Image} src=${item.image} />`
          : html`<div class="vid-noimg"><${Icon} name="youtube" size=${32} /></div>`}
        ${unread && html`<span class="vid-new">new</span>`}
      </div>
      <div class="vid-title">${item.title}</div>
      <div class="vid-meta">${feedName(item)} · ${fmtWhen(item.pubDate)}</div>
    </a>`;
}

function Body () {
  const v = currentView.value;

  if (!v.list.length) {
    const hasFeeds = db.feeds.value.length > 0;
    return html`
      <div class="empty">
        <${Icon} name=${hasFeeds ? 'mdi:check-all' : 'rss'} size=${56} />
        <p>${hasFeeds ? 'Nothing here yet — try Refresh.' : 'Follow a feed to see the latest here.'}</p>
        ${!hasFeeds && html`<button class="cta" onClick=${() => { addVal.value = ''; dialog.value = 'add'; }}>
          <${Icon} name="plus" /> Add your first feed</button>`}
      </div>`;
  }

  if (v.kind === 'youtube') return html`<div class="videos">${v.list.map(it => html`<${VideoCard} key=${it.key} item=${it} />`)}</div>`;

  return html`<div class="posts">${v.list.map(it => html`<${ArticleRow} key=${it.key} item=${it} />`)}</div>`;
}

function Header () {
  const v = currentView.value;
  return html`
    <header class="topbar">
      <button class="ibtn nav-toggle" aria-label="Menu" onClick=${() => navOpen.value = true}>
        <${Icon} name="menu" /></button>
      <${Icon} name=${v.icon} className="topbar-ic" />
      <h1 class="topbar-title" title=${v.title}>${v.title}</h1>
      ${v.feed?.link && html`<a class="ibtn" href=${v.feed.link} target="_blank" rel="noopener noreferrer" title="Open site">
        <${Icon} name="mdi:open-in-new" /></a>`}
      <span class="topbar-spacer"></span>
      ${busy.value && html`<span class="topbar-busy"><${Icon} name="loading" size=${14} /> ${busy.value}</span>`}
      ${v.list.length > 0 && html`
        <button class="ibtn" title="Mark all read" onClick=${markAllRead}>
          <${Icon} name="mdi:check-all" /></button>`}
      <button class="ibtn" title="Refresh" onClick=${refreshCurrent} disabled=${!!busy.value}>
        <${Icon} name="refresh" /></button>
    </header>`;
}

// :::::: DIALOGS :::::::::::::::::::::::::::::::::::::::::::

function AddDialog () {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      <div class="modal" role="dialog" aria-modal="true">
        <h2>Add a feed</h2>
        <p class="modal-hint">Paste a feed URL, a site URL, or a YouTube channel /
           <code>@handle</code> / video link — YouTube channels are resolved to their feed.</p>
        <input ref=${ref} class="modal-input" type="text" value=${addVal.value}
               placeholder="https://example.com/feed.xml"
               onInput=${e => addVal.value = e.target.value}
               onKeyDown=${e => { if (e.key === 'Enter') submitAdd(); }} />
        <div class="modal-actions">
          <button class="ghost" onClick=${() => dialog.value = null}>Cancel</button>
          <button class="primary" disabled=${!!busy.value} onClick=${submitAdd}>
            ${busy.value ? 'Adding…' : 'Add'}</button>
        </div>
      </div>
    </div>`;
}

function SettingsDialog () {
  const val = useRef(null);
  return html`
    <div class="scrim" onClick=${e => { if (e.target === e.currentTarget) dialog.value = null; }}>
      <div class="modal" role="dialog" aria-modal="true">
        <h2>Settings</h2>
        <label class="field">
          <span class="field-label">CORS proxy</span>
          <span class="field-hint">Most feeds block direct browser requests. Feeds are fetched
             directly first, then through this proxy. <code>{url}</code> is replaced with the feed
             URL. Clear it to use direct requests only.</span>
          <input ref=${val} class="modal-input" type="text" value=${proxy.value}
                 placeholder=${DEFAULT_PROXY} onInput=${e => proxy.value = e.target.value} />
          <div class="field-row">
            <button class="btn ghost small" onClick=${() => proxy.value = DEFAULT_PROXY}>Reset to default</button>
            <button class="btn ghost small" onClick=${() => proxy.value = ''}>Direct only</button>
          </div>
        </label>
        <${SettingsGroups} groups=${[appGroup]} />
        <div class="modal-actions">
          <button class="primary" onClick=${() => { dialog.value = null; flash('Settings saved'); }}>Done</button>
        </div>
      </div>
    </div>`;
}

function Toast () {
  const t = toast.value;
  if (!t) return null;
  return html`<div class="toasts"><div class=${'toast ' + t.kind}>${t.text}</div></div>`;
}

// :::::: APP :::::::::::::::::::::::::::::::::::::::::::::::

function App () {
  useEffect(() => {
    db.load().then(() => {
      // refresh feeds that haven't been fetched in a while, quietly, on load
      const stale = db.feeds.value.filter(f => Date.now() - (f.lastFetched || 0) > 10 * 60 * 1000);
      if (stale.length) db.refreshAll(proxy.value).catch(() => {});
    }).catch(err => flash('Could not open the library: ' + err.message, 'err'));
  }, []);

  if (!db.ready.value) return html`<div class="booting"><${Icon} name="svg-spinners:bars-scale-middle" size=${28} /></div>`;

  return html`
    <div class="rss-app">
      <${Sidebar} />
      ${navOpen.value && html`<div class="scrim-mobile" onClick=${() => navOpen.value = false}></div>`}
      <main class="main">
        <${Header} />
        <div class="body-scroll"><${Body} /></div>
      </main>
      ${dialog.value === 'add'      && html`<${AddDialog} />`}
      ${dialog.value === 'settings' && html`<${SettingsDialog} />`}
      <${Toast} />
    </div>`;
}

// :::::: BOOT ::::::::::::::::::::::::::::::::::::::::::::::

boot({ config, App });
