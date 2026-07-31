// Registro central de modulos de graficas.
// Agregar una grafica nueva = agregar una entrada aca (Master Control genera el
// panel solo a partir de "fields"; Program necesita ademas un renderer en
// program/js/renderers/<id>.js y su posicionamiento en program/css/overlay.css).
//
// Flags especiales que puede tener un modulo:
// - live: true       -> Program vuelve a renderizar cada 500ms mientras esta ON
//                        (para que un reloj se vea andar sin mensajes WS extra).
// - oneShot: true     -> el asset tiene su propia animacion de entrada Y salida
//                        adentro del archivo (ej. un festejo de gol, una
//                        transicion). Program avisa solo cuando el video
//                        termina y vuelve a OUT sin que el operador tenga que
//                        apretar Sacar.
// - autoRunClock: 'clock' -> al hacer Tomar al aire, Master Control arranca
//                        automaticamente ese campo de reloj desde 00:00
//                        (para piezas que son "un cronometro que se prende").
// - sequencedReveal: true -> Program (program/js/main.js) secuencia la entrada
//                        en dos tiempos: el asset entra solo, el contenido
//                        dinamico (".gfx-overlay": escudos, texto, numeros)
//                        se revela recien despues de que la animacion horneada
//                        del asset termina de asentarse. Al Sacar del aire se
//                        invierte: el contenido desaparece primero y recien
//                        despues sale el asset. No requiere nada del lado del
//                        renderer del modulo (ver program/css/overlay.css y
//                        program/js/main.js) — es logica 100% compartida.

import { FIELD_TYPES, PENALTY_KICK_STATUS } from './constants.js';
import { TEAM_COLORS } from './team-colors.js';
import { TEAM_OPTIONS } from './teams.js';
import { emptyClock } from './clock.js';

function penaltyKicksDefault(count) {
  return Array.from({ length: count }, () => ({ status: PENALTY_KICK_STATUS.PENDING }));
}

const TEAM_COLOR_OPTIONS = TEAM_COLORS.map((c) => ({ id: c.id, label: c.label }));

export const MATCH_STATUS_OPTIONS = [
  { id: '', label: 'Sin estado' },
  { id: 'proximo', label: 'A CONTINUACION' },
  { id: 'final', label: 'FINAL' },
  { id: 'entretiempo', label: 'ENTRETIEMPO' },
];

export const MODULES = {
  // ---------------------------------------------------------------------
  // MARCADOR
  // ---------------------------------------------------------------------
  // "teamA"/"teamB" guardan el ID del equipo (catalogo global, ver
  // shared/teams.js) — no texto libre ni un escudo por separado. Escudo y
  // abreviatura de 3 letras se resuelven SIEMPRE a partir de ese ID (ver
  // program/js/renderers/scoreboard.js), nunca se vuelven a cargar a mano;
  // todos los demas modulos que necesitan datos de equipo (Entretiempo,
  // Penales, Tarjetas, Cambios, VS Compacto) leen este mismo ID en vivo
  // desde "scoreboard" en vez de tener su propio campo de equipo.
  scoreboard: {
    id: 'scoreboard',
    label: 'Marcador principal',
    category: 'Marcador',
    layer: 'top-left',
    live: true,
    sequencedReveal: true,
    fields: [
      { key: 'teamA', label: 'Equipo local', type: FIELD_TYPES.SELECT, options: TEAM_OPTIONS },
      { key: 'teamAColor', label: 'Color de camiseta - local', type: FIELD_TYPES.SELECT, options: TEAM_COLOR_OPTIONS },
      { key: 'teamB', label: 'Equipo visitante', type: FIELD_TYPES.SELECT, options: TEAM_OPTIONS },
      { key: 'teamBColor', label: 'Color de camiseta - visitante', type: FIELD_TYPES.SELECT, options: TEAM_COLOR_OPTIONS },
      { key: 'scoreA', label: 'Goles local', type: FIELD_TYPES.TEXT },
      { key: 'scoreB', label: 'Goles visitante', type: FIELD_TYPES.TEXT },
      { key: 'period', label: 'Tiempo (ej. 1T, 2T)', type: FIELD_TYPES.TEXT },
    ],
    // El reloj (clock) se controla con un panel a medida en Master Control
    // (ver master-control/js/scoreboard-clock-panel.js), no con "fields".
    defaults: {
      teamA: '', teamB: '', teamAColor: 'gris', teamBColor: 'gris', scoreA: '0', scoreB: '0', period: '',
      clock: emptyClock(),
    },
  },

  marcadorTiempoAdicional: {
    id: 'marcadorTiempoAdicional',
    label: 'Tiempo adicional',
    category: 'Marcador',
    layer: 'top-left',
    live: true,
    autoRunClock: 'clock',
    fields: [
      { key: 'addedMinutes', label: 'Minutos agregados (ej. 5)', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      addedMinutes: '5', clock: emptyClock(),
    },
  },

  marcadorEntretiempo: {
    id: 'marcadorEntretiempo',
    label: 'Marcador - Entretiempo',
    category: 'Marcador',
    layer: 'top-left',
    // Sin fields propios: reutiliza en vivo los datos ya cargados en
    // "scoreboard" (escudos, colores, codigo de equipo, goles) — el
    // operador los edita una sola vez, desde el marcador principal. El
    // renderer de Program lee ese estado directamente (ver
    // program/js/renderers/marcadorEntretiempo.js). "live" hace que se
    // vuelva a pintar cada 500ms mientras esta al aire, para reflejar
    // cambios que el operador haga en el marcador principal sin tener
    // que tocar este modulo.
    live: true,
    sequencedReveal: true,
    fields: [],
    defaults: {},
  },

  marcadorPenales: {
    id: 'marcadorPenales',
    label: 'Marcador de penales (mejor de 3)',
    category: 'Marcador',
    layer: 'bottom-left-secondary',
    // Sin campos de equipo/color propios: se leen en vivo de "scoreboard"
    // (mismo patron que marcadorEntretiempo, ver program/js/renderers/
    // marcadorPenales.js) — el operador solo carga el estado de cada
    // penal, no vuelve a tipear el equipo.
    live: true,
    sequencedReveal: true,
    fields: [
      { key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT },
      { key: 'kicksA', label: 'Tandas equipo A', type: FIELD_TYPES.PENALTY_SERIES, count: 3 },
      { key: 'kicksB', label: 'Tandas equipo B', type: FIELD_TYPES.PENALTY_SERIES, count: 3 },
    ],
    defaults: {
      titulo: 'PENALES',
      kicksA: penaltyKicksDefault(3), kicksB: penaltyKicksDefault(3),
    },
  },

  // Reemplaza al ex "Shootout" (penales 1 c/u): mismo lugar en la familia
  // Marcador, logica completamente nueva y mas simple — asset propio
  // (imagen estatica, sin video), un solo campo de texto libre y el mismo
  // reloj automatico que ya usa "marcadorTiempoAdicional" (autoRunClock):
  // arranca solo al Tomar al aire, sin panel de Play/Pause propio. Se
  // renderiza DETRAS del marcador principal a proposito (ver orden de
  // nodos en program/index.html): el operador lo usa para asomar un
  // titulo por debajo de la barra del marcador ya al aire.
  marcadorZocalo: {
    id: 'marcadorZocalo',
    label: 'Marcador Zócalo',
    category: 'Marcador',
    layer: 'top-left-secondary',
    live: true,
    autoRunClock: 'clock',
    fields: [
      { key: 'titulo', label: 'TÍTULO', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      titulo: '', clock: emptyClock(),
    },
  },

  // ---------------------------------------------------------------------
  // PLACAS FULLSCREEN Y MID-FULL
  // ---------------------------------------------------------------------
  formacionEquipos: {
    id: 'formacionEquipos',
    label: 'Formacion',
    category: 'Placas',
    layer: 'fullscreen',
    live: true,
    sequencedReveal: true,
    fields: [
      {
        key: 'teamSide',
        label: 'EQUIPO A MOSTRAR',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'local', label: 'LOCAL' },
          { id: 'visitor', label: 'VISITANTE' },
        ],
      },
    ],
    defaults: {
      teamSide: 'local', starters: [], substitutes: [],
    },
  },

  vsPrepartido: {
    id: 'vsPrepartido',
    label: 'VS Prepartido',
    category: 'Placas',
    layer: 'fullscreen',
    live: true,
    sequencedReveal: true,
    fields: [],
    defaults: {},
  },

  vsResultado: {
    id: 'vsResultado',
    label: 'VS Con resultado',
    category: 'Placas',
    layer: 'fullscreen',
    live: true,
    sequencedReveal: true,
    fields: [],
    defaults: {},
  },

  // ---------------------------------------------------------------------
  // EVENTOS DEL PARTIDO
  // ---------------------------------------------------------------------
  // Un solo modulo/solapa para las 3 tarjetas (amarilla/roja/azul) — el campo
  // "tipo" elige la variante visual (que asset .mp4 se reproduce, ver
  // program/js/renderers/tarjeta.js), no hay 3 modulos ni 3 solapas
  // separadas. Sin campo de equipo/escudo propio: se lee en vivo de
  // "scoreboard" (`live: true`, mismo patron que marcadorPenales/
  // marcadorEntretiempo) segun lo que el operador elija en "equipo".
  tarjeta: {
    id: 'tarjeta',
    label: 'Tarjetas',
    category: 'Eventos',
    layer: 'bottom-left',
    live: true,
    sequencedReveal: true,
    fields: [
      {
        key: 'equipo',
        label: 'Equipo',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'local', label: 'Local' },
          { id: 'visitante', label: 'Visitante' },
        ],
      },
      {
        key: 'tipo',
        label: 'Tipo de tarjeta',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'amarilla', label: 'Amarilla' },
          { id: 'roja', label: 'Roja' },
          { id: 'azul', label: 'Azul' },
        ],
      },
      { key: 'jugador', label: 'Nombre del jugador', type: FIELD_TYPES.TEXT },
    ],
    defaults: { equipo: 'local', tipo: 'amarilla', jugador: '' },
  },

  // El asset tiene un unico casillero de escudo (una sustitucion es
  // siempre del mismo equipo para "entra"/"sale") — se lee en vivo de
  // "scoreboard" (`live: true`, mismo patron que `tarjeta`) segun el
  // campo "equipo" elegido por el operador.
  cambios: {
    id: 'cambios',
    label: 'Cambios',
    category: 'Eventos',
    layer: 'bottom-left',
    live: true,
    sequencedReveal: true,
    fields: [
      {
        key: 'equipo',
        label: 'Equipo',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'local', label: 'Local' },
          { id: 'visitante', label: 'Visitante' },
        ],
      },
      { key: 'entra', label: 'Entra', type: FIELD_TYPES.TEXT },
      { key: 'sale', label: 'Sale', type: FIELD_TYPES.TEXT },
      { key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT },
    ],
    defaults: { equipo: 'local', entra: '', sale: '', titulo: 'CAMBIO' },
  },

  gol: {
    id: 'gol',
    label: 'Gol',
    category: 'Eventos',
    layer: 'top-left-secondary',
    oneShot: true,
    fields: [],
    defaults: {},
  },

  // ---------------------------------------------------------------------
  // VAR / REPLAY
  // ---------------------------------------------------------------------
  varCheck: {
    id: 'varCheck',
    label: 'VAR Chequeo',
    category: 'VAR / Replay',
    layer: 'bottom-left-secondary',
    sequencedReveal: true,
    fields: [],
    defaults: {},
  },

  replay: {
    id: 'replay',
    label: 'Replay (con sponsor)',
    category: 'VAR / Replay',
    layer: 'bottom-left-secondary',
    sequencedReveal: true,
    fields: [
      { key: 'sponsor', label: 'Sponsor (opcional)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { sponsor: '' },
  },

  // ---------------------------------------------------------------------
  // MOSCA
  // ---------------------------------------------------------------------
  // Sin campos: la franja que antes mostraba un texto editable a mano
  // ahora muestra la hora actual del sistema, generada sola por el
  // renderer (ver program/js/renderers/bug.js) — Master Control solo
  // necesita Tomar/Sacar del aire, nada que tipear.
  bug: {
    id: 'bug',
    label: 'Mosca LocalStrike',
    category: 'Mosca',
    layer: 'top-right',
    sequencedReveal: true,
    fields: [],
    defaults: {},
  },

  // ---------------------------------------------------------------------
  // ZOCALOS
  // ---------------------------------------------------------------------
  // DESACTIVADO TEMPORALMENTE a pedido explicito del usuario (2026-07-31):
  // falta reemplazar el asset. Toda la logica (schema, renderer en
  // program/js/renderers/longSimple.js, registro en
  // program/js/renderers/index.js, nodo en program/index.html) se
  // conserva intacta, solo comentada — al no estar en MODULES/MODULE_IDS
  // el modulo desaparece solo del panel de Master Control (generado desde
  // este schema) y del loop de program/js/main.js, sin tocar ningun otro
  // archivo. Para reactivar cuando haya asset nuevo: descomentar este
  // bloque, el import+entrada en program/js/renderers/index.js, y el
  // <div id="mod-longSimple"> en program/index.html (buscar "DESACTIVADO
  // TEMPORALMENTE" en cada archivo).
  // longSimple: {
  //   id: 'longSimple',
  //   label: 'Zocalo largo simple',
  //   category: 'Zocalos',
  //   layer: 'bottom-wide',
  //   sequencedReveal: true,
  //   fields: [
  //     { key: 'text', label: 'Texto', type: FIELD_TYPES.TEXT },
  //   ],
  //   defaults: { text: '' },
  // },

  longDouble: {
    id: 'longDouble',
    label: 'Zocalo largo doble',
    category: 'Zocalos',
    layer: 'bottom-wide',
    sequencedReveal: true,
    fields: [
      { key: 'line1', label: 'Titulo principal', type: FIELD_TYPES.TEXT },
      { key: 'line2', label: 'Subtitulo / bajada', type: FIELD_TYPES.TEXT },
    ],
    defaults: { line1: '', line2: '' },
  },

  shortSimple: {
    id: 'shortSimple',
    label: 'Zocalo corto simple',
    category: 'Zocalos',
    layer: 'bottom-left',
    sequencedReveal: true,
    fields: [
      { key: 'text', label: 'Texto', type: FIELD_TYPES.TEXT },
    ],
    defaults: { text: '' },
  },

  shortDouble: {
    id: 'shortDouble',
    label: 'Zocalo corto doble',
    category: 'Zocalos',
    layer: 'bottom-left',
    sequencedReveal: true,
    fields: [
      { key: 'name', label: 'Nombre', type: FIELD_TYPES.TEXT },
      { key: 'role', label: 'Talento / Rol / Cargo', type: FIELD_TYPES.TEXT },
    ],
    defaults: { name: '', role: '' },
  },

  // Sin campos de equipo propios: equipo A/B (nombre, abreviatura y
  // escudo) se leen en vivo de "scoreboard" (`live: true`, mismo patron
  // que marcadorPenales/marcadorEntretiempo/tarjeta/cambios) — el VS
  // siempre anuncia el mismo partido cargado en el marcador principal, no
  // hace falta volver a elegir los equipos aca.
  vs: {
    id: 'vs',
    label: 'Zocalo VS compacto',
    category: 'Zocalos',
    layer: 'bottom-center',
    live: true,
    sequencedReveal: true,
    fields: [
      {
        key: 'renglon',
        label: 'Altura de renglon',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'normal', label: 'Normal' },
          { id: 'alto', label: 'Alto' },
          { id: 'medio', label: 'Medio' },
          { id: 'fino', label: 'Fino' },
        ],
      },
      { key: 'status', label: 'Estado del encuentro', type: FIELD_TYPES.SELECT, options: MATCH_STATUS_OPTIONS },
      {
        key: 'statusTexto',
        label: 'Texto libre del renglon central (opcional, reemplaza al Estado de arriba si se completa)',
        type: FIELD_TYPES.TEXT,
      },
      {
        key: 'goleadoresLocal',
        label: 'Goleadores Local (uno por linea, ej. "Perez 12\'") — entran aprox. 7 en Alto, 4 en Medio, 1 en Fino, ninguno en Normal',
        type: FIELD_TYPES.TEXTAREA,
      },
      {
        key: 'goleadoresVisitante',
        label: 'Goleadores Visitante (mismo formato y limite que Local)',
        type: FIELD_TYPES.TEXTAREA,
      },
    ],
    defaults: {
      renglon: 'normal', status: '', statusTexto: '', goleadoresLocal: '', goleadoresVisitante: '',
    },
  },

  // ---------------------------------------------------------------------
  // GRUPOS
  // ---------------------------------------------------------------------
  // Un unico modulo con un selector de variante ("variante": que PNG
  // mostrar, Grupo 1 o Grupo 2) en vez de dos modulos separados — mismo
  // criterio que Tarjeta (un campo elige que asset/variante se usa). Sin
  // "fields" genericos: el selector de variante y las filas (escudo +
  // nombre automaticos desde el catalogo de equipos + puntos) viven en un
  // panel dedicado (master-control/js/grupos-panel.js) porque la cantidad
  // de filas y el desplegable de equipo por fila no entran en el editor
  // generico de schema (FIELD_TYPES.LIST no soporta un SELECT por fila ni
  // una cantidad fija sin agregar/quitar — ver docs/ARCHITECTURE.md).
  // Cada variante guarda su propio arreglo de filas por separado (no
  // comparten datos entre si): son grupos de equipos distintos, cambiar
  // el selector no tiene por que pisar lo cargado en el otro grupo.
  // Cantidad de filas medida directamente sobre cada PNG (alfa/color real,
  // no a ojo): ambos assets traen exactamente 3 casilleros de equipo.
  grupos: {
    id: 'grupos',
    label: 'Grupos',
    category: 'Grupos',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      variante: 'grupo1',
      grupo1: { filas: [{ teamId: '', puntos: '' }, { teamId: '', puntos: '' }, { teamId: '', puntos: '' }] },
      grupo2: { filas: [{ teamId: '', puntos: '' }, { teamId: '', puntos: '' }, { teamId: '', puntos: '' }] },
    },
  },

  // ---------------------------------------------------------------------
  // Sin asset nuevo todavia (se mantienen del sistema anterior)
  // ---------------------------------------------------------------------
  sideTable: {
    id: 'sideTable',
    label: 'Tabla lateral derecha',
    category: 'Tablas',
    layer: 'right',
    fields: [
      { key: 'title', label: 'Titulo tabla', type: FIELD_TYPES.TEXT },
      {
        key: 'items',
        label: 'Resultados',
        type: FIELD_TYPES.LIST,
        itemLabel: 'Resultado',
        itemFields: [
          { key: 'teamA', label: 'Equipo A', type: FIELD_TYPES.TEXT },
          { key: 'scoreA', label: 'Goles A', type: FIELD_TYPES.TEXT },
          { key: 'teamB', label: 'Equipo B', type: FIELD_TYPES.TEXT },
          { key: 'scoreB', label: 'Goles B', type: FIELD_TYPES.TEXT },
        ],
      },
    ],
    defaults: {
      title: 'RESULTADOS', items: [],
    },
  },

  upcoming: {
    id: 'upcoming',
    label: 'Proximos encuentros',
    category: 'Tablas',
    layer: 'bottom-left-vertical',
    fields: [
      { key: 'title', label: 'Titulo', type: FIELD_TYPES.TEXT },
      {
        key: 'items',
        label: 'Partidos',
        type: FIELD_TYPES.LIST,
        itemLabel: 'Partido',
        itemFields: [
          { key: 'teamA', label: 'Equipo A', type: FIELD_TYPES.TEXT },
          { key: 'teamB', label: 'Equipo B', type: FIELD_TYPES.TEXT },
          { key: 'info', label: 'Fecha / hora / competicion', type: FIELD_TYPES.TEXT },
        ],
      },
    ],
    defaults: {
      title: 'PROXIMOS ENCUENTROS', items: [],
    },
  },
};

export const MODULE_IDS = Object.keys(MODULES);

export function cloneDefaults(moduleId) {
  return JSON.parse(JSON.stringify(MODULES[moduleId].defaults));
}
