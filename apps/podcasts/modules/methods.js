// apps/podcasts/modules/methods.js
// pure view helpers — formatting, html→text and the episode/podcast list transforms.
// the filter reads the shared search query + podcast lookup through the zugriff.app
// global (app.ui.search, app.db.podcastById), so call sites stay filterEpisodes(list).

export function fmtDuration (sec) {
  if (!sec || sec < 0) return '';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDate (ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const diff = (Date.now() - ms) / 86400000;
  if (diff < 1)  return 'today';
  if (diff < 2)  return 'yesterday';
  if (diff < 7)  return `${Math.floor(diff)} days ago`;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// strip html from a feed description for a one-line teaser
export function plain (htmlStr = '') {
  const el = document.createElement('div');
  el.innerHTML = htmlStr;
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

// a feed description as readable paragraphs — block tags become breaks, then the
// text is taken via textContent, so nothing from the feed's markup is executed
export function paragraphs (htmlStr = '') {
  const el = document.createElement('div');
  el.innerHTML = String(htmlStr)
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return (el.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n\n')
    .map(s => s.trim())
    .filter(Boolean);
}

// filter an episode list by the shared search query; `withPodcast` also matches on the
// podcast title, for the mixed "latest" stream
export function filterEpisodes (list, withPodcast = false) {
  const { ui, db } = zugriff.app;
  const q = ui.search.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(ep =>
    ep.title.toLowerCase().includes(q) ||
    (withPodcast && db.podcastById.value[ep.podcastId]?.title.toLowerCase().includes(q)));
}

export const sortEpisodes = (list, mode) => [...list].sort((a, b) =>
    mode === 'oldest' ? (a.pubDate || 0) - (b.pubDate || 0)
  : mode === 'alpha'  ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  :                     (b.pubDate || 0) - (a.pubDate || 0));

export const sortPodcasts = (list, mode) => [...list].sort((a, b) =>
    mode === 'alpha' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  :                    (b.lastEpisodeAt || 0) - (a.lastEpisodeAt || 0));
