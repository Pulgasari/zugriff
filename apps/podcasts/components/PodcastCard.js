function PodcastCard ({ podcast }) {
  const eps  = db.episodesByPodcast.value[podcast.id] ?? [];
  return html`
    <button class="pc-card" onClick=${() => go('podcast', podcast.id)}>
      <${Art} src=${podcast.image} size=${160} className="pc-art" />
      <div class="pc-title">${podcast.title}</div>
      <div class="pc-sub">${eps.length} episode${eps.length === 1 ? '' : 's'} · ${fmtDate(podcast.lastEpisodeAt)}</div>
    </button>`;
}

export default PodcastCard;
