// CHARTS (SOFTX / GLA): panel del módulo. Elige TORNEO -> DÍA -> PARTIDO
// (lista de gla.futbol, ver server/charts.js) y TIPO de placa; ACTUALIZAR
// DESDE WEB arma el chart del partido y lo deja en el draft del módulo
// (autoguardado + Preview). Al aire, como el resto de los módulos, el dato
// nuevo entra con ACTUALIZAR. Ciclo de vida: el cleanup marca el panel como
// destruido; las respuestas que lleguen después no repintan nada.
const TIPOS = [
  { id: 'previa', label: 'PREVIA' },
  { id: 'entretiempo', label: 'ENTRETIEMPO' },
  { id: 'final', label: 'FIN DE PARTIDO' },
];
const STATUS_LABEL = { finished: 'FINALIZADO', live: 'EN JUEGO', scheduled: 'PROGRAMADO' };

// Catálogo por torneo (máx. 5 entradas, una por torneo) para no pedirlo de
// nuevo en cada cambio de pestaña.
const catalogCache = new Map();
const CATALOG_TTL_MS = 60000;

async function getJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

function isMarcadorMatch(partido, scoreboard) {
  const a = scoreboard?.teamA;
  const b = scoreboard?.teamB;
  if (!a || !b) return false;
  const ids = [partido.home.teamId, partido.away.teamId];
  return ids.includes(a) && ids.includes(b);
}

function partidoLabel(p, scoreboard) {
  const score = p.homeScore !== null && p.awayScore !== null ? ` ${p.homeScore}-${p.awayScore} ` : ' vs ';
  const marks = `${isMarcadorMatch(p, scoreboard) ? '★ ' : ''}${p.status === 'live' ? '● ' : ''}`;
  return `${marks}${p.hora} · ${p.fase} · ${p.home.webName}${score}${p.away.webName} · ${STATUS_LABEL[p.status] || p.status}`;
}

function field(labelText, control) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = labelText;
  wrap.append(label, control);
  return wrap;
}

function select(options, value) {
  const el = document.createElement('select');
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    el.appendChild(opt);
  }
  el.value = value;
  return el;
}

function button(text, onClick, disabled = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'performance-sync-btn';
  b.textContent = text;
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

export function renderChartsPanel(container, data, scoreboard, onDirty) {
  let disposed = false;
  let catalog = null;
  let status = null;
  let busy = false;
  const root = document.createElement('div');
  root.className = 'charts-panel';
  container.appendChild(root);

  const setStatus = (kind, text) => { status = { kind, text }; render(); };

  async function loadCatalog({ fresh = false } = {}) {
    const key = data.torneo || '';
    const cached = catalogCache.get(key);
    if (!fresh && cached && Date.now() - cached.at < CATALOG_TTL_MS) {
      catalog = cached.data;
      render();
      return;
    }
    busy = true;
    setStatus('loading', 'LEYENDO PARTIDOS DE GLA.FUTBOL...');
    try {
      const body = await getJson(`/api/charts/catalog?torneo=${encodeURIComponent(key)}${fresh ? '&fresh=1' : ''}`);
      catalogCache.set(body.torneo, { at: Date.now(), data: body });
      if (!key) catalogCache.set('', { at: Date.now(), data: body });
      if (disposed) return;
      catalog = body;
      if (!data.torneo) { data.torneo = body.torneo; onDirty(); }
      busy = false;
      status = body.partidos.length ? null : { kind: 'error', text: `${body.webName || 'El torneo'} todavía no publica partidos en gla.futbol (estado: ${body.webStatus || 'no publicado'}).` };
      if (!data.partido) preselect();
      render();
    } catch (err) {
      busy = false;
      if (!disposed) setStatus('error', `NO SE PUDO LEER GLA.FUTBOL: ${err.message}`);
    }
  }

  // Partido "actual": en juego y del Marcador > en juego > del Marcador sin terminar.
  function preselect() {
    const list = catalog?.partidos || [];
    const pick = list.find((p) => p.status === 'live' && isMarcadorMatch(p, scoreboard))
      || list.find((p) => p.status === 'live')
      || list.find((p) => p.status !== 'finished' && isMarcadorMatch(p, scoreboard));
    if (pick) {
      data.dia = pick.dia;
      data.partido = pick.key;
      onDirty();
    }
  }

  async function syncChart() {
    if (!data.torneo || !data.partido) {
      setStatus('error', 'Elegí un partido primero.');
      return;
    }
    busy = true;
    setStatus('loading', 'ACTUALIZANDO DESDE GLA.FUTBOL...');
    try {
      const body = await getJson('/api/charts/sync-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ torneo: data.torneo, partido: data.partido }),
      });
      data.chart = body.chart;
      data.ultimaActualizacionWeb = body.chart.fetchedAt;
      onDirty();
      busy = false;
      const m = body.chart.match;
      if (!disposed) setStatus('success', `CHART ACTUALIZADO: ${m.home.webName} ${m.home.score ?? '-'}-${m.away.score ?? '-'} ${m.away.webName} · ${m.events.length} incidencias. Si ya está al aire, apretá ACTUALIZAR.`);
    } catch (err) {
      busy = false;
      if (!disposed) setStatus('error', `NO SE PUDO ACTUALIZAR: ${err.message} (se conserva el último chart cargado).`);
    }
  }

  function useMarcadorMatch() {
    const list = catalog?.partidos || [];
    const candidates = list.filter((p) => isMarcadorMatch(p, scoreboard));
    const pick = candidates.find((p) => p.status === 'live')
      || candidates.find((p) => p.status !== 'finished')
      || candidates[candidates.length - 1];
    if (!pick) {
      setStatus('error', 'No hay un partido de este torneo con los equipos que tiene elegidos el Marcador.');
      return;
    }
    data.dia = pick.dia;
    data.partido = pick.key;
    onDirty();
    syncChart();
  }

  function render() {
    if (disposed) return;
    root.innerHTML = '';

    const desc = document.createElement('p');
    desc.className = 'performance-note';
    desc.textContent = 'Placa estadística con datos de gla.futbol. Elegí torneo, día y partido (★ = equipos del Marcador, ● = en juego) y el tipo de placa. Elegir un partido lo carga automáticamente; ACTUALIZAR DESDE WEB vuelve a leerlo.';
    root.appendChild(desc);

    const torneos = catalog?.torneos || [];
    const torneoSel = select(
      torneos.length
        ? torneos.map((t) => ({ value: t.key, label: `${t.label}${t.partidos ? '' : ' (sin partidos todavía)'}` }))
        : [{ value: data.torneo || '', label: busy ? 'Cargando...' : (data.chart?.torneo?.label || 'Sin datos') }],
      data.torneo || '',
    );
    torneoSel.disabled = busy || !torneos.length;
    torneoSel.addEventListener('change', () => {
      data.torneo = torneoSel.value;
      data.dia = '';
      data.partido = '';
      onDirty();
      loadCatalog();
    });
    root.appendChild(field('TORNEO', torneoSel));

    const dias = catalog?.dias || [];
    const diaSel = select([{ value: '', label: 'TODOS LOS DÍAS' }, ...dias.map((d) => ({ value: d.dia, label: d.label }))], data.dia || '');
    diaSel.disabled = busy || !dias.length;
    diaSel.addEventListener('change', () => {
      data.dia = diaSel.value;
      onDirty();
      render();
    });
    root.appendChild(field('DÍA', diaSel));

    const partidos = (catalog?.partidos || []).filter((p) => !data.dia || p.dia === data.dia);
    const partidoSel = select([{ value: '', label: partidos.length ? '— ELEGIR PARTIDO —' : 'SIN PARTIDOS' }, ...partidos.map((p) => ({ value: p.key, label: partidoLabel(p, scoreboard) }))], data.partido || '');
    if (data.partido && !partidos.some((p) => p.key === data.partido)) partidoSel.value = '';
    partidoSel.disabled = busy || !partidos.length;
    partidoSel.addEventListener('change', () => {
      data.partido = partidoSel.value;
      onDirty();
      if (data.partido) syncChart(); else render();
    });
    root.appendChild(field('PARTIDO', partidoSel));

    const tipoSel = select(TIPOS.map((t) => ({ value: t.id, label: t.label })), data.tipo || 'entretiempo');
    tipoSel.addEventListener('change', () => {
      data.tipo = tipoSel.value;
      onDirty();
    });
    root.appendChild(field('TIPO DE CHART', tipoSel));

    const actions = document.createElement('div');
    actions.className = 'performance-sync';
    actions.append(
      button('ACTUALIZAR DESDE WEB', syncChart, busy || !data.partido),
      button('USAR PARTIDO DEL MARCADOR', useMarcadorMatch, busy || !catalog),
      button('REFRESCAR LISTA', () => loadCatalog({ fresh: true }), busy),
    );
    if (status) {
      const st = document.createElement('span');
      st.className = `performance-sync-status ${status.kind}`;
      st.textContent = status.text;
      actions.appendChild(st);
    }
    root.appendChild(actions);

    const info = document.createElement('p');
    info.className = 'performance-note';
    const c = data.chart;
    info.textContent = c?.match
      ? `CARGADO: ${c.torneo.label} · ${c.match.fase} · ${c.match.home.webName} ${c.match.home.score ?? '-'}-${c.match.away.score ?? '-'} ${c.match.away.webName} · ${c.match.events.length} incidencias · leído ${new Date(c.fetchedAt).toLocaleTimeString()}`
      : 'TODAVÍA NO HAY UN PARTIDO CARGADO.';
    root.appendChild(info);
  }

  render();
  loadCatalog();
  return () => { disposed = true; };
}
