// Utilidades minimas de escape/formato para renderear texto operado en vivo
// sin abrir la puerta a HTML injection desde el Master Control.

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function nl2br(str) {
  return escapeHtml(str)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<div>${line}</div>`)
    .join('');
}
