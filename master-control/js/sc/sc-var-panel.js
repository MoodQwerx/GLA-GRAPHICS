// VAR — GLA SUPERCOPA (SOFTX [5]). Misma lógica que el VAR de COPA 4
// NACIONES: decisión con un clic (CHEQUEO VAR, GOL, NO GOL, PENAL, NO PENAL,
// TARJETA ROJA, DECISIÓN CONFIRMADA) y MOTIVO editable. Con la placa al aire,
// cambiar la decisión se ve en el momento; el MOTIVO entra con Enter.
// REGISTRAR EN EL PARTIDO deja la decisión en matchEvents del MARCADOR.
// POSICIÓN: las 3 del PNG real (campo "Posición de la placa").
import { elapsedMs, parseClockLimit } from '../../../shared/clock.js';
import { C4N_EVENT_TYPES, createMatchEvent, sideTeamId } from '../../../shared/c4n-match.js';
import { BB_VAR_DECISIONS, varDecision } from '../../../shared/bb-match.js';
import { el, section, statusLine, teamLabel } from './sc-common.js';
import { commitMatch, eventsEditor } from './sc-incidents.js';

let varSide = '';

export function renderScVarPanel(container, ctx) {
  const data = ctx.draft.scVar;
  const m = ctx.draft.scMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();

  const live = () => {
    ctx.autosave('scVar');
    if (ctx.isOn('scVar')) ctx.sendLive('scVar');
  };

  function render() {
    root.innerHTML = '';
    const motivo = el('input', { type: 'text', maxLength: 60, value: data.motivo || '', placeholder: 'Ej.: POSIBLE MANO EN EL ÁREA', dataset: { key: 'motivo' } });
    motivo.addEventListener('input', () => { data.motivo = motivo.value; ctx.autosave('scVar'); });
    motivo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { live(); status.set('ok', ctx.isOn('scVar') ? 'MOTIVO ACTUALIZADO AL AIRE.' : 'MOTIVO GUARDADO.'); } });
    const sideSel = el('select', { onchange: (e) => { varSide = e.target.value; } }, [
      el('option', { value: '', text: 'SIN EQUIPO' }),
      ...['local', 'visitante'].map((s) => el('option', { value: s, text: `${s === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(m, s))}` })),
    ]);
    sideSel.value = varSide;

    root.append(
      el('p', { class: 'bb-desc', text: 'Placa del PNG real en la posición elegida arriba (abajo a la izquierda, arriba o abajo a la derecha). Comparte zona con TARJETAS, CAMBIOS y zócalos: TAKE de una saca a la otra. Con la placa al aire, cada decisión se actualiza al instante. Escala fina: AJUSTE DE COMPOSICIÓN.' }),
      section('DECISIÓN', [
        el('div', { class: 'bb-var-grid' }, BB_VAR_DECISIONS.map((d) => el('button', {
          type: 'button',
          class: `bb-btn big${data.decision === d.id ? ' active' : ''}${d.id === 'chequeo' ? ' var-check' : ''}`,
          text: d.label,
          dataset: { decision: d.id },
          onclick: () => {
            data.decision = d.id;
            live();
            status.set('ok', `${d.label}${ctx.isOn('scVar') ? ' · AL AIRE' : ''}`);
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
              const ev = createMatchEvent({ type: C4N_EVENT_TYPES.VAR, side: varSide || null, marcador: m, decision: data.decision, motivo: data.motivo, clockMs: elapsedMs(m.clock, limit) });
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
      eventsEditor(ctx, { title: 'DECISIONES VAR REGISTRADAS', filter: [C4N_EVENT_TYPES.VAR], status, emptyText: 'Ninguna decisión registrada.' }).node,
    );
  }

  render();
}
