export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds, withMillis = false) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const base = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (!withMillis) return base;
  const ms = Math.floor((seconds % 1) * 1000);
  return `${base}.${String(ms).padStart(3, '0')}`;
}

export function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function fileExtension(name = '') {
  const idx = String(name).lastIndexOf('.');
  return idx >= 0 ? String(name).slice(idx).toLowerCase() : '';
}

export function stripExtension(name = '') {
  const idx = String(name).lastIndexOf('.');
  return idx > 0 ? String(name).slice(0, idx) : String(name);
}

export function sanitizeFilename(name = 'forensic-report') {
  return String(name)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'forensic-report';
}

export function formatChannels(channels) {
  if (!Number.isFinite(channels) || channels <= 0) return '—';
  if (channels === 1) return 'Mono';
  if (channels === 2) return 'Stereo';
  return `${channels} channels`;
}

export function formatSampleRate(rate) {
  if (!Number.isFinite(rate) || rate <= 0) return '—';
  return rate >= 1000 ? `${(rate / 1000).toFixed(rate % 1000 === 0 ? 0 : 1)} kHz` : `${rate} Hz`;
}

export function formatCodec(codec) {
  if (!codec) return '—';
  return String(codec).replace(/\//g, ' · ');
}

export function hashPreview(hash, head = 12, tail = 8) {
  if (!hash) return '—';
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
