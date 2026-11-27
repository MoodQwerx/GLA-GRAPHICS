// ZÓCALOS — FUENTE DE DATOS (GLA SUPERCOPA, SOFTX [5], 2026-11-27). Bloque
// arriba de los campos de ZÓCALO CORTO y ZÓCALO LARGO.
//   LOCAL          los campos de siempre (sin ningún cambio).
//   GOOGLE SHEETS  lista operativa del ÚLTIMO SNAPSHOT LOCAL de la planilla
//                  (server/sc-sheets-zocalos.js): ESTADO, ÚLTIMA ACTUALIZACIÓN,
//                  ACTUALIZAR AHORA, AUTO SYNC, BUSCAR, CATEGORÍA, SOLO ACTIVOS.
// Elegir un zócalo COPIA su texto en el módulo que le corresponde (TIPO CORTO
// -> ZÓCALO CORTO, TIPO DOBLE -> ZÓCALO LARGO; campo "gs") y abre ese módulo:
// PREVIEW / TOMAR AL AIRE / ACTUALIZAR salen de esa copia (nunca de Google).
// Los campos LOCALES no se pisan: volver a LOCAL es instantáneo.
// Una sincronización NUNCA cambia la pieza al aire: el zócalo elegido se
// refresca solo mientras NO está al aire (al aire: aviso, y el texto nuevo
// sale con la próxima elección / TAKE / ACTUALIZAR).
import { api, el, section, statusLine } from './sc-common.js';

export const GS_TARGET = { CORTO: 'scZocaloCorto', DOBLE: 'scZocaloLargo' };
const ZOC_IDS = Object.values(GS_TARGET);
const TARGET_LABEL = { scZocaloCorto: 'ZÓCALO CORTO', scZocaloLargo: 'ZÓCALO LARGO' };
const CATEGORIAS = ['GENERAL', 'PARTIDO', 'RESULTADO', 'INFORMACION', 'SPONSOR', 'URGENTE', 'OTRO'];
const STATE = {
  'sin-configurar': ['SIN CONFIGURAR', '#8a8a8a'],
  conectando: ['CONECTANDO', '#e7b35a'],
  conectado: ['CONECTADO', '#5fd35f'],
  error: ['ERROR', '#ef5a5a'],
  cache: ['USANDO CACHE', '#e7b35a'],
  listo: ['SIN SINCRONIZAR', '#8a8a8a'],
};

// Último estado conocido (sobrevive a cambiar de pestaña) y filtros del operador.
let latest = null; // { status, snapshot }
const ui = { q: '', cat: 'TODOS', soloActivos: true };
let mounted = null; // { render } del panel visible
let pendingMsg = ''; // confirmación de una elección que abrió el otro módulo

const fold = (v) => String(v || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
function hms(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const t = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  return d.toDateString() === new Date().toDateString() ? t : `${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${t}`;
}

const sameText = (a, b) => (a?.linea1 || '') === (b?.linea1 || '') && (a?.linea2 || '') === (b?.linea2 || '');
const copyOf = (z, syncedAt) => ({ id: z.id, linea1: z.linea1, linea2: z.linea2 || '', tipo: z.tipo, categoria: z.categoria, syncedAt: syncedAt || null });

// El zócalo elegido sigue a la planilla SOLO fuera del aire. Devuelve avisos.
function reconcile(ctx) {
  const notes = [];
  const items = latest?.snapshot?.items;
  if (!Array.isArray(items)) return notes;
  for (const id of ZOC_IDS) {
    const d = ctx.draft[id];
    const gs = d?.gs;
    if (!gs?.id) continue;
    const z = items.find((x) => x.id === gs.id);
    if (!z) { notes.push(`${gs.id} ya no está en la planilla (${TARGET_LABEL[id]} conserva su copia).`); continue; }
    if (GS_TARGET[z.tipo] !== id) { notes.push(`${gs.id} ahora es TIPO ${z.tipo}: elegilo de nuevo para usarlo en ${TARGET_LABEL[GS_TARGET[z.tipo]]}.`); continue; }
    if (sameText(gs, z)) continue;
    if (ctx.isOn(id)) { notes.push(`${gs.id} cambió en la planilla y está AL AIRE: no se toca. El texto nuevo sale con PREVIEW / TOMAR AL AIRE / ACTUALIZAR después de elegirlo.`); continue; }
    d.gs = copyOf(z, latest.snapshot.syncedAt);
    ctx.autosave(id);
  }
  return notes;
}

// Mensaje del servidor (cada sync, manual o AUTO). Lo llama Master siempre,
// con o sin este panel visible.
export function handleGsheetsMessage(msg, ctx) {
  latest = { status: msg.status, snapshot: msg.snapshot || null, result: msg.result || latest?.result || null };
  const notes = reconcile(ctx);
  mounted?.render(notes);
}

export function renderScGsheetsZocalosPanel(anchor, ctx, { activeId, fieldsContainer, selectModule }) {
  const root = el('div', { class: 'bb-panel sc-gs-panel', dataset: { key: 'gs-zocalos' } });
  anchor.before(root);
  const status = statusLine();
  let busy = false;
  let notes = [];
  const fuente = () => (ctx.draft[activeId]?.fuente === 'google' ? 'google' : 'local');

  const setFuente = (f) => {
    for (const id of ZOC_IDS) {
      if (!ctx.draft[id]) continue;
      ctx.draft[id].fuente = f;
      ctx.autosave(id);
    }
    if (f === 'google' && !latest) load();
    render();
  };

  async function load() {
    try {
      const r = await api('/api/sc/gsheets/zocalos');
      latest = { status: r.status, snapshot: r.snapshot || null, result: latest?.result || null };
      notes = reconcile(ctx);
    } catch (err) {
      status.set('error', `No se pudo leer el estado de GOOGLE SHEETS: ${err.message}`);
    }
    render();
  }

  async function syncNow() {
    if (busy) return;
    busy = true;
    status.set('', 'CONECTANDO CON GOOGLE SHEETS…');
    render();
    try {
      const res = await fetch('/api/sc/gsheets/zocalos/sync', { method: 'POST' });
      const r = await res.json().catch(() => null);
      if (r?.status) latest = { status: r.status, snapshot: r.snapshot || null, result: r.result || null };
      notes = reconcile(ctx);
    } catch (err) {
      latest = latest ? { ...latest, result: { ok: false, error: `SOFTX no respondió: ${err.message}` } } : latest;
    } finally {
      busy = false;
      status.set('', ''); // el resultado lo muestra resultLine()
      render();
    }
  }

  async function setAuto(sec) {
    try {
      const r = await api('/api/sc/gsheets/config', { method: 'POST', body: { autoSyncSeconds: Number(sec) } });
      latest = { ...(latest || {}), status: r.status, snapshot: r.snapshot || null };
    } catch (err) {
      status.set('error', err.message);
    }
    render();
  }

  function choose(z) {
    const target = GS_TARGET[z.tipo];
    if (!target || !ctx.draft[target]) return;
    for (const id of ZOC_IDS) if (ctx.draft[id]) ctx.draft[id].fuente = 'google';
    ctx.draft[target].gs = copyOf(z, latest?.snapshot?.syncedAt);
    for (const id of ZOC_IDS) ctx.autosave(id);
    const onAir = ctx.isOn(target);
    const msg = `ELEGIDO ${z.id} → ${TARGET_LABEL[target]}.${onAir ? ' ESTÁ AL AIRE: el cambio sale con ACTUALIZAR.' : ' PREVIEW / TOMAR AL AIRE.'}`;
    if (target !== activeId) {
      pendingMsg = msg;
      selectModule(target);
      return;
    }
    status.set('ok', msg);
    render();
  }

  function resultLine() {
    const st = latest?.status;
    const r = latest?.result;
    if (!st) return null;
    if (st.state === 'conectando' || busy) return el('div', { class: 'bb-status', text: 'CONECTANDO CON GOOGLE SHEETS…' });
    if (r?.ok && st.state === 'conectado') return el('div', { class: 'bb-status ok', dataset: { key: 'gs-result' }, text: `ACTUALIZADO · ${st.count} ZÓCALOS (${st.activos} activos) · ${hms(st.lastOkAt)}` });
    if (st.state === 'error') {
      return el('div', { class: 'bb-status error', dataset: { key: 'gs-result' } }, [
        el('div', { text: `ERROR GOOGLE SHEETS: ${st.lastError || ''}` }),
        el('div', { text: st.usingCache ? `USANDO ÚLTIMA COPIA LOCAL · ÚLTIMA SYNC: ${hms(st.lastSyncAt)}` : 'SIN COPIA LOCAL TODAVÍA (la lista queda vacía hasta una sync correcta).' }),
      ]);
    }
    return null;
  }

  function list() {
    const items = latest?.snapshot?.items || [];
    const q = fold(ui.q.trim());
    const shown = items.filter((z) => (!ui.soloActivos || z.activo)
      && (ui.cat === 'TODOS' || z.categoria === ui.cat)
      && (!q || fold(`${z.id} ${z.linea1} ${z.linea2} ${z.notas}`).includes(q)));
    const chosen = new Set(ZOC_IDS.map((id) => ctx.draft[id]?.gs?.id).filter(Boolean));
    const node = el('div', { class: 'sc-gs-list', dataset: { key: 'gs-list' } });
    node.append(el('div', { class: 'bb-desc', dataset: { key: 'gs-count' }, text: `${shown.length} de ${items.length} zócalos` }));
    if (!items.length) {
      node.append(el('p', { class: 'bb-desc', text: 'SIN ZÓCALOS: todavía no hay una sincronización correcta. Configurá la planilla y apretá ACTUALIZAR AHORA.' }));
      return node;
    }
    for (const z of shown.slice(0, 400)) {
      node.append(el('button', {
        type: 'button',
        class: `sc-gs-item${chosen.has(z.id) ? ' is-chosen' : ''}${z.activo ? '' : ' is-off'}`,
        dataset: { key: `gs-item-${z.id}`, id: z.id },
        title: `Elegir ${z.id} para ${TARGET_LABEL[GS_TARGET[z.tipo]]}`,
        onclick: () => choose(z),
      }, [
        el('span', { class: 'sc-gs-id', text: z.id }),
        el('span', { class: 'sc-gs-text' }, [
          el('b', { text: z.linea1 }),
          z.linea2 ? el('span', { text: z.linea2 }) : null,
          z.notas ? el('i', { text: `NOTAS: ${z.notas}` }) : null,
        ]),
        el('span', { class: 'sc-gs-tags' }, [
          el('em', { text: z.tipo }),
          el('em', { text: z.categoria }),
          z.activo ? null : el('em', { class: 'off', text: 'INACTIVO' }),
          chosen.has(z.id) ? el('em', { class: 'on', text: 'ELEGIDO' }) : null,
        ]),
      ]));
    }
    return node;
  }

  let listBox = null;
  const renderList = () => { if (listBox) listBox.replaceChildren(list()); };

  function render(extraNotes) {
    if (Array.isArray(extraNotes)) notes = extraNotes;
    const f = fuente();
    fieldsContainer.classList.toggle('sc-gs-dim', f === 'google');
    const head = el('div', { class: 'bb-actions' }, [
      el('span', { class: 'bb-field-label', text: 'FUENTE DE DATOS' }),
      el('button', { type: 'button', class: `bb-btn${f === 'local' ? ' active' : ''}`, text: 'LOCAL', dataset: { key: 'gs-fuente-local' }, onclick: () => setFuente('local') }),
      el('button', { type: 'button', class: `bb-btn${f === 'google' ? ' active' : ''}`, text: 'GOOGLE SHEETS', dataset: { key: 'gs-fuente-google' }, onclick: () => setFuente('google') }),
    ]);
    const children = [head];
    if (f === 'local') {
      children.push(el('p', { class: 'bb-desc', text: 'LOCAL: el texto sale de los campos de abajo, como siempre.' }));
    } else {
      const st = latest?.status;
      const [label, color] = STATE[st?.state] || ['CARGANDO…', '#8a8a8a'];
      const gs = ctx.draft[activeId]?.gs;
      children.push(
        el('div', { class: 'sc-gs-state', dataset: { key: 'gs-estado' } }, [
          el('span', { text: 'ESTADO: ' }),
          el('b', { style: `color:${color}`, dataset: { key: 'gs-state', state: st?.state || '' }, text: `● ${st?.state === 'error' && st?.usingCache ? 'ERROR · USANDO CACHE' : label}` }),
          el('span', { text: `  ·  ÚLTIMA ACTUALIZACIÓN: ${hms(st?.lastSyncAt)}`, dataset: { key: 'gs-last' } }),
        ]),
        st && !st.configured ? el('div', { class: 'bb-status warn', dataset: { key: 'gs-problems' }, text: `${(st.problems || []).join(' ')} Ver docs/GOOGLE-SHEETS.md.` }) : null,
        st?.serviceAccountEmail ? el('div', { class: 'bb-desc', text: `Compartir la planilla (Lector) con: ${st.serviceAccountEmail}` }) : null,
        el('div', { class: 'bb-actions' }, [
          el('button', { type: 'button', class: 'bb-btn primary', text: busy ? 'ACTUALIZANDO…' : 'ACTUALIZAR AHORA', disabled: busy, dataset: { key: 'gs-sync' }, onclick: syncNow }),
          el('label', { class: 'bb-field check' }, [
            el('span', { text: 'AUTO SYNC' }),
            el('select', { dataset: { key: 'gs-auto' }, onchange: (e) => setAuto(e.target.value) },
              [0, 30, 60, 120, 300].map((s) => el('option', { value: String(s), text: s ? `${s} s` : 'NO', selected: Number(st?.autoSyncSeconds || 0) === s }))),
          ]),
        ]),
        resultLine(),
        status.node,
        el('div', { class: 'bb-desc', dataset: { key: 'gs-elegido' }, text: gs?.id ? `${TARGET_LABEL[activeId]}: ${gs.id} · ${gs.linea1}${gs.linea2 ? ` / ${gs.linea2}` : ''}` : `${TARGET_LABEL[activeId]}: ningún zócalo de la planilla elegido todavía.` }),
        ...notes.map((n) => el('div', { class: 'bb-status warn', dataset: { key: 'gs-note' }, text: n })),
        el('div', { class: 'bb-actions' }, [
          el('label', { class: 'bb-field grow' }, [
            el('span', { text: 'BUSCAR' }),
            el('input', { type: 'text', value: ui.q, placeholder: 'ID, texto o notas', dataset: { key: 'gs-buscar' }, oninput: (e) => { ui.q = e.target.value; renderList(); } }),
          ]),
          el('label', { class: 'bb-field' }, [
            el('span', { text: 'CATEGORÍA' }),
            el('select', { dataset: { key: 'gs-cat' }, onchange: (e) => { ui.cat = e.target.value; renderList(); } },
              ['TODOS', ...CATEGORIAS].map((c) => el('option', { value: c, text: c, selected: ui.cat === c }))),
          ]),
          el('label', { class: 'bb-field check' }, [
            el('input', { type: 'checkbox', checked: ui.soloActivos, dataset: { key: 'gs-activos' }, onchange: (e) => { ui.soloActivos = e.target.checked; renderList(); } }),
            el('span', { text: 'SOLO ACTIVOS' }),
          ]),
        ]),
      );
      listBox = el('div');
      children.push(listBox);
      const warns = latest?.snapshot?.warnings || [];
      if (warns.length) {
        children.push(el('details', { class: 'bb-desc' }, [
          el('summary', { text: `AVISOS DE LA PLANILLA (${warns.length})` }),
          ...warns.slice(0, 50).map((w) => el('div', { text: w })),
        ]));
      }
    }
    const focused = document.activeElement?.dataset?.key === 'gs-buscar' && root.contains(document.activeElement);
    root.replaceChildren(section('ZÓCALOS · FUENTE DE DATOS', children.filter(Boolean)));
    if (f === 'google') renderList();
    else listBox = null;
    if (focused) {
      const input = root.querySelector('[data-key="gs-buscar"]');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    }
  }

  if (pendingMsg) { status.set('ok', pendingMsg); pendingMsg = ''; }
  mounted = { render };
  ctx.setHooks({ onModuleUpdate(id) { if (ZOC_IDS.includes(id)) { notes = reconcile(ctx); render(); } } });
  ctx.lifecycle.onCleanup(() => {
    if (mounted?.render === render) mounted = null;
    fieldsContainer.classList.remove('sc-gs-dim');
    root.remove();
  });
  notes = reconcile(ctx);
  render();
  load();
}

