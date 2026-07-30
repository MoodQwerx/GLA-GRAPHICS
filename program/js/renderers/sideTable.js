import { escapeHtml } from '../../../shared/dom-utils.js';

export default function renderSideTable(el, data) {
  const { title, items } = data;

  const rows = items.map((it) => `
    <div class="side-table-row">
      <span class="team">${escapeHtml(it.teamA)}</span>
      <span class="score">${escapeHtml(it.scoreA)} - ${escapeHtml(it.scoreB)}</span>
      <span class="team away">${escapeHtml(it.teamB)}</span>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="side-table">
      <div class="side-table-header gold-accent">${escapeHtml(title || 'RESULTADOS')}</div>
      ${rows}
    </div>
  `;
}
