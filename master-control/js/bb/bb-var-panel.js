// VAR — BAULETI vs BALANZA (SOFTX [3], FASE 2). Decisión con un clic
// (CHEQUEO VAR, GOL, NO GOL, PENAL, NO PENAL, TARJETA ROJA, DECISIÓN
// CONFIRMADA) y MOTIVO editable. Con la placa al aire, cambiar la decisión
// se ve en el momento (pasa de "en revisión" a la decisión sin sacarla); el
// MOTIVO entra con ACTUALIZAR o Enter. REGISTRAR EN EL PARTIDO deja la
// decisión en matchEvents (tipo "var") para el timeline de CHARTS.
import { elapsedMs, parseClockLimit } from '../../../shared/clock.js';
import { BB_EVENT_TYPES, BB_VAR_DECISIONS, createMatchEvent, sideTeamId, varDecision } from '../../../shared/bb-match.js';
import { el, section, statusLine, teamLabel } from './bb-common.js';
import { commitMatch, eventsEditor } from './bb-incidents.js';

let varSide = '';

export function renderBbVarPanel(container, ctx) {
  const data = ctx.draft.bbVar;
  const m = ctx.draft.bbMarcador;
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();

  const live = () => {
    ctx.autosave('bbVar');
    if (ctx.isOn('bbVar')) ctx.sendLive('bbVar');
  };

  function render() {
    root.innerHTML = '';
    const motivo = el('input', { type: 'text', maxLength: 60, value: data.motivo || '', placeholder: 'Ej.: POSIBLE MANO EN EL ÁREA' });
    motivo.addEventListener('input', () => { data.motivo = motivo.value; ctx.autosave('bbVar'); });
    motivo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { live(); status.set('ok', ctx.isOn('bbVar') ? 'MOTIVO ACTUALIZADO AL AIRE.' : 'MOTIVO GUARDADO.'); } });
    const sideSel = el('select', { onchange: (e) => { varSide = e.target.value; } }, [
      el('option', { value: '', text: 'SIN EQUIPO' }),
      ...['local', 'visitante'].map((s) => el('option', { value: s, text: `${s === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(m, s))}` })),
    ]);
    sideSel.value = varSide;

    root.append(
      el('p', { class: 'bb-desc', text: 'Placa compacta arriba a la derecha. Con la placa al aire, cada decisión se actualiza al instante.' }),
      section('DECISIÓN', [
        el('div', { class: 'bb-var-grid' }, BB_VAR_DECISIONS.map((d) => el('button', {
          type: 'button',
          class: `bb-btn big${data.decision === d.id ? ' active' : ''}${d.id === 'chequeo' ? ' var-check' : ''}`,
          text: d.label,
          onclick: () => {
            data.decision = d.id;
            live();
            status.set('ok', `${d.label}${ctx.isOn('bbVar') ? ' · AL AIRE' : ''}`);
            render();
          },
        }))),
        el('label', { class: 'bb-field' }, [el('span', { text: 'MOTIVO (Enter = actualizar al aire)' }), motivo]),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'SIN MOTIVO', onclick: () => { data.motivo = ''; live(); render(); } }),
        ]),
      ]),
      section('REGISTRAR EN EL PARTIDO', [
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'EQUIPO AFECTADO (opcional)' }), sideSel]),
          el('button', {
            type: 'button',
            class: 'bb-btn primary',
            text: 'REGISTRAR DECISIÓN',
            onclick: () => {
              const limit = parseClockLimit(m.clockEndText, 20 * 60000) || 20 * 60000;
              const ev = createMatchEvent({ type: BB_EVENT_TYPES.VAR, side: varSide || null, marcador: m, decision: data.decision, motivo: data.motivo, clockMs: elapsedMs(m.clock, limit) });
              if (!varSide) ev.teamId = '';
              m.matchEvents.push(ev);
              commitMatch(ctx);
              status.set('ok', `VAR REGISTRADO: ${varDecision(data.decision).label} · ${ev.minute}' ${ev.period}`);
              render();
            },
          }),
        ]),
        status.node,
      ]),
      eventsEditor(ctx, { title: 'DECISIONES VAR REGISTRADAS', filter: [BB_EVENT_TYPES.VAR], status, emptyText: 'Ninguna decisión registrada.' }).node,
    );
  }

  render();
}
