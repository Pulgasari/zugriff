// .shared/js/modules/fmt.js

function fmt ({ date, duration } = {}) {
  if (date     !== undefined && date     !== null) return fmt.date(date);
  if (duration !== undefined && duration !== null) return fmt.duration(duration);
  return '';
}

// Formats a timestamp or Date object into a relative or formatted date string
fmt.date = function (ms) {
  if (!ms) return '';
  
  const timestamp = ms instanceof Date ? ms.getTime() : Number(ms);
  if (isNaN(timestamp)) return '';

  /*
  const diffInDays = (Date.now() - timestamp) / 86400000;
  if (diffInDays < 0) return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });      
  if (diffInDays < 1) return 'today';
  if (diffInDays < 2) return 'yesterday';
  if (diffInDays < 7) return `${Math.floor(diffInDays)} days ago`;
  */
  
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Formats seconds into a duration string (e.g. "1:30" or "1:02:03")
fmt.duration = function (sec) {
  if (sec === null || sec === undefined || isNaN(sec) || sec < 0) return '';
  
  const totalSeconds = Math.round(sec);
  const h  = Math.floor(totalSeconds / 3600);
  const m  = Math.floor((totalSeconds % 3600) / 60);
  const s  = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

export default fmt;
