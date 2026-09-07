// podcasts :: methods.js

function fmtDuration (sec) {
  if (!sec || sec < 0) return '';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate (ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const diff = (Date.now() - ms) / 86400000;
  if (diff < 1)  return 'today';
  if (diff < 2)  return 'yesterday';
  if (diff < 7)  return `${Math.floor(diff)} days ago`;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// strip html from a feed description for a one-line teaser
function plain (htmlStr = '') {
  const el = document.createElement('div');
  el.innerHTML = htmlStr;
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

// a feed description as readable paragraphs — block tags become breaks, then the
// text is taken via textContent, so nothing from the feed's markup is executed
function paragraphs (htmlStr = '') {
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


// filter an episode list by the shared search query; `withPodcast` also matches
// on the podcast title, for the mixed "latest" stream
function filterEpisodes (list, withPodcast = false) {
  const q = search.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(ep =>
    ep.title.toLowerCase().includes(q) ||
    (withPodcast && podcastById.value[ep.podcastId]?.title.toLowerCase().includes(q)));
}

const sortEpisodes = (list, mode) => [...list].sort((a, b) =>
  mode === 'oldest' ? (a.pubDate || 0) - (b.pubDate || 0)
  : mode === 'alpha' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  :                    (b.pubDate || 0) - (a.pubDate || 0));

const sortPodcasts = (list, mode) => [...list].sort((a, b) =>
  mode === 'alpha' ? a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  :                  (b.lastEpisodeAt || 0) - (a.lastEpisodeAt || 0));



const flash = (text, kind = 'ok') =>
  kind === 'err' ? zugriff.toast.error(text) : zugriff.toast.success(text);

// navigating always clears the current filter
const go = (name, id) => { route.value = { name, id }; search.value = ''; };

// :::::: HELPERS :::::::::::::::::::::::::::::::::::::::::::

const podcastById = computed(() => Object.fromEntries(db.podcasts.value.map(p => [p.id, p])));
const episodeById = computed(() => Object.fromEntries(db.episodes.value.map(e => [e.id, e])));


export { 
  fmtDate, fmtDuration, 
  plain, paragraphs,
  filterEpisodes, sortEpisodes, sortPodcasts,
};
