// .shared/js/modules/fmt.js

function fmt ({ date, duration }) {
  if (date)     return fmt.date     (date);
  if (duration) return fmt.duration (duration);
  return '';
}

fmt.date = function (sec) {
  if (!sec || sec < 0) return '';
  
  sec = Math.round(sec);
  
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}

fmt.duration = function (ms) {
  if (!ms) return '';
  
  const d = new Date(ms);
  const diff = (Date.now() - ms) / 86400000;
  
  if (diff < 1) return 'today';
  if (diff < 2) return 'yesterday';
  if (diff < 7) return `${Math.floor(diff)} days ago`;
  
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default fmt;
