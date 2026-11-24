// VAR — COPA 4 NACIONES (SOFTX [4], 2026-11-11). Misma lógica que el VAR de
// BAULETI vs BALANZA: decisión con un clic (CHEQUEO VAR, GOL, NO GOL, PENAL,
// NO PENAL, TARJETA ROJA, DECISIÓN CONFIRMADA) y MOTIVO editable. Con la placa
// al aire, cambiar la decisión se ve en el momento (pasa de "en revisión" a la
// decisión sin sacarla); el MOTIVO entra con ACTUALIZAR o Enter. REGISTRAR EN
// EL PARTIDO deja la decisión en matchEvents del MARCADOR (tipo "var"; las
// placas de estadísticas no la muestran). Placa abajo a la izquierda (grupo de
// TARJETAS, CAMBIOS y zócalos: TAKE de una saca a la otra).
// SPONSORS A LA DERECHA (2026-11-13): MOSTRAR / OCULTAR el rotativo del ZÓCALO
// COMPUESTO al lado de la placa (se guarda con el módulo; al aire, al instante).
import { elapsedMs, parseClockLimit } from '../../../shared/clock.js';
import { C4N_EVENT_TYPES, createMatchEvent, sideTeamId } from '../../../shared/c4n-match.js';
import { BB_VAR_DECISIONS, varDecision } from '../../../shared/bb-match.js';
import { el, section, statusLine, teamLabel } from './c4n-common.js';
import { commitMatch, eventsEditor } from './c4n-incidents.js';

let varSide = '';

export function renderC4nVarPanel(container, ctx) {
  const data = ctx.draft.c4nVar;
  const m = ctx.draft.c4nMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();

  const live = () => {
    ctx.autosave('c4nVar');
    if (ctx.isOn('c4nVar')) ctx.sendLive('c4nVar');
  };

  function render() {
    root.innerHTML = '';
    const motivo = el('input', { type: 'text', maxLength: 60, value: data.motivo || '', placeholder: 'Ej.: POSIBLE MANO EN EL ÁREA', dataset: { key: 'motivo' } });
    motivo.addEventListener('input', () => { data.motivo = motivo.value; ctx.autosave('c4nVar'); });
    motivo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { live(); status.set('ok', ctx.isOn('c4nVar') ? 'MOTIVO ACTUALIZADO AL AIRE.' : 'MOTIVO GUARDADO.'); } });
    const sideSel = el('select', { onchange: (e) => { varSide = e.target.value; } }, [
      el('option', { value: '', text: 'SIN EQUIPO' }),
      ...['local', 'visitante'].map((s) => el('option', { value: s, text: `${s === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(m, s))}` })),
    ]);
    sideSel.value = varSide;

    root.append(
      el('p', { class: 'bb-desc', text: 'Placa abajo a la izquierda (misma zona que TARJETAS, CAMBIOS y zócalos: TAKE de una saca a la otra). Con la placa al aire, cada decisión se actualiza al instante. Posición y escala: AJUSTE DE COMPOSICIÓN (mueve el PNG y los textos juntos).' }),
      section('DECISIÓN', [
        el('div', { class: 'bb-var-grid' }, BB_VAR_DECISIONS.map((d) => el('button', {
          type: 'button',
          class: `bb-btn big${data.decision === d.id ? ' active' : ''}${d.id === 'chequeo' ? ' var-check' : ''}`,
          text: d.label,
          dataset: { decision: d.id },
          onclick: () => {
            data.decision = d.id;
            live();
            status.set('ok', `${d.label}${ctx.isOn('c4nVar') ? ' · AL AIRE' : ''}`);
            render();
          },
        }))),
        el('label', { class: 'bb-field' }, [el('span', { text: 'MOTIVO (Enter = actualizar al aire)' }), motivo]),
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn', text: 'SIN MOTIVO', onclick: () => { data.motivo = ''; live(); render(); } }),
        ]),
      ]),
      section('SPONSORS A LA DERECHA', [
        el('div', { class: 'bb-actions c4n-fuente' }, [['mostrar', 'MOSTRAR'], ['ocultar', 'OCULTAR']].map(([id, text]) => el('button', {
          type: 'button',
          class: `bb-btn period${(data.sponsors === 'mostrar' ? 'mostrar' : 'ocultar') === id ? ' active' : ''}`,
          text,
          dataset: { sponsors: id },
          onclick: () => {
            data.sponsors = id;
            live();
            status.set('ok', `SPONSORS A LA DERECHA: ${text}${ctx.isOn('c4nVar') ? ' · AL AIRE' : ''}`);
            render();
          },
        }))),
        el('div', {
          class: 'bb-desc',
          text: (() => {
            const n = (ctx.draft.c4nDatos?.sponsors || []).length;
            return `El mismo rotativo del recuadro derecho del ZÓCALO COMPUESTO (carpeta sponsors/, ROTACIÓN e INTERVALO de ese módulo). ${n ? `${n} logo${n === 1 ? '' : 's'} en la carpeta.` : 'La carpeta está vacía: el VAR sale solo, sin recuadro.'} Sale con el VAR.`;
          })(),
        }),
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
