// .shared/js/modules/fmt.js

function fmt (sth = {}) {
  if (date     in sth) return fmt.date     (sth.date);
  if (duration in sth) return fmt.duration (sth.duration);
  if (number   in sth) return fmt.number   (sth.number);
  if (percent  in sth) return fmt.percent  (sth.percent);
  return '';
}

// Formats bytes into human-readable file sizes (e.g. 1048576 -> "1 MB")
fmt.bytes = function (bytes) {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};


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

// formats seconds into a duration string (e.g. "1:30" or "1:02:03")
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

// escapes HTML special characters to prevent XSS in raw text insertions
fmt.escapeHtml = function (str) {
  return str ? String(str).replace(/[&<>"']/g, (match) => {
    const map = {
      '&': '&amp;', 
      '<': '&lt;', 
      '>': '&gt;', 
      '"': '&quot;', 
      "'": '&#39;',
    };
    return map[match];
  }) : '';
};


// formats numbers with fixed decimals and separators (e.g. 12345.6 -> "12.345,60")
fmt.number = function (value, decimals = 2, locale = 'de-DE') {
  if (value == null || isNaN(value)) return '';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// formats a decimal as a percentage (e.g. 0.15 -> "15%")
fmt.percent = function (value, decimals = 0) {
  return (value == null || isNaN(value)) ? ''
  : `${(value * 100).toFixed(decimals)}%`;
};

// returns singular or plural based on count
fmt.plural = function (count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
};

// truncates text and appends an ellipsis if it exceeds max length
fmt.truncate = function (str, maxLen = 30) {
  if (!str) return '';
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
};




export default fmt;


