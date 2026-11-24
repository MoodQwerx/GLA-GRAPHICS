// SPONSORS — COPA 4 NACIONES (SOFTX [4], 2026-11-13). Placas de premio con
// sponsor sobre los PNG reales del diseñador:
//   MVP DEL PARTIDO · PRAGMATIC PLAY (un PNG por selección, con su escudo),
//   BALÓN DE ORO · COMPRA GAMER, GUANTE DE ORO · MOSTAZA y
//   BOTÍN DE ORO · SPEED LÍDER.
// PIEZA: cuál de las placas.
// JUGADOR:
//   AUTOMÁTICO = SELECCIÓN -> JUGADOR (todo el plantel efectivo de esa
//     selección, WEB o MANUAL según PLANTELES). Nombre, selección y PNG del
//     MVP se completan solos. "Automático" NO elige ganadores: el operador
//     elige al jugador; nada sale de rankings ni estadísticas.
//   MANUAL = NOMBRE libre (no hace falta que esté en el plantel). En el MVP se
//     elige además el PNG: con el escudo de una selección o sin escudo.
// Todo se guarda con el módulo (autoguardado). Al aire, los cambios se
// aplican con ACTUALIZAR (o Enter en NOMBRE). Ajuste fino: AJUSTE DE CAPAS ->
// ELEMENTOS (NOMBRE de cada pieza: X / Y / ESCALA) y AJUSTE DE COMPOSICIÓN.
import { C4N_SPONSOR_PIEZAS, C4N_SPONSOR_TEAMS, sponsorPieza, sponsorSlot, sponsorName, c4nFondo } from '../../../shared/c4n-assets.js';
import { el, section, statusLine, teamLabel, loadPlantel } from './c4n-common.js';

export function renderC4nSponsorsJugadorPanel(container, ctx) {
  const { lifecycle } = ctx;
  const data = ctx.draft.c4nSponsors;
  if (!C4N_SPONSOR_TEAMS.includes(data.pais)) data.pais = C4N_SPONSOR_TEAMS[0];
  const root = el('div', { class: 'bb-panel' });
  container.append(root);
  const status = statusLine();
  const rosters = {};
  const save = () => ctx.autosave('c4nSponsors');
  const live = () => { save(); if (ctx.isOn('c4nSponsors')) ctx.sendLive('c4nSponsors'); };

  async function loadRoster(teamId) {
    if (!teamId || rosters[teamId]) return;
    try {
      rosters[teamId] = await loadPlantel(teamId);
    } catch (err) {
      rosters[teamId] = [];
      status.set('error', `NO SE PUDO LEER EL PLANTEL: ${err.message}`);
    }
    if (!lifecycle.destroyed) render();
  }

  const toggle = (on, text, onclick, dataset) => el('button', { type: 'button', class: `bb-btn period${on ? ' active' : ''}`, text, dataset, onclick });

  // Resumen "SALE AL AIRE" (se actualiza también mientras se escribe el NOMBRE).
  const summary = el('div', { class: 'c4n-source-line', dataset: { resumen: '1' } });
  function paintSummary() {
    const pieza = sponsorPieza(data.pieza);
    const name = sponsorName(data);
    summary.className = `c4n-source-line${name ? '' : ' warn'}`;
    summary.replaceChildren(
      el('b', { text: `${pieza.label} · ${pieza.sponsor}: ` }),
      name ? name.toLocaleUpperCase('es-AR') : (data.modo === 'manual' ? 'FALTA EL NOMBRE (la placa sale sin nombre)' : 'FALTA ELEGIR AL JUGADOR (la placa sale sin nombre)'),
    );
  }

  function render() {
    root.innerHTML = '';
    const pieza = sponsorPieza(data.pieza);
    const manual = data.modo === 'manual';
    const blocks = [];

    blocks.push(section('PIEZA', [
      el('div', { class: 'bb-actions c4n-fuente' }, C4N_SPONSOR_PIEZAS.map((p) => toggle(pieza.id === p.id, `${p.label} · ${p.sponsor}`, () => {
        data.pieza = p.id;
        save();
        render();
      }, { pieza: p.id }))),
    ]));

    blocks.push(section('JUGADOR', [
      el('div', { class: 'bb-actions c4n-fuente' }, [['auto', 'AUTOMÁTICO'], ['manual', 'MANUAL']].map(([id, text]) => toggle((manual ? 'manual' : 'auto') === id, text, () => {
        data.modo = id;
        save();
        if (id === 'auto') loadRoster(data.pais);
        render();
      }, { modo: id }))),
      el('div', {
        class: 'bb-desc',
        text: manual
          ? 'MANUAL: el nombre se escribe a mano (no hace falta que esté en el plantel).'
          : 'AUTOMÁTICO: elegí la selección y después el jugador; nombre, selección y PNG se completan solos. El sistema no elige al ganador.',
      }),
    ]));

    if (!manual) {
      const roster = rosters[data.pais];
      const pais = el('select', {
        dataset: { key: 'pais' },
        onchange: (e) => {
          data.pais = e.target.value;
          if (data.jugador?.teamId !== data.pais) data.jugador = null;
          save();
          loadRoster(data.pais);
          render();
        },
      }, C4N_SPONSOR_TEAMS.map((id) => el('option', { value: id, text: teamLabel(id) })));
      pais.value = data.pais;
      const jugador = el('select', {
        dataset: { key: 'jugador' },
        disabled: !roster,
        onchange: (e) => {
          const p = (roster || []).find((x) => x.id === e.target.value);
          data.jugador = p ? { id: p.id, nombre: p.nombre, dorsal: p.dorsal || '', teamId: data.pais } : null;
          save();
          render();
        },
      }, roster
        ? [el('option', { value: '', text: roster.length ? '— elegí un jugador —' : '— la selección no tiene jugadores cargados —' }),
          ...roster.map((p) => el('option', { value: p.id, text: `${p.dorsal ? `${p.dorsal} · ` : ''}${p.nombre}` }))]
        : [el('option', { value: '', text: 'CARGANDO PLANTEL…' })]);
      jugador.value = data.jugador?.teamId === data.pais ? data.jugador.id : '';
      blocks.push(section('SELECCIÓN Y JUGADOR', [
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field' }, [el('span', { text: 'SELECCIÓN / PAÍS' }), pais]),
          el('label', { class: 'bb-field grow' }, [el('span', { text: 'JUGADOR' }), jugador]),
        ]),
      ]));
    } else {
      const nombre = el('input', { type: 'text', maxLength: 40, value: data.nombre || '', placeholder: 'Ej.: JUAN PÉREZ', dataset: { key: 'nombre' } });
      nombre.addEventListener('input', () => { data.nombre = nombre.value; save(); paintSummary(); });
      nombre.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        live();
        status.set('ok', ctx.isOn('c4nSponsors') ? 'NOMBRE ACTUALIZADO AL AIRE.' : 'NOMBRE GUARDADO.');
        render();
      });
      const parts = [el('label', { class: 'bb-field grow' }, [el('span', { text: 'NOMBRE (Enter = actualizar al aire)' }), nombre])];
      blocks.push(section('NOMBRE', [el('div', { class: 'bb-actions' }, parts)]));
      if (pieza.porPais) {
        blocks.push(section('PNG DEL MVP', [
          el('div', { class: 'bb-actions c4n-fuente' }, [['', 'SIN ESCUDO'], ...C4N_SPONSOR_TEAMS.map((id) => [id, teamLabel(id)])].map(([id, text]) => toggle((data.escudo || '') === id, text, () => {
            data.escudo = id;
            save();
            render();
          }, { escudo: id || 'ninguno' }))),
        ]));
      }
    }

    const file = (c4nFondo('c4nSponsors', sponsorSlot(data)) || c4nFondo('c4nSponsors'))?.file || '';
    paintSummary();
    blocks.push(section('SALE AL AIRE', [
      summary,
      el('div', { class: 'bb-desc', text: `PNG: ${file}. ${ctx.isOn('c4nSponsors') ? 'AL AIRE: los cambios entran con ACTUALIZAR.' : 'TAKE / PREVIEW para verla.'}` }),
      status.node,
    ]));
    root.append(...blocks);
  }

  render();
  if (data.modo !== 'manual') loadRoster(data.pais);
}
