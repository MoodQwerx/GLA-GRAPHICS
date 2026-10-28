// Orquestacion de las 4 sincronizaciones manuales "ACTUALIZAR DATOS DE LA
// WEB" contra https://argentinastreamers.com (Goleadores, Asistidores,
// Participaciones, Historial). Las piezas comunes (fetch, extraccion del
// flight payload de RSC, matching de equipo, nombre de broadcast) viven en
// server/argentinaStreamersClient.js; este archivo solo arma, por modulo,
// que campo pedirle a "product" y como acomodarlo en la forma que ya
// espera cada panel/renderer de Argentina Streamers.
//
// Contrato identico al de server/glaFutbolSync.js (mismo patron ya
// probado en este proyecto para GLA, ver ese archivo): nunca tira los
// datos anteriores si algo falla (el caller -- server/index.js -- solo
// llama a applyUpdate() si la promesa resuelve), y jamas crea equipos
// nuevos en el catalogo local (rivales sin mapping quedan reportados, no
// inventados). Archivo deliberadamente separado de glaFutbolSync.js:
// aislamiento total entre los dos themes, cero imports cruzados.

import { ARGENTINA_STREAMERS_THEME_ID, getThemeTeams } from '../shared/themes.js';
import {
  fetchArgentinaStreamersHtml,
  extractMatches,
  matchLocalTeam,
  resolveHistoricalOpponentCrest,
  buildDorsalName,
  numberOr0,
} from './argentinaStreamersClient.js';
import {
  refreshArgentinaStreamersWebData,
  getWebEntry,
  normalizeRama,
  ramaForTeamId,
  statsForPlayer,
  TEAM_ID_BY_RAMA,
} from './argentinaStreamersWebData.js';

const MAX_ROWS = 10; // "modo cantidad" 10 SLOTS, ver program/js/renderers/performanceTable.js
const HISTORIAL_ROWS = 5; // mismo limite que master-control/js/historial-panel.js

// GOLEADORES / ASISTIDORES / PARTICIPACIONES (2026-10-08): leen SIEMPRE de
// ESTADISTICAS de la rama elegida (adaptador compartido,
// server/argentinaStreamersWebData.js), nunca de Convocados.
// "PARTICIPACIONES" <- tabla "Presencias" de la web (stats.appearances,
// columna "P") -- la web no publica ninguna tabla llamada
// "participaciones"; "Contribuciones" (G+A) es otra cosa y NO se usa aca.
const STATS_TABLES = {
  goleadores: { rowsKey: 'goleadores', statKey: 'g', label: 'GOLES' },
  asistidores: { rowsKey: 'asistidores', statKey: 'a', label: 'ASISTENCIAS' },
  jugadores: { rowsKey: 'presencias', statKey: 'pj', label: 'PRESENCIAS' },
};

// Contrato: { status: 'ok' | 'vacio' | 'error', ... }. Solo "ok" trae
// "jugadores" para reemplazar la tabla del modulo -- vacio/error nunca
// pisan lo que el operador ya tenia cargado (ver server/index.js).
// teamId por rama: masculino -> "argentina-streamers", femenino ->
// "argentina-streamers-fem" (el escudo solo se ve en modo 5 SLOTS).
export async function syncStatsTableFromWeb(moduleId, ramaInput) {
  const config = STATS_TABLES[moduleId];
  if (!config) throw new Error(`Tabla sin estadísticas web: ${moduleId}`);
  const rama = normalizeRama(ramaInput);
  const refresh = await refreshArgentinaStreamersWebData(['estadisticas']);
  const entry = getWebEntry('estadisticas', rama);
  const base = { rama, fuente: entry.fuente, ultimaActualizacion: entry.ultimaActualizacion };
  if (!refresh.ok) {
    return { ...base, status: 'error', mensaje: 'NO SE PUDO ACTUALIZAR — SE CONSERVAN LOS ÚLTIMOS DATOS VÁLIDOS', detalle: refresh.error };
  }
  const rows = entry.ultimoResultado === 'ok' ? (entry.data?.[config.rowsKey] || []) : [];
  if (!rows.length) {
    return { ...base, status: 'vacio', mensaje: `LA WEB NO PUBLICA ${config.label} PARA LA RAMA ${rama.toUpperCase()} — SE CONSERVAN LOS DATOS ACTUALES` };
  }
  const jugadores = rows.slice(0, MAX_ROWS).map((row) => ({
    teamId: TEAM_ID_BY_RAMA[rama],
    nombre: buildDorsalName(row.nombre, row.dorsal),
    webId: row.webId,
    g: 0, a: 0, pj: 0,
    [config.statKey]: numberOr0(row.count),
  }));
  return { ...base, status: 'ok', jugadores, totalEnLaWeb: rows.length };
}

// ESTRELLAS (rehecho 2026-10-08, pedido explicito del usuario): "ESTRELLA
// POR" GOLES / ASISTENCIAS / AMBOS, por cada lado cuyo equipo tiene datos
// web (argentina-streamers -> MASCULINO, argentina-streamers-fem ->
// FEMENINO). Nunca usa Convocados.
//   - GOLES:       primer jugador de la tabla de GOLEADORES de la rama.
//   - ASISTENCIAS: primer jugador de la tabla de ASISTIDORES de la rama.
//   - AMBOS:       primer jugador de CONTRIBUCIONES (G+A) de ESTADISTICAS
//                  (misma tabla/orden/desempate que la web). PARTICIPACIONES
//                  (= Presencias) NO es G+A y no se usa aca.
// Para GOLES/ASISTENCIAS se prefiere el "dataset local" que manda Master
// Control (primer jugador de SU tabla de Goleadores/Asistidores de esa
// rama, ya actualizada por el operador); si no existe, la tabla web.
// Los numeros G/A/PJ del elegido salen de SU PERFIL en la web (seccion
// JUGADORES) o, si no estuviera, de las tablas de ESTADISTICAS.
// Cache: solo se consulta la web si se pide "forzar" (boton ACTUALIZAR
// DESDE WEB) o si todavia no hay datos guardados de esa rama -- cambiar el
// criterio o hacer TAKE no consulta la web. Un lado rival queda "manual".
const ESTRELLA_CRITERIOS = {
  goles: { rowsKey: 'goleadores', label: 'GOLEADORES' },
  asistencias: { rowsKey: 'asistidores', label: 'ASISTIDORES' },
  ambos: { rowsKey: 'contribuciones', label: 'CONTRIBUCIONES (G+A)' },
};

function stripDorsal(nombre) {
  return String(nombre || '').replace(/^\s*\d+\s*[.)\-]?\s*/, '').trim();
}

export async function syncEstrellasFromWeb({ local, visitante, criterio, lideresLocales, forzar }) {
  const crit = ESTRELLA_CRITERIOS[criterio] ? criterio : 'ambos';
  const config = ESTRELLA_CRITERIOS[crit];
  const ramasPedidas = [...new Set([local, visitante].map(ramaForTeamId).filter(Boolean))];
  const sinDatos = ramasPedidas.some((rama) => !getWebEntry('estadisticas', rama).data || !getWebEntry('jugadores', rama).data);
  const refresh = (forzar || sinDatos) && ramasPedidas.length
    ? await refreshArgentinaStreamersWebData(['estadisticas', 'jugadores'])
    : { ok: true, desdeCache: true };

  const lados = {};
  for (const [lado, teamId] of Object.entries({ local, visitante })) {
    const rama = ramaForTeamId(teamId);
    if (!rama) {
      lados[lado] = { status: 'manual', mensaje: 'SIN DATOS WEB PARA ESTE EQUIPO — QUEDA LA CARGA MANUAL' };
      continue;
    }
    const est = getWebEntry('estadisticas', rama).data;
    const jugadoresWeb = getWebEntry('jugadores', rama).data?.jugadores || [];
    if (!est) {
      lados[lado] = { status: 'error', rama, mensaje: 'NO SE PUDO OBTENER ESTADÍSTICAS — SE CONSERVAN LOS DATOS ACTUALES', detalle: refresh.error };
      continue;
    }

    // 1. Quien es la estrella.
    const localRef = crit !== 'ambos' ? lideresLocales?.[rama]?.[crit] : null;
    const webRow = (est[config.rowsKey] || [])[0] || null;
    const ref = localRef && (localRef.webId || localRef.nombre) ? localRef : webRow;
    if (!ref) {
      lados[lado] = { status: 'vacio', rama, criterio: crit, mensaje: `LA WEB NO PUBLICA ${config.label} PARA LA RAMA ${rama.toUpperCase()}` };
      continue;
    }
    const nombreRef = stripDorsal(ref.nombre);
    const assoc = statsForPlayer(est, { webId: ref.webId || null, nombreCompleto: nombreRef, apodo: nombreRef, displayName: nombreRef });
    const webId = assoc.estado === 'ok' ? assoc.webId : (ref.webId || null);

    // 2. Sus numeros: perfil web de la seccion JUGADORES; si no, tablas.
    const perfilJugador = webId ? jugadoresWeb.find((p) => p.webId === webId) : null;
    const identity = perfilJugador || (webId ? est.jugadores.find((p) => p.webId === webId) : null) || null;
    let g;
    let a;
    let pj;
    let fuenteNumeros;
    if (perfilJugador?.perfil) {
      ({ goles: g, asistencias: a, presencias: pj } = perfilJugador.perfil);
      fuenteNumeros = 'perfil-web';
    } else if (assoc.estado === 'ok') {
      g = assoc.goles ?? 0;
      a = assoc.asistencias ?? 0;
      pj = assoc.presencias ?? 0;
      fuenteNumeros = 'tablas-web';
    } else {
      // Fila manual sin identidad web: solo se conoce el numero de la tabla.
      g = crit === 'goles' ? (ref.count ?? 0) : 0;
      a = crit === 'asistencias' ? (ref.count ?? 0) : 0;
      pj = 0;
      fuenteNumeros = 'tabla-local';
    }

    lados[lado] = {
      status: 'ok',
      rama,
      criterio: crit,
      origenEstrella: localRef && ref === localRef ? 'tabla-local' : 'web',
      fuenteNumeros,
      jugador: {
        dorsal: identity?.dorsal || ref.dorsal || '',
        nombre: identity?.nombre || '',
        apellido: identity?.apellido || '',
        apodo: identity?.apodo || (identity ? '' : nombreRef),
        nombreCompleto: identity?.nombreCompleto || nombreRef,
        webId,
      },
      g,
      a,
      pj,
      desdeCache: !!refresh.desdeCache || !refresh.ok,
    };
  }
  return { lados, criterio: crit, refresh };
}

// Categoria (2026-09-04, pedido explicito del usuario, valores estables
// usados por master-control/js/historial-panel.js) -> discriminador real
// confirmado en argentinastreamers.com: "competitionType" ('iwc' |
// 'copa_america' | 'friendly') + "friendlyType" ('official' | 'unofficial',
// solo relevante cuando competitionType es 'friendly'). Nunca se clasifica
// por texto visible (evita romperse si la web traduce/renombra un rotulo).
const CATEGORY_FILTERS = {
  iwc: (m) => m.competitionType === 'iwc',
  'copa-america': (m) => m.competitionType === 'copa_america',
  'amistosos-oficiales': (m) => m.competitionType === 'friendly' && m.friendlyType === 'official',
  amistosos: (m) => m.competitionType === 'friendly' && m.friendlyType === 'unofficial',
};

// "matches" mezcla resultados jugados con fixtures programados a futuro
// (campo "status") -- Historial es, por definicion, resultados YA
// jugados, asi que se filtra "finished" (decision confirmada con el
// usuario). Orden: mas reciente primero (fecha real de la web, nunca
// inventado).
// "rama" (2026-10-08): la seccion PARTIDOS de la web tiene su propio
// MASC/FEM (product.competitions vs product.fem.competitions) -- Historial
// la respeta. Nunca usa Convocados ni Estadisticas. Si la categoria no
// tiene ningun partido jugado en esa rama, "partidos" queda vacio y
// server/index.js NO pisa el historial actual.
export async function syncHistorialFromWeb(categoria, ramaInput) {
  const filterFn = CATEGORY_FILTERS[categoria];
  if (!filterFn) throw new Error(`Categoría de historial desconocida: "${categoria}".`);
  const rama = normalizeRama(ramaInput);

  const html = await fetchArgentinaStreamersHtml();
  const matches = extractMatches(html, rama);

  const catalog = getThemeTeams(ARGENTINA_STREAMERS_THEME_ID);
  const finished = matches
    .filter((m) => m?.status === 'finished' && filterFn(m))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (finished.length === 0) {
    return { partidos: [], totalEnLaWeb: 0, unmatchedTeams: [], rama };
  }

  const unmatchedTeams = new Set();
  const partidos = finished.slice(0, HISTORIAL_ROWS).map((m) => {
    const oppTeam = matchLocalTeam(m.opponent?.name, catalog);
    // Escudo de rival historico (2026-09-04): solo se busca cuando NO hay
    // equipo del catalogo local -- un teamId real siempre tiene prioridad
    // (setCrest() en el renderer respeta ese orden). Sin coincidencia en
    // NINGUNO de los dos catalogos, recien ahi se reporta "sin equipo".
    const historicalCrestUrl = !oppTeam ? resolveHistoricalOpponentCrest(m.opponent?.name) : null;
    if (!oppTeam && !historicalCrestUrl) unmatchedTeams.add(m.opponent?.name || '(sin nombre)');
    const wentToPenalties = m.penalties?.wentToPenalties === true;
    return {
      teamA: TEAM_ID_BY_RAMA[rama],
      golLocal: String(numberOr0(m.argentinaScore)),
      golVisitante: String(numberOr0(m.opponentScore)),
      teamB: oppTeam ? oppTeam.id : '',
      teamBCrestUrl: historicalCrestUrl || '',
      // Penales (2026-09-04, pedido explicito): SOLO si la web publico
      // "penalties.wentToPenalties":true -- nunca se infiere por empate
      // (ver informe: hay empates reales sin definicion por penales).
      penalLocal: wentToPenalties ? String(numberOr0(m.penalties.argentinaPenaltyScore)) : '',
      penalVisitante: wentToPenalties ? String(numberOr0(m.penalties.opponentPenaltyScore)) : '',
      // Fase/instancia (2026-09-04, pedido explicito): dato REAL de la web
      // ("stage", confirmado en vivo -- "FASE DE GRUPO IWC", "SEMIFINAL
      // ICC", "Amistoso", etc.), nunca inferido por la posicion del
      // partido. Vacio si la web no publico stage para ese encuentro.
      fase: String(m.stage || '').trim(),
    };
  });
  while (partidos.length < HISTORIAL_ROWS) {
    partidos.push({ teamA: '', golLocal: '', golVisitante: '', teamB: '', teamBCrestUrl: '', penalLocal: '', penalVisitante: '', fase: '' });
  }

  return { partidos, totalEnLaWeb: finished.length, unmatchedTeams: [...unmatchedTeams], rama };
}
