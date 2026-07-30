import { escapeHtml } from '../../../shared/dom-utils.js';

export default function renderUpcoming(el, data) {
  const { title, items } = data;

  const rows = items.map((it) => `
    <div class="upcoming-row">
      <div class="match">${escapeHtml(it.teamA)} vs ${escapeHtml(it.teamB)}</div>
      ${it.info ? `<div class="info">${escapeHtml(it.info)}</div>` : ''}
    </div>
  `).join('');

  el.innerHTML = `
    <div class="upcoming-box">
      <div class="upcoming-header gold-accent">${escapeHtml(title || 'PROXIMOS ENCUENTROS')}</div>
      ${rows}
    </div>
  `;
}
