// TARJETAS — BAULETI vs BALANZA (SOFTX [3], FASE 2). Tipo (AMARILLA / ROJA
// / AZUL) -> equipo -> jugador de PLANTELES: registra el evento en
// bbMarcador.matchEvents (type, teamId, playerId, minuto, período) y, si
// está activado, manda la placa chica de abajo a la izquierda. Los mismos
// botones rápidos siguen en el panel del Marcador; acá están todas las
// tarjetas del partido con ▶ (volver a mostrar) y corrección.
//
// JUGADOR: PLANTEL / MANUAL (2026-11-06). MANUAL carga nombre y número de un
// jugador de último momento SOLO para este evento (sin ID, el plantel no se
// toca); el modo queda guardado en bbTarjeta.jugadorModo.
import { elapsedMs, parseClockLimit } from '../../../shared/clock.js';
import { BB_CARD_TYPES, BB_CARD_LABELS, sideTeamId } from '../../../shared/bb-match.js';
import { el, section, statusLine, teamLabel } from './bb-common.js';
import { bbOptions, playerPicker, activePlayers, registerCard, eventsEditor, CARD_ICON_CLASS, playerText } from './bb-incidents.js';

let selType = 'yellowCard';
let selSide = 'local';

export function renderBbTarjetasPanel(container, ctx) {
  const { lifecycle } = ctx;
  const m = ctx.draft.bbMarcador;
  if (!Array.isArray(m.matchEvents)) m.matchEvents = [];
  container.innerHTML = '';
  const root = el('div', { class: 'bb-panel' });
  container.appendChild(root);
  const status = statusLine();
  let players = null;
  let onAir = null;

  const nowMs = () => elapsedMs(m.clock, parseClockLimit(m.clockEndText, 20 * 60000) || 20 * 60000);

  async function load() {
    players = null;
    const side = selSide;
    render();
    try {
      const list = await activePlayers(sideTeamId(m, side));
      if (lifecycle.destroyed || side !== selSide) return;
      players = list;
      render();
    } catch (err) {
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
  }

  const td = ctx.draft.bbTarjeta;
  const modo = () => (td.jugadorModo === 'manual' ? 'manual' : 'plantel');

  function pick(player) {
    const ev = registerCard(ctx, { type: selType, side: selSide, player, clockMs: nowMs() });
    status.set('ok', `TARJETA ${BB_CARD_LABELS[selType]} — ${playerText(ev.playerName, ev.dorsal, 'SIN JUGADOR')} (${teamLabel(ev.teamId)}) · ${ev.minute}' ${ev.period}${bbOptions.showCardOnRegister ? ' · AL AIRE' : ''}`);
    render();
  }

  function pickManual() {
    const nombre = String(td.manual?.nombre || '').trim();
    if (!nombre) { status.set('error', 'MANUAL: escribí el nombre del jugador.'); return; }
    const dorsal = String(td.manual?.dorsal || '').trim();
    td.manual = { nombre: '', dorsal: '' };
    ctx.autosave('bbTarjeta');
    pick({ id: null, teamId: sideTeamId(m, selSide), nombre, dorsal });
  }

  function manualBox() {
    const setManual = (key, value) => { td.manual = { ...(td.manual || {}), [key]: value }; ctx.autosave('bbTarjeta'); };
    const nombre = el('input', { type: 'text', maxLength: 40, value: td.manual?.nombre || '', placeholder: 'NOMBRE DEL JUGADOR', oninput: (e) => setManual('nombre', e.target.value) });
    nombre.addEventListener('keydown', (e) => { if (e.key === 'Enter') pickManual(); });
    const dorsal = el('input', { type: 'text', maxLength: 3, class: 'bb-num', value: td.manual?.dorsal || '', placeholder: 'N°', oninput: (e) => setManual('dorsal', e.target.value) });
    return el('div', { class: 'bb-picker' }, [
      el('div', { class: 'bb-picker-title', text: `JUGADOR MANUAL — ${teamLabel(sideTeamId(m, selSide))} (no se guarda en PLANTELES)` }),
      el('div', { class: 'bb-actions' }, [
        el('label', { class: 'bb-field grow' }, [el('span', { text: 'NOMBRE' }), nombre]),
        el('label', { class: 'bb-field' }, [el('span', { text: 'NÚMERO (opcional)' }), dorsal]),
        el('button', { type: 'button', class: `bb-btn primary card ${CARD_ICON_CLASS[selType]}`, text: `REGISTRAR TARJETA ${BB_CARD_LABELS[selType]}`, onclick: pickManual }),
      ]),
    ]);
  }

  function paintOnAir() {
    if (!onAir) return;
    const on = ctx.isOn('bbTarjeta');
    onAir.textContent = on ? 'PLACA: AL AIRE' : 'PLACA: FUERA';
    onAir.className = `bb-pill ${on ? 'on' : ''}`;
  }
  ctx.setHooks({ onModuleUpdate: (id) => { if (id === 'bbTarjeta') paintOnAir(); } });

  function render() {
    root.innerHTML = '';
    onAir = el('span', { class: 'bb-pill' });
    const autoOut = el('select', {
      onchange: (e) => { ctx.draft.bbTarjeta.autoOutSec = Number(e.target.value); ctx.autosave('bbTarjeta'); },
    }, [5, 7, 10, 15, 0].map((s) => el('option', { value: String(s), text: s ? `SALE SOLA A LOS ${s} s` : 'SALIDA MANUAL' })));
    autoOut.value = String(ctx.draft.bbTarjeta?.autoOutSec ?? 7);
    const showToggle = el('input', { type: 'checkbox', checked: bbOptions.showCardOnRegister, onchange: (e) => { bbOptions.showCardOnRegister = e.target.checked; } });

    root.append(
      el('p', { class: 'bb-desc', text: 'Elegí tipo y equipo, después el jugador: queda registrada en el partido (minuto y período del reloj) y sale la placa abajo a la izquierda.' }),
      section('1 · TIPO', [
        el('div', { class: 'bb-actions' }, BB_CARD_TYPES.map((t) => el('button', {
          type: 'button',
          class: `bb-btn card big ${CARD_ICON_CLASS[t]}${selType === t ? ' active-card' : ''}`,
          text: BB_CARD_LABELS[t],
          onclick: () => { selType = t; render(); },
        }))),
      ]),
      section('2 · EQUIPO', [
        el('div', { class: 'bb-actions' }, ['local', 'visitante'].map((side) => el('button', {
          type: 'button',
          class: `bb-btn period${selSide === side ? ' active' : ''}`,
          text: `${side === 'local' ? 'LOCAL' : 'VISITANTE'} — ${teamLabel(sideTeamId(m, side))}`,
          onclick: () => { selSide = side; load(); },
        }))),
      ]),
      section('3 · JUGADOR', [
        el('div', { class: 'bb-actions' }, [['plantel', 'PLANTEL'], ['manual', 'MANUAL']].map(([id, text]) => el('button', {
          type: 'button',
          class: `bb-btn period${modo() === id ? ' active' : ''}`,
          text,
          onclick: () => { td.jugadorModo = id; ctx.autosave('bbTarjeta'); render(); },
        }))),
        modo() === 'manual' ? manualBox() : playerPicker({
          title: `TARJETA ${BB_CARD_LABELS[selType]} — ${teamLabel(sideTeamId(m, selSide))}`,
          cls: `card ${CARD_ICON_CLASS[selType]}`,
          players,
          onPick: pick,
          actions: [el('button', { type: 'button', class: 'bb-btn', text: 'SIN JUGADOR', onclick: () => pick(null) })],
        }),
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field check' }, [showToggle, el('span', { text: 'MOSTRAR PLACA AL REGISTRAR' })]),
          autoOut,
          el('button', { type: 'button', class: 'bb-btn danger', text: 'SACAR PLACA', onclick: () => ctx.out('bbTarjeta') }),
          onAir,
        ]),
        status.node,
      ]),
      eventsEditor(ctx, { title: 'TARJETAS DEL PARTIDO', filter: BB_CARD_TYPES, status, onChange: () => {}, emptyText: 'Sin tarjetas todavía.' }).node,
    );
    paintOnAir();
  }

  load();
}
