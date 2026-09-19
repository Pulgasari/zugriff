// .shared/js/modules/fmt.js

function fmt (sth = {}) {
  if (date     in sth) return fmt.date     (sth.date);
  if (duration in sth) return fmt.duration (sth.duration);
  return '';
}

// Formats a timestamp or Date object into a relative or formatted date string
fmt.date = function (ms) {
  if (!ms) return '';
  
  const timestamp = ms instanceof Date ? ms.getTime() : Number(ms);
  return isNaN(timestamp) ? '' : new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  /*
  const timestamp = ms instanceof Date ? ms.getTime() : Number(ms);
  if (isNaN(timestamp)) return '';
  
  const diffInDays = (Date.now() - timestamp) / 86400000;
  if (diffInDays < 0) return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });      
  if (diffInDays < 1) return 'today';
  if (diffInDays < 2) return 'yesterday';
  if (diffInDays < 7) return `${Math.floor(diffInDays)} days ago`;

  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  */
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

// formats numbers with fixed decimals and separators (e.g. 12345.6 -> "12.345,60")
fmt.number = function (val, decimals = 2, locale = 'de-DE') {
  if (val == null || isNaN(val)) return '';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
};

// formats a decimal as a percentage (e.g. 0.15 -> "15%")
fmt.percent = function (value, decimals = 0) {
  return (value == null || isNaN(value)) ? ''
  : `${(value * 100).toFixed(decimals)}%`;
};

export default fmt;


