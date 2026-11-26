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
import { SPONSOR_OPTIONS } from './sponsors.js';
import { emptyClock } from './clock.js';
import { ARGENTINA_STREAMERS_THEME_ID, THEMES } from './themes.js';
import { deepMergeAdjustFields } from './adjust-path.js';

function penaltyKicksDefault(count) {
  return Array.from({ length: count }, () => ({ status: PENALTY_KICK_STATUS.PENDING }));
}

// "textAdjust" (2026-08-14, pedido explicito del usuario: herramienta de
// edicion manual de posicion X/Y y tamaño por CADA campo de texto de los
// zocalos, sin tocar codigo). Cada clave de este objeto es el mismo "key"
// del campo (o una ruta "grupo.campo" para datos anidados, ver
// "shortDouble" mas abajo) y guarda { dx, dy, dSize } en pixeles logicos
// -- se persiste junto con el resto de "data" del modulo (mismo mecanismo
// que ya existia, server/state.js no necesito ningun cambio) y Program lo
// aplica como una capa ADICIONAL sobre la posicion/tamaño de diseño (ver
// applyFittedText en program/js/text-fit.js), nunca reemplazandola --
// resetear un campo es simplemente volver su entrada a {dx:0,dy:0,dSize:0}.
function textAdjustDefaults(...keys) {
  return Object.fromEntries(keys.map((key) => [key, { dx: 0, dy: 0, dSize: 0 }]));
}

const TEAM_COLOR_OPTIONS = TEAM_COLORS.map((c) => ({ id: c.id, label: c.label }));

export const MATCH_STATUS_OPTIONS = [
  { id: '', label: 'Sin estado' },
  { id: 'proximo', label: 'A CONTINUACION' },
  { id: 'final', label: 'FINAL' },
  { id: 'entretiempo', label: 'ENTRETIEMPO' },
];

// COPA 4 NACIONES: ajuste independiente de capas por módulo (fondo PNG /
// contenido / tamaño de texto / espaciado). Nombres terminados en
// OffsetX/OffsetY/Scale: Program los aplica en vivo (ver isVisualKey).
const C4N_LAYER = {
  bgOffsetX: 0, bgOffsetY: 0, bgScale: 1,
  contentOffsetX: 0, contentOffsetY: 0, contentScale: 1,
  fontScale: 1, spacingScale: 1,
};
// GLA SUPERCOPA: mismo ajuste de capas, constante propia (no depende de C4N).
const SC_LAYER = {
  bgOffsetX: 0, bgOffsetY: 0, bgScale: 1,
  contentOffsetX: 0, contentOffsetY: 0, contentScale: 1,
  fontScale: 1, spacingScale: 1,
};

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
      // "scoreA"/"scoreB" (BLOQUE 2, 2026-09-09, pedido explicito del
      // usuario: "eliminar los textbox/input numéricos manuales actuales
      // para goles"): pasan de TEXT editable a ADJUST_ONLY -- mismo
      // criterio que "period"/"clock"/"nameA"/"nameB" mas abajo, el VALOR
      // ya no se tipea aca (ahora exclusivamente via los botones +/-/RESET
      // del panel dedicado, ver scoreboard-clock-panel.js), pero la
      // posicion/tamaño se sigue ajustando igual (arrows inline para GLA,
      // acordeon AJUSTE DE COMPOSICIÓN para Argentina Streamers -- ningun
      // cambio en ADJUST_REGISTRY, sigue apuntando a "scoreA"/"scoreB").
      { key: 'scoreA', label: 'Goles local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'scoreB', label: 'Goles visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'sponsor', label: 'Sponsor Marcador', type: FIELD_TYPES.SELECT, options: SPONSOR_OPTIONS.scoreboard },
      // "nameA"/"nameB"/"clock" (2026-08-15, auditoria completa): no se
      // tipean aca (la abreviatura sale del equipo elegido arriba, el reloj
      // corre solo) pero igual son texto visible en Program -> ADJUST_ONLY,
      // mismo mecanismo que un campo TEXT adjustable, sin input de texto.
      { key: 'nameA', label: 'Abreviatura equipo local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'nameB', label: 'Abreviatura equipo visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'clock', label: 'Reloj (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      // "period" (2026-08-15, pedido explicito del usuario: botones 1T/2T/
      // ET/PERSONALIZADO en vez de un input de texto suelto) -- el TEXTO
      // libre se tipea ahora desde el panel a medida
      // (master-control/js/scoreboard-clock-panel.js), pero el AJUSTE de
      // posicion/tamaño sigue siendo generico -> ADJUST_ONLY, mismo criterio
      // que "clock" arriba.
      { key: 'period', label: 'Período / tiempo (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    // El reloj (clock, arranque/pausa) y el periodo (botones 1T/2T/ET/
    // personalizado) se controlan con un panel a medida en Master Control
    // (ver master-control/js/scoreboard-clock-panel.js), no con "fields" --
    // el AJUSTE de posicion/tamaño de sus textos si se resuelve con los
    // campos ADJUST_ONLY de arriba, generico.
    defaults: {
      teamA: '', teamB: '', teamAColor: 'gris', teamBColor: 'gris', scoreA: '0', scoreB: '0', period: '',
      clock: emptyClock(),
      // "clockEndText" (2026-08-15, pedido explicito del usuario: "FIN DEL
      // CONTADOR" configurable, default 15:00) -- ver shared/clock.js
      // (parseClockLimit) y program/js/renderers/scoreboard.js.
      clockEndText: '15:00',
      sponsor: '',
      // "teamColorAssignments" (2026-08-16, pedido explicito del usuario:
      // "ASIGNAR COLOR AL EQUIPO"): mapa persistente { teamId: colorId }.
      // Al elegir un equipo en "teamA"/"teamB", si existe una entrada aca
      // se autocompleta "teamAColor"/"teamBColor" con ese color (ver
      // master-control/js/main.js); el boton de asignar lo escribe/pisa
      // (master-control/js/scoreboard-clock-panel.js). Cambiar el color
      // sin apretar el boton es solo temporal, no toca este mapa.
      teamColorAssignments: {},
      textAdjust: textAdjustDefaults('scoreA', 'scoreB', 'period', 'nameA', 'nameB', 'clock'),
      // "localCrestOffset*/awayCrestOffset*/separatorOffset*" (2026-08-31,
      // pedido explicito del usuario: cada elemento del marcador debe
      // poder moverse/escalarse por separado -- ver
      // master-control/js/composition-control.js). Mismo criterio que
      // "compositionOffsetX/Y/Scale" (COMPOSITION_DEFAULTS mas abajo):
      // sufijo "OffsetX"/"OffsetY"/"Scale" para que program/js/main.js
      // ("isVisualKey") los trate como ajuste visual en vivo sin cambios
      // ahi. Default 0/0/1 = no-op -- GLA nunca los toca desde su panel
      // (el acordeon nuevo es exclusivo de Argentina Streamers, ver
      // master-control/js/main.js) pero quedan disponibles para cualquier
      // theme sin romper nada.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      separatorOffsetX: 0, separatorOffsetY: 0, separatorScale: 1,
      // "sponsorOffsetX/Y/Scale" (2026-08-31, auditoria completa de
      // edicion individual): el logo de sponsor del Marcador nunca tuvo
      // ajuste propio.
      sponsorOffsetX: 0, sponsorOffsetY: 0, sponsorScale: 1,
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
      { key: 'addedMinutes', label: 'Minutos agregados (ej. 5)', type: FIELD_TYPES.TEXT, adjustable: true },
      // "autoTake" (2026-09-27, pedido explicito del usuario): si el TAKE
      // automatico al llegar a FIN DEL CONTADOR del Marcador principal
      // esta habilitado. String 'si'/'no' (mismo criterio que cualquier
      // otro campo SELECT del proyecto) -- persistido junto al resto de
      // "data" de este modulo, sin mecanismo nuevo. Default 'si': mismo
      // comportamiento de siempre para quien no lo toque.
      { key: 'autoTake', label: 'AUTOMÁTICO', type: FIELD_TYPES.SELECT, options: [{ id: 'si', label: 'SÍ' }, { id: 'no', label: 'NO' }] },
      { key: 'clock', label: 'Reloj (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: {
      addedMinutes: '5', clock: emptyClock(), autoTake: 'si',
      textAdjust: textAdjustDefaults('addedMinutes', 'clock'),
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
    // "nameA"/"nameB"/"scoreA"/"scoreB" (2026-08-15, auditoria completa):
    // los 4 textos visibles se derivan en vivo de "scoreboard" (arriba) sin
    // campo propio -- ADJUST_ONLY les da el editor de posicion/tamaño
    // igual que a cualquier otro texto, sin agregar un input que duplicaria
    // la carga de datos.
    fields: [
      { key: 'nameA', label: 'Abreviatura equipo local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'nameB', label: 'Abreviatura equipo visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'scoreA', label: 'Gol local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'scoreB', label: 'Gol visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: {
      // "separador" (2026-09-04, pedido explicito del usuario, exclusivo
      // Argentina Streamers -- ver shared/adjust-registry.js "themeOnly"):
      // editor propio para el "-" entre los goles.
      textAdjust: textAdjustDefaults('nameA', 'nameB', 'scoreA', 'scoreB', 'separador'),
      // "localCrestOffset*/awayCrestOffset*" (2026-08-31, auditoria
      // completa): los escudos nunca tuvieron ajuste propio, solo src-swap.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
    },
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
      { key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'kicksA', label: 'Tandas equipo A', type: FIELD_TYPES.PENALTY_SERIES, count: 3 },
      { key: 'kicksB', label: 'Tandas equipo B', type: FIELD_TYPES.PENALTY_SERIES, count: 3 },
      { key: 'nameA', label: 'Abreviatura equipo local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'nameB', label: 'Abreviatura equipo visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      // "scoreA"/"scoreB" (2026-08-31, corrección explícita del usuario):
      // dejaron de mostrar el resultado del PARTIDO (sb.scoreA/scoreB) —
      // ahora Program calcula el resultado de la TANDA DE PENALES en vivo
      // a partir de "kicksA"/"kicksB" (cuenta de intentos en 'scored'), ver
      // program/js/renderers/marcadorPenales.js. Este campo sigue siendo
      // solo de posición/tamaño (el numero no se tipea, se calcula solo).
      { key: 'scoreA', label: 'Resultado de penales local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'scoreB', label: 'Resultado de penales visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      // "sponsor" (2026-08-31, pedido explicito del usuario): mismo
      // catalogo/categoria que Zocalo VS Compacto ("vs_compact"), sin
      // inventar un catalogo nuevo.
      { key: 'sponsor', label: 'Sponsor Penales', type: FIELD_TYPES.SELECT, options: SPONSOR_OPTIONS.vs_compact },
    ],
    defaults: {
      titulo: 'PENALES',
      kicksA: penaltyKicksDefault(3), kicksB: penaltyKicksDefault(3),
      sponsor: '',
      // "suddenDeath" (2026-08-15, pedido explicito del usuario: indicar
      // MUERTE SUBITA sin inventar un asset nuevo) -- toggle desde un panel
      // a medida (ver master-control/js/penales-panel.js). Cuando esta en
      // true, el renderer (program/js/renderers/marcadorPenales.js) le
      // agrega " — MUERTE SÚBITA" al mismo titulo de siempre, reusando la
      // zona/auto-ajuste de fuente que ya existe para ese texto -- no es un
      // campo de texto propio, no se persiste por separado del titulo.
      suddenDeath: false,
      textAdjust: textAdjustDefaults('titulo', 'nameA', 'nameB', 'scoreA', 'scoreB', 'nombreLocal', 'nombreVisitante'),
      // "localCrestOffset*/awayCrestOffset*" (2026-08-31, auditoria
      // completa): los escudos nunca tuvieron ajuste propio, solo src-swap.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      // "kicksLocalOffset*/kicksVisitanteOffset*" (2026-08-31, pedido
      // explicito del usuario): cada fila de circulos de penales se mueve
      // como grupo, independiente del escudo y del resultado.
      kicksLocalOffsetX: 0, kicksLocalOffsetY: 0, kicksLocalScale: 1,
      kicksVisitanteOffsetX: 0, kicksVisitanteOffsetY: 0, kicksVisitanteScale: 1,
      // "kickLocal{1-5}Offset*"/"kickVisitante{1-5}Offset*" (2026-09-01,
      // pedido explicito del usuario: "no quiero seguir pidiendote mover
      // circulos a mano en codigo... quiero CONTROL TOTAL desde Master
      // Control"). Capa ADITIVA por-circulo, encima de la posicion base ya
      // definida en program/css/overlay.css (que sigue existiendo como
      // default -- "los defaults pueden existir") y de "kicksLocalOffset*"
      // (que sigue moviendo la FILA completa como grupo) -- 0/0/1 es un
      // no-op, cada circulo queda exactamente donde esta hoy hasta que el
      // operador lo ajuste y confirme con GUARDAR POSICIÓN. Solo tiene
      // panel propio para Argentina Streamers (ver "themeOnly" en
      // shared/adjust-registry.js) -- GLA nunca los toca ni los ve.
      kickLocal1OffsetX: 0, kickLocal1OffsetY: 0, kickLocal1Scale: 1,
      kickLocal2OffsetX: 0, kickLocal2OffsetY: 0, kickLocal2Scale: 1,
      kickLocal3OffsetX: 0, kickLocal3OffsetY: 0, kickLocal3Scale: 1,
      kickLocal4OffsetX: 0, kickLocal4OffsetY: 0, kickLocal4Scale: 1,
      kickLocal5OffsetX: 0, kickLocal5OffsetY: 0, kickLocal5Scale: 1,
      kickVisitante1OffsetX: 0, kickVisitante1OffsetY: 0, kickVisitante1Scale: 1,
      kickVisitante2OffsetX: 0, kickVisitante2OffsetY: 0, kickVisitante2Scale: 1,
      kickVisitante3OffsetX: 0, kickVisitante3OffsetY: 0, kickVisitante3Scale: 1,
      kickVisitante4OffsetX: 0, kickVisitante4OffsetY: 0, kickVisitante4Scale: 1,
      kickVisitante5OffsetX: 0, kickVisitante5OffsetY: 0, kickVisitante5Scale: 1,
      // "separatorOffset*" (2026-08-31): guión entre el resultado local y
      // visitante de la tanda de penales -- mismo criterio que el guión
      // del Marcador principal (scoreboard.separatorOffsetX/Y/Scale).
      separatorOffsetX: 0, separatorOffsetY: 0, separatorScale: 1,
      // "sponsorOffsetX/Y/Scale" (2026-08-31): unico elemento visual del
      // sponsor, nunca tuvo ajuste propio.
      sponsorOffsetX: 0, sponsorOffsetY: 0, sponsorScale: 1,
      // "nombreLocal/VisitanteMode/Manual" (2026-09-01, pedido explicito
      // del usuario): mismo mecanismo que VS Prepartido/VS Resultado, ver
      // shared/broadcast-names.js. Solo se muestra/usa para Argentina
      // Streamers -- inocuo para GLA (nunca se lee ahi).
      nombreLocalMode: 'auto', nombreLocalManual: '',
      nombreVisitanteMode: 'auto', nombreVisitanteManual: '',
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
      { key: 'titulo', label: 'TÍTULO', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'clock', label: 'Reloj (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: {
      titulo: '', clock: emptyClock(),
      // "clockEndText" (2026-08-15, pedido explicito del usuario: "FIN DEL
      // CONTADOR" configurable, default 06:00 para Marcador Zocalo) -- ver
      // shared/clock.js (parseClockLimit) y
      // master-control/js/live-clock-display.js.
      clockEndText: '06:00',
      textAdjust: textAdjustDefaults('titulo', 'clock'),
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
    // Sin "teamSide" generico aca: el selector LOCAL/VISITANTE vive en el
    // panel dedicado (master-control/js/formation-list-panel.js), que
    // ademas de mostrar el toggle tiene que disparar la secuencia
    // OUT->cargar preset->TAKE cuando el modulo esta al aire (ver ese
    // archivo y master-control/js/main.js) -- el editor generico de
    // campos (field-editors.js) no tiene forma de engancharse a eso.
    fields: [],
    defaults: {
      teamSide: 'local',
      // "starters"/"substitutes" son SIEMPRE el contenido activo (lo que
      // lee program/js/renderers/formacionEquipos.js) -- el panel los
      // mantiene sincronizados con "presets[teamSide]" en cada edicion.
      // "presets" guarda titulares+suplentes de cada equipo por separado
      // (2026-08-05, pedido explicito del usuario: preparar ambas
      // formaciones con anticipacion sin que se mezclen entre si).
      starters: [], substitutes: [],
      presets: {
        local: { starters: [], substitutes: [] },
        visitor: { starters: [], substitutes: [] },
      },
      // "playerName"/"playerNumber" (2026-08-15, auditoria completa): un
      // unico ajuste compartido por las 6 posiciones de titulares (misma
      // clase visual en el asset, ver program/js/renderers/
      // formacionEquipos.js) -- "subsTitle" es el rotulo fijo "SUPLENTES",
      // "subsList" es el bloque completo de la lista de suplentes.
      textAdjust: textAdjustDefaults('playerName', 'playerNumber', 'subsTitle', 'subsList'),
      // "crestOffsetX/Y/Scale" (2026-08-31, auditoria completa): el escudo
      // del equipo activo nunca tuvo ajuste propio, solo src-swap.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
  },

  vsPrepartido: {
    id: 'vsPrepartido',
    label: 'VS Prepartido',
    category: 'Placas',
    layer: 'fullscreen',
    live: true,
    sequencedReveal: true,
    fields: [
      { key: 'titulo', label: 'TÍTULO', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'nameA', label: 'Nombre equipo local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'nameB', label: 'Nombre equipo visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: {
      titulo: 'PRÓXIMO PARTIDO',
      titlePresets: [],
      textAdjust: textAdjustDefaults('titulo', 'nameA', 'nameB'),
      // "localCrestOffset*/awayCrestOffset*" (2026-08-31, auditoria
      // completa): los escudos nunca tuvieron ajuste propio.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      // "nameXMode"/"nameXManual" (2026-09-01, pedido explicito del
      // usuario: "los nombres actuales quedan mal visualmente" -- ver
      // shared/broadcast-names.js). "auto" (default) resuelve un nombre
      // de BROADCAST propio para los 4 equipos de Argentina Streamers sin
      // tocar el nombre real del equipo; cualquier otro teamId (todos los
      // de GLA) cae exactamente en "teamName()" de siempre, cero cambio
      // visual ahi. El control en Master Control solo se muestra para
      // Argentina Streamers (ver renderPanel() en main.js) -- estos
      // defaults son inocuos para GLA aunque el campo exista en su arbol
      // de datos.
      nameAMode: 'auto', nameAManual: '',
      nameBMode: 'auto', nameBManual: '',
    },
  },

  vsResultado: {
    id: 'vsResultado',
    label: 'VS Con resultado',
    category: 'Placas',
    layer: 'fullscreen',
    live: true,
    sequencedReveal: true,
    fields: [
      { key: 'titulo', label: 'TÍTULO', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'nameA', label: 'Nombre equipo local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'nameB', label: 'Nombre equipo visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'scoreA', label: 'Gol local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'scoreB', label: 'Gol visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: {
      titulo: 'RESULTADO',
      titlePresets: [],
      // "scoreSep" (guion dinamico entre goles): RETIRADO para GLA
      // (2026-09-27, su asset ya trae el guion) y VUELTO solo para
      // ARGENTINA STREAMERS (2026-10-08, pedido explicito: "agregar un guion
      // dinamico entre GOL LOCAL y GOL VISITANTE" con ajuste propio). El
      // nodo existe siempre en el renderer pero solo se muestra con
      // body[data-theme='argentinaStreamers'] (ver overlay.css); el control
      // de ajuste es "themeOnly" en shared/adjust-registry.js.
      textAdjust: textAdjustDefaults('titulo', 'nameA', 'nameB', 'scoreA', 'scoreB', 'scoreSep'),
      // "localCrestOffset*/awayCrestOffset*" (2026-08-31, auditoria
      // completa): los escudos nunca tuvieron ajuste propio.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      // "nameXMode"/"nameXManual" (2026-09-01): mismo mecanismo que
      // vsPrepartido, ver el comentario ahi y shared/broadcast-names.js.
      nameAMode: 'auto', nameAManual: '',
      nameBMode: 'auto', nameBManual: '',
    },
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
      { key: 'jugador', label: 'Nombre del jugador', type: FIELD_TYPES.TEXT, adjustable: true },
    ],
    defaults: {
      equipo: 'local', tipo: 'amarilla', jugador: '', textAdjust: textAdjustDefaults('jugador'),
      // "crestOffsetX/Y/Scale" (2026-08-31, pedido explicito del usuario:
      // extender la edicion individual a todo el software) -- el escudo
      // de este modulo nunca tuvo ajuste propio, solo src-swap (ver
      // program/js/renderers/tarjeta.js). Default 0/0/1 = no-op, ver
      // shared/adjust-registry.js.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
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
      { key: 'entra', label: 'Entra', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'sale', label: 'Sale', type: FIELD_TYPES.TEXT, adjustable: true },
    ],
    // "titulo" ELIMINADO (2026-09-01, pedido explicito del usuario: "NO
    // QUIERO TÍTULO... eliminar completamente de la lógica operativa y del
    // panel"). Sin campo, sin default, sin textAdjust -- el modulo queda
    // enfocado en equipo/escudo/entra/sale, ver program/js/renderers/
    // cambios.js (ya no tiene ningun rastro de titulo tampoco).
    defaults: {
      equipo: 'local', entra: '', sale: '',
      textAdjust: textAdjustDefaults('entra', 'sale'),
      // "crestOffsetX/Y/Scale" (2026-08-31, pedido explicito del usuario):
      // mismo criterio que "tarjeta" -- el escudo nunca tuvo ajuste propio.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
  },

  gol: {
    id: 'gol',
    label: 'Gol',
    category: 'Eventos',
    layer: 'top-left-secondary',
    oneShot: true,
    fields: [],
    // "golRelativoMarcador" (2026-10-21, solo GLA lo usa): marca que su
    // composicion ya es el ajuste fino RELATIVO al Marcador (ver la
    // migracion unica en server/state.js). Inocuo para Argentina Streamers.
    defaults: { golRelativoMarcador: true },
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
    fields: [
      { key: 'sponsor', label: 'Sponsor VAR', type: FIELD_TYPES.SELECT, options: SPONSOR_OPTIONS.var },
      // "motivoPreset" (2026-08-15, pedido explicito del usuario): selector
      // con 3 textos predefinidos + PERSONALIZADO. Elegir un preset
      // autocompleta "motivo" (logica en master-control/js/main.js, mismo
      // patron que el auto-completado de LOCAL/VISITANTE en Tarjetas/
      // Cambios) -- "motivo" sigue siendo el mismo campo TEXT de siempre,
      // con su editor de posicion/tamaño intacto (adjustable:true), asset
      // cortito, animaciones y logica TAKE/UPDATE/OUT sin cambios.
      {
        key: 'motivoPreset',
        label: 'Motivo',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'posible_penal', label: 'POSIBLE PENAL' },
          { id: 'gol_no_valido', label: 'GOL NO VÁLIDO' },
          { id: 'posible_roja', label: 'POSIBLE ROJA' },
          { id: 'personalizado', label: 'PERSONALIZADO' },
        ],
      },
      { key: 'motivo', label: 'Texto Motivo', type: FIELD_TYPES.TEXT, adjustable: true },
    ],
    defaults: {
      sponsor: '', motivoPreset: 'posible_penal', motivo: 'POSIBLE PENAL',
      compositionOffsetX: 0, compositionOffsetY: 0, compositionScale: 1,
      motivoOffsetX: 0, motivoOffsetY: 0, motivoScale: 1,
      textAdjust: textAdjustDefaults('motivo'),
      // "sponsorOffsetX/Y/Scale" (2026-08-31, pedido explicito del
      // usuario): el logo de sponsor nunca tuvo ajuste propio (solo
      // fade-swap, ver program/js/renderers/varCheck.js).
      sponsorOffsetX: 0, sponsorOffsetY: 0, sponsorScale: 1,
      // "varGroupOffsetX/Y/Scale" (2026-08-31): antes de este campo,
      // ".ov-var-group1" (clip VAR + sponsor) leia manualmente las MISMAS
      // keys que "compositionOffsetX/Y/Scale" (COMPOSICION COMPLETA, ver
      // COMPOSITION_DEFAULTS mas abajo) -- como ese grupo es hijo de
      // ".content" y "COMPOSICION COMPLETA" YA mueve ".content" entero,
      // el offset se aplicaba DOS VECES (compuesto) sobre group1 mientras
      // que ".ov-var-motivo-group" solo lo heredaba una vez de ".content"
      // -- rompia el requisito de que "Composicion completa" mueva TODO
      // el modulo como una unidad rigida. Se separa en un campo propio
      // para que group1 tenga su ajuste fino independiente sin volver a
      // leer las keys universales.
      varGroupOffsetX: 0, varGroupOffsetY: 0, varGroupScale: 1,
    },
  },

  replay: {
    id: 'replay',
    label: 'Replay (con sponsor)',
    category: 'VAR / Replay',
    layer: 'bottom-left-secondary',
    sequencedReveal: true,
    fields: [
      { key: 'sponsor', label: 'Sponsor REPLAY', type: FIELD_TYPES.SELECT, options: SPONSOR_OPTIONS.var },
    ],
    defaults: {
      sponsor: '',
      // "sponsorOffsetX/Y/Scale" (2026-08-31, pedido explicito del
      // usuario): unico elemento visual de este modulo, nunca tuvo ajuste.
      sponsorOffsetX: 0, sponsorOffsetY: 0, sponsorScale: 1,
    },
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
    // "clock" (2026-08-15, auditoria completa): unico texto dinamico real
    // de este modulo (hora del sistema, sin campo tipeable) -> ADJUST_ONLY.
    // ".ov-mosca-vivo" ("VIVO") NO se incluye a proposito: esta oculto por
    // CSS (display:none, ver overlay.css) porque el "VIVO" real ya viene
    // horneado en el video (ver program/js/renderers/bug.js) -- no es texto
    // visible en Program, agregarle un editor no tendria ningun efecto.
    fields: [
      { key: 'clock', label: 'Hora (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: { textAdjust: textAdjustDefaults('clock') },
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
      { key: 'line1', label: 'Titulo principal', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'line2', label: 'Subtitulo / bajada', type: FIELD_TYPES.TEXT, adjustable: true },
    ],
    defaults: {
      line1: '', line2: '', textPresets: [],
      textAdjust: textAdjustDefaults('line1', 'line2'),
    },
  },

  shortSimple: {
    id: 'shortSimple',
    label: 'Zocalo corto simple',
    category: 'Zocalos',
    layer: 'bottom-left',
    sequencedReveal: true,
    fields: [
      { key: 'text', label: 'Texto', type: FIELD_TYPES.TEXT, adjustable: true },
    ],
    defaults: {
      text: '', textPresets: [],
      textAdjust: textAdjustDefaults('text'),
    },
  },

  // "airMode" (2026-08-06, pedido explicito del usuario: poder mostrar uno
  // o dos zocalos cortos dobles a la vez, ej. dos relatores juntos):
  // 'single' reusa exactamente la logica/posicion de siempre ("name"/
  // "role"); 'double' muestra dos instancias independientes del mismo
  // renderer/asset lado a lado ("double1"/"double2"), ver
  // program/js/renderers/shortDouble.js. Sin "fields" generico: el panel
  // dedicado (master-control/js/short-double-panel.js) tiene que mostrar
  // las tres secciones (individual + doble 1 + doble 2) y los controles de
  // aire propios -- mismo criterio que Formacion (fields: []).
  shortDouble: {
    id: 'shortDouble',
    label: 'Zocalo corto doble',
    category: 'Zocalos',
    layer: 'bottom-left',
    sequencedReveal: true,
    fields: [],
    defaults: {
      // "name"/"role" a nivel raiz ELIMINADOS (2026-09-10, pedido explicito
      // del usuario: "que el zócalo doble 1 sea el zócalo individual...
      // que en el panel no me muestre 3 opciones de zócalo"). Antes existia
      // un tercer slot de datos independiente ("ZÓCALO INDIVIDUAL", sin
      // relacion con "double1"/"double2") que el modo "single" del renderer
      // leia aparte -- ahora el modo "single" reutiliza directamente
      // "double1" (ver program/js/renderers/shortDouble.js), asi que mandar
      // un solo zocalo o mandar dos es SIEMPRE la misma fuente de datos
      // (double1, double1+double2), sin una tercera copia paralela.
      airMode: 'single',
      double1: { name: '', role: '' },
      double2: { name: '', role: '' },
      textPresets: [],
      // Claves con ruta "grupo.campo" para los textos de los pares del
      // modo doble -- distinguen el ajuste de "double1.name" del de
      // "double2.name" aunque compartan las mismas clases CSS (ver
      // program/js/renderers/shortDouble.js), porque son campos de datos
      // independientes, no un unico elemento reutilizado. "double1.role"/
      // "double2.role" quedan (el renderer los sigue leyendo -- el campo
      // "Sub texto" solo se eliminó del PANEL, ver short-double-panel.js)
      // aunque ya no tengan textbox propio en Master Control.
      textAdjust: textAdjustDefaults('double1.name', 'double1.role', 'double2.name', 'double2.role'),
    },
  },

  // Sin campos de equipo propios: equipo A/B (nombre, abreviatura y
  // escudo) se leen en vivo de "scoreboard" (`live: true`, mismo patron
  // que "vs" mas arriba) — el VS
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
      {
        // "CONTENIDO CENTRAL" (2026-09-10, pedido explicito del usuario:
        // "simplificar VS COMPACTO" -- eliminados el selector "Estado del
        // encuentro" y el selector "Contenido central: Resultado/Estado vs
        // Sponsor", que en los hechos no controlaba nada real en el
        // renderer, ver program/js/renderers/vs.js). Texto 100% manual: lo
        // que el operador escribe es EXACTAMENTE lo que se renderiza en el
        // renglon central, sin ningun preset de respaldo -- vacio renderiza
        // vacio, nunca se fuerza un valor.
        key: 'statusTexto',
        label: 'Contenido central (texto libre — vacío no muestra nada)',
        type: FIELD_TYPES.TEXT,
        adjustable: true,
      },
      {
        key: 'sponsor',
        label: 'Sponsor Zocalo Medio',
        type: FIELD_TYPES.SELECT,
        options: SPONSOR_OPTIONS.vs_compact,
      },
      // "nameA"/"nameB"/"goalA"/"goalB" (2026-08-15, auditoria completa):
      // nombre y gol de cada equipo se derivan en vivo de "scoreboard" (sin
      // campo propio), pero necesitan su propio ajuste de posicion/tamaño.
      { key: 'nameA', label: 'Nombre equipo local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'nameB', label: 'Nombre equipo visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'goalA', label: 'Gol local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'goalB', label: 'Gol visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: {
      renglon: 'normal', statusTexto: '', sponsor: '',
      // "MOSTRAR GOLES" (2026-10-22, pedido explicito del usuario, SOLO GLA):
      // 'con' = goles en vivo del Marcador (como siempre); 'sin' = oculta
      // unicamente los dos goles. El control solo aparece en GLA (ver
      // master-control/js/main.js) y el renderer solo lo lee en GLA.
      mostrarGoles: 'con',
      textAdjust: textAdjustDefaults('statusTexto', 'nameA', 'nameB', 'goalA', 'goalB'),
      // "localCrestOffset*/awayCrestOffset*/sponsorOffset*" (2026-08-31,
      // auditoria completa): ninguno de los 3 tenia ajuste propio.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      sponsorOffsetX: 0, sponsorOffsetY: 0, sponsorScale: 1,
    },
  },

  // ZÓCALO VS (2026-10-09, pedido explicito del usuario, SOLO Argentina
  // Streamers -- GLA no lo ve en su navegacion): modulo independiente con 2
  // variantes de asset ("solo" = escudo/nombre VS nombre/escudo; "goles" =
  // ademas el gol de cada lado). Equipos, escudos y goles NO tienen estado
  // propio: se leen en vivo de "scoreboard" (`live: true`, 5to argumento del
  // renderer, mismo patron que "vs"/marcadorPenales). Solo guarda lo propio
  // del modulo: variante, nombre AUTOMÁTICO/MANUAL por lado (shared/
  // broadcast-names.js) y ajustes de composicion. Los ajustes son POR
  // VARIANTE (claves "solo*"/"goles*": las dos piezas tienen la pastilla
  // central de distinto ancho, asi que nombres/goles no caen en el mismo
  // lugar) y los escudos ademas POR EQUIPO ("crestByTeam[soloLocal|
  // soloAway|golesLocal|golesAway][teamId]", ver "crestSlot" en
  // shared/adjust-registry.js). El "VS" viene dibujado dentro del asset.
  zocaloVs: {
    id: 'zocaloVs',
    label: 'Zócalo VS',
    category: 'Zocalos',
    layer: 'bottom-center',
    live: true,
    sequencedReveal: true,
    fields: [],
    defaults: {
      variante: 'solo',
      nombreLocalMode: 'auto', nombreLocalManual: '',
      nombreVisitanteMode: 'auto', nombreVisitanteManual: '',
      textAdjust: textAdjustDefaults(
        'soloNombreLocal', 'soloNombreVisitante',
        'golesNombreLocal', 'golesGolLocal', 'golesGolVisitante', 'golesNombreVisitante',
      ),
      soloLocalCrestOffsetX: 0, soloLocalCrestOffsetY: 0, soloLocalCrestScale: 1,
      soloAwayCrestOffsetX: 0, soloAwayCrestOffsetY: 0, soloAwayCrestScale: 1,
      golesLocalCrestOffsetX: 0, golesLocalCrestOffsetY: 0, golesLocalCrestScale: 1,
      golesAwayCrestOffsetX: 0, golesAwayCrestOffsetY: 0, golesAwayCrestScale: 1,
      crestByTeam: { soloLocal: {}, soloAway: {}, golesLocal: {}, golesAway: {} },
    },
  },

  // Sin campo de equipo propio: escudo local/visitante se leen en vivo de
  // "scoreboard" (`live: true`, mismo patron que "vs" mas arriba) — el
  // separador ya horneado en el asset divide ambos escudos, no hace falta
  // volver a elegir equipo aca. "texto1"/"texto2" son independientes, cada
  // uno controla su propio zocalo central (mismo patron que "line1"/
  // "line2" de longDouble). El sector derecho del asset queda sin usar a
  // proposito (pedido explicito del usuario, preparado para el futuro).
  zocaloFinalDiv: {
    id: 'zocaloFinalDiv',
    label: 'Zocalo Compuesto con Equipos',
    category: 'Zocalos',
    layer: 'bottom-wide',
    live: true,
    sequencedReveal: true,
    fields: [
      { key: 'texto1', label: 'TEXTO 1', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'texto2', label: 'TEXTO 2', type: FIELD_TYPES.TEXT, adjustable: true },
    ],
    defaults: {
      texto1: '', texto2: '', sponsorsRotation: [],
      escudosFuente: 'MARCADOR', customTeamA: '', customTeamB: '',
      shieldPresets: [], textPresets: [],
      textAdjust: textAdjustDefaults('texto1', 'texto2')
    },
  },

  // Misma logica que "zocaloFinalDiv" de arriba, base tomada de ese modulo
  // (mismo asset central/derecho, mismo comportamiento de texto1/texto2 y
  // animaciones) -- unica diferencia real: el sector izquierdo no tiene
  // escudos ni separador, en su lugar va un unico logo GLA estatico (sin
  // datos del Marcador, no hay "live" por esa parte -- solo se mantiene
  // por si en el futuro se agrega algo que dependa de scoreboard, hoy no
  // se usa). Sin campo de logo en el panel: el logo es fijo, no elegible.
  zocaloFinal: {
    id: 'zocaloFinal',
    label: 'Zocalo Compuesto Logo GLA',
    category: 'Zocalos',
    layer: 'bottom-wide',
    sequencedReveal: true,
    fields: [
      { key: 'texto1', label: 'TEXTO 1', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'texto2', label: 'TEXTO 2', type: FIELD_TYPES.TEXT, adjustable: true },
    ],
    defaults: { texto1: '', texto2: '', sponsorsRotation: [], textPresets: [], textAdjust: textAdjustDefaults('texto1', 'texto2') },
  },

  // ---------------------------------------------------------------------
  // ZÓCALO COMPUESTO (unificado) -- 2026-08-16, pedido explicito del
  // usuario: "no quiero duplicar dos modulos casi idénticos". Reemplaza en
  // la navegacion a "zocaloFinal"/"zocaloFinalDiv" (ambos arriba: quedan
  // registrados y con su renderer intacto para no perder datos/presets
  // viejos ya persistidos, pero ocultos de la lista de tabs -- ver
  // HIDDEN_FROM_NAV_IDS en master-control/js/main.js, mismo patron que
  // "gol"). "tipo" elige que sector izquierdo mostrar (EQUIPOS: escudos en
  // vivo del Marcador, mismo campo/logica que zocaloFinalDiv; LOGO: logo
  // GLA fijo, mismo criterio que zocaloFinal) -- texto1/texto2/sponsors/
  // presets/ajustes de composicion y de texto son UNA sola copia
  // compartida entre ambos tipos (program/js/renderers/zocaloCompuesto.js
  // hace el swap de video+contenido, ver ese archivo para el detalle de
  // "transicion segura" al cambiar tipo estando al aire).
  zocaloCompuesto: {
    id: 'zocaloCompuesto',
    label: 'Zócalo Compuesto',
    category: 'Zocalos',
    layer: 'bottom-wide',
    live: true,
    sequencedReveal: true,
    fields: [
      {
        key: 'tipo', label: 'Tipo', type: FIELD_TYPES.SELECT,
        options: [
          { id: 'equipos', label: 'EQUIPOS (escudos del Marcador)' },
          { id: 'logo', label: 'LOGO GLA' },
        ],
      },
      { key: 'texto1', label: 'TEXTO 1', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'texto2', label: 'TEXTO 2', type: FIELD_TYPES.TEXT, adjustable: true },
    ],
    defaults: {
      tipo: 'equipos',
      texto1: '', texto2: '', sponsorsRotation: [],
      escudosFuente: 'MARCADOR', customTeamA: '', customTeamB: '',
      shieldPresets: [], textPresets: [], completePresets: [],
      textAdjust: textAdjustDefaults('texto1', 'texto2'),
      // "localCrestOffset*/awayCrestOffset*/logoOffset*" (2026-08-31,
      // auditoria completa): ninguno tenia ajuste propio.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      logoOffsetX: 0, logoOffsetY: 0, logoScale: 1,
      // "sponsorsOffsetX/Y/Scale" (2026-09-24, pedido explicito del
      // usuario: "TODOS los sponsors del rotativo deben compartir UN UNICO
      // ajuste de composicion"). Reemplaza "sponsor1Offset*"/"sponsor2Offset*"
      // (uno por cada uno de los 2 <img> del crossfade interno, ver
      // program/js/renderers/zocaloCompuesto.js) -- con dos ajustes
      // independientes, el mismo sponsor "saltaba" de posicion/escala segun
      // en cual de los 2 slots del rotativo le tocara aparecer. Ahora los 2
      // <img> comparten el mismo "data-adjust" (ver ese renderer), asi que
      // ESTE unico valor se aplica a cualquiera de los dos por igual --
      // mismo mecanismo ya usado para columnas de tablas (grupos/sideTable/
      // posiciones), que tambien aplican un unico ajuste a varios nodos con
      // el mismo id. Base elegida: la posicion COMUN ya guardada del modulo
      // (0/0/1, ver shared/theme-layouts/gla.json) -- ni sponsor1 ni
      // sponsor2 tenian una posicion distinta CONFIRMADA con "Guardar
      // posición" (solo ajustes en vivo sin guardar, y distintos entre si),
      // asi que no habia ninguna base real que preservar sin inventarla.
      sponsorsOffsetX: 0, sponsorsOffsetY: 0, sponsorsScale: 1,
    },
  },

  // "zocaloCompuestoEquipos" (2026-09-10, UNIFICADO con "zocaloCompuestoLogo"
  // -- pedido explicito del usuario: "es todo lo mismo, solo cambia el
  // asset... necesito que sean un solo módulo, con la opción de menú
  // desplegable CON LOGO LOCALSTRIKE | CON EQUIPOS"). "tipo" decide que
  // sector izquierdo se manda: EQUIPOS (escudos en vivo del Marcador, con
  // linea separadora) o LOGO (logo LocalStrike fijo, sin linea) -- resto
  // (texto1/texto2/subColor/sponsor/presets/composicion) es UNA sola copia
  // compartida entre ambos tipos, mismo criterio ya probado en
  // "zocaloCompuesto" (el modulo de GLA, sin relacion con este -- assets
  // completamente distintos, ver program/js/renderers/zocaloCompuesto.js
  // para el patron de "transicion segura al cambiar tipo" que este
  // renderer reusa). "zocaloCompuestoLogo" (mas abajo) queda registrado
  // SOLO para no perder datos/presets ya persistidos de quien lo haya
  // usado antes de esta unificacion -- oculto de toda navegacion (ver
  // HIDDEN_FROM_NAV_IDS en master-control/js/main.js, mismo patron que
  // "zocaloFinal"/"zocaloFinalDiv"/"gol"), nunca mas editable directo.
  zocaloCompuestoEquipos: {
    id: 'zocaloCompuestoEquipos',
    label: 'Zócalo Compuesto',
    category: 'Zocalos',
    layer: 'bottom-left',
    live: true,
    sequencedReveal: true,
    // "fields: []" (2026-09-02, auditoria de wiring): el CONTENIDO
    // (texto1/texto2/sponsor) lo muestra el panel dedicado
    // (master-control/js/zocalo-compuesto-panel.js) -- declararlos aca
    // tambien los duplicaba (2 cajas "TEXTO MAIN" en pantalla, una
    // generica sin ACTUALIZAR y otra del panel). Mismo criterio que
    // "formacionEquipos" mas arriba.
    fields: [],
    defaults: {
      tipo: 'equipos',
      // "subColor" (2026-09-02, pedido explicito del usuario): SOLO afecta
      // texto2/SUBTEXTO -- texto1/MAIN se mantiene siempre blanco fijo, sin
      // campo propio, tal como ya estaba. "sponsorsRotation" reemplaza al
      // dropdown unico "sponsor" (mismo campo/mismo shape que ya usa
      // zocaloCompuesto/zocaloFinal/zocaloFinalDiv -- array de ids,
      // reutiliza el panel/renderer de rotacion existentes en vez de
      // inventar uno nuevo).
      texto1: '', texto2: '', subColor: 'negro', sponsorsRotation: [], textPresets: [],
      sponsorOffsetX: 0, sponsorOffsetY: 0, sponsorScale: 1,
      compositionOffsetX: 0, compositionOffsetY: 0, compositionScale: 1,
      // "logoOffsetX/Y/Scale" (2026-09-10, fusionado desde
      // "zocaloCompuestoLogo"): posicion propia del logo LocalStrike,
      // independiente de la posicion de los escudos.
      logoOffsetX: 0, logoOffsetY: 0, logoScale: 1,
      textAdjust: textAdjustDefaults('texto1', 'texto2'),
      crestByTeam: { local: {}, away: {} },
    },
  },

  // LEGACY -- ver comentario en "zocaloCompuestoEquipos" arriba. No editable
  // desde Master Control (oculto de toda navegacion), solo conserva datos
  // ya persistidos de antes de la unificacion 2026-09-10.
  zocaloCompuestoLogo: {
    id: 'zocaloCompuestoLogo',
    label: 'Zócalo Compuesto con Logo',
    category: 'Zocalos',
    layer: 'bottom-left',
    sequencedReveal: true,
    fields: [],
    defaults: {
      texto1: '', texto2: '', subColor: 'negro', sponsorsRotation: [], textPresets: [],
      logoOffsetX: 0, logoOffsetY: 0, logoScale: 1,
      sponsorOffsetX: 0, sponsorOffsetY: 0, sponsorScale: 1,
      compositionOffsetX: 0, compositionOffsetY: 0, compositionScale: 1,
      textAdjust: textAdjustDefaults('texto1', 'texto2'),
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
  //
  // "posicion" (agregado 2026-07-31, a pedido explicito del usuario):
  // modo de salida — 'placaL' (posicion aprobada original: Grupo 1 y
  // Grupo 2 se muestran juntos, apilados) o 'fullscreenDerecha'/
  // 'fullscreenIzquierda' (un unico grupo, elegido con "variante", en la
  // esquina inferior correspondiente). "variante" pasa a ser relevante
  // solo en los modos fullscreen ("Grupo visible" en el panel); en modo
  // Placa L se ignora porque se muestran ambos grupos siempre. El orden
  // de cada tabla (mayor a menor puntaje) NO se persiste por separado:
  // se recalcula siempre en el renderer (program/js/renderers/grupos.js)
  // a partir de "puntos", con un sort estable para que los empates
  // conserven el orden de carga original sin inventar un criterio de
  // desempate adicional.
  grupos: {
    id: 'grupos',
    label: 'Grupos',
    category: 'Grupos',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      posicion: 'placaL',
      variante: 'grupo1',
      grupo1: { filas: [{ teamId: '', puntos: '' }, { teamId: '', puntos: '' }, { teamId: '', puntos: '' }] },
      grupo2: { filas: [{ teamId: '', puntos: '' }, { teamId: '', puntos: '' }, { teamId: '', puntos: '' }] },
      ultimaActualizacionWeb: '',
      // Ajuste column-level compartido entre Grupo 1 y Grupo 2 (2026-08-15,
      // auditoria completa) -- ver master-control/js/grupos-panel.js.
      textAdjust: textAdjustDefaults('nombre', 'puntos'),
      // "crestOffsetX/Y/Scale" (2026-08-31, auditoria completa): mismo
      // criterio column-level que "nombre"/"puntos" -- un unico ajuste
      // mueve el escudo de TODAS las filas visibles (Grupo 1 y Grupo 2
      // por igual), nunca tuvo ajuste propio.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
  },

  // ---------------------------------------------------------------------
  // Sin asset nuevo todavia (se mantienen del sistema anterior)
  // ---------------------------------------------------------------------
  sideTable: {
    id: 'sideTable',
    label: 'Resultados',
    category: 'Brackets',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      titulo: 'RESULTADOS',
      posicion: 'placaL',
      // PARTIDOS EVENTO / SORTEO (2026-10-22, SOLO GLA -- ver
      // syncBracketCrestsFromGrupos en server/state.js): modo activo y la
      // lista guardada del modo inactivo ({ encuentros, tanda } o null).
      modoPartidos: 'evento',
      partidosEvento: null,
      partidosSorteo: null,
      // Maximo 6 brackets visibles a la vez en Program; con mas de 6
      // encuentros cargados, "tanda" elige que ventana de 6 se muestra
      // ('tanda1' = partidos 1-6, 'tanda2' = partidos 4 en adelante) --
      // ver program/js/renderers/sideTable.js.
      tanda: 'tanda1',
      encuentros: [
        {
          teamA: '',
          teamB: '',
          scoreA: '0',
          scoreB: '0',
          status: 'final',
          hora: '',
          // Titulo individual por encuentro (2026-08-15, pedido explicito
          // del usuario: "CUARTOS 1", "SEMIS 1", "GRAN FINAL", etc.) --
          // texto propio de CADA encuentro (a diferencia de golLocal/
          // estado/etc., que son campos por-encuentro pero de tipo fijo),
          // ver program/js/renderers/sideTable.js.
          titulo: '',
          // "penalesA"/"penalesB" (2026-08-16, pedido explicito del
          // usuario: soportar "6(3) - 6(1)"): OPCIONALES, string vacio =
          // sin definicion por penales -- Program muestra solo "6 - 6".
          // Con ambos cargados, el numero de penales sale entre parentesis
          // y mas chico junto al resultado (ver sideTable.js/overlay.css).
          penalesA: '',
          penalesB: ''
        }
      ],
      faseWeb: 'grupos',
      snapshotsWeb: {},
      ultimaActualizacionWeb: '',
      // Ajuste column-level (2026-08-15, auditoria completa): ver
      // master-control/js/resultados-panel.js. "tituloBracket" es el
      // ajuste de posicion/tamaño del titulo individual por encuentro
      // (arriba del estado/hora); se llama distinto de "titulo" porque ese
      // key ya lo usa el titulo GENERAL de todo el modulo (arriba de la
      // tabla, ej. "RESULTADOS").
      textAdjust: textAdjustDefaults('titulo', 'golLocal', 'golVisitante', 'estado', 'estadoFullscreen', 'tituloBracket'),
      // "crestLocalOffset*/crestVisitanteOffset*" (2026-08-31, auditoria
      // completa): ajuste column-level (mueve el escudo de TODOS los
      // encuentros visibles) -- nunca tuvo ajuste propio.
      crestLocalOffsetX: 0, crestLocalOffsetY: 0, crestLocalScale: 1,
      crestVisitanteOffsetX: 0, crestVisitanteOffsetY: 0, crestVisitanteScale: 1,
    },
  },

  estrellas: {
    id: 'estrellas',
    label: 'Estrellas',
    category: 'Placas',
    layer: 'fullscreen',
    sequencedReveal: true,
    fields: [],
    defaults: {
      titulo: 'LOS MEJORES DE CADA EQUIPO',
      fuente: 'liga',
      snapshots: {},
      formatoJugador: 'numero_apodo',
      localJugador: null,
      localNombre: '',
      localG: 0,
      localA: 0,
      localPJ: 0,
      visitanteJugador: null,
      visitanteNombre: '',
      visitanteG: 0,
      visitanteA: 0,
      visitantePJ: 0,
      ultimaActualizacionWeb: '',
      // "localJugadorId"/"visitanteJugadorId" (2026-09-10, pedido explicito
      // del usuario: "Estrellas... tiene que hacer la misma lógica de Ficha
      // Jugador" -- identidad ESTABLE del jugador del plantel central de
      // Argentina Streamers, ver server/playerRosters.js), para poder
      // sincronizar Goles/Asistencias/Partidos Jugados contra
      // argentinastreamers.com reusando el mismo endpoint/logica que Ficha
      // Jugador (server/argentinaStreamersPlayerStats.js) -- vacio para un
      // jugador tipeado a mano o para GLA (que sigue con su propio sync de
      // gla.futbol, sin tocar).
      localJugadorId: '',
      visitanteJugadorId: '',
      localWebSyncStatus: '', localWebSyncError: '',
      visitanteWebSyncStatus: '', visitanteWebSyncError: '',
      // 9 ajustes individuales (2026-08-15, auditoria completa): estructura
      // fija (2 jugadores), cada texto se ajusta por separado -- ver
      // master-control/js/estrellas-panel.js.
      textAdjust: textAdjustDefaults(
        'titulo',
        'localNombre', 'localG', 'localA', 'localPJ',
        'visitanteNombre', 'visitanteG', 'visitanteA', 'visitantePJ',
      ),
      // "localCrestOffset*/visitanteCrestOffset*" (2026-08-31, auditoria
      // completa): los 2 escudos nunca tuvieron ajuste propio.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      visitanteCrestOffsetX: 0, visitanteCrestOffsetY: 0, visitanteCrestScale: 1,
    },
  },

  // Tabla de posiciones: la liga tiene 11 equipos, "filas" guarda los 11
  // (posicion real 1-11, nunca renumerada) aunque el asset solo tenga
  // casilleros para una pagina a la vez. "pagina" ('pagina1' = posiciones
  // 1-6 con posiciones-alpha.mp4, 'pagina2' = posiciones 7-11 con
  // posiciones-5-alpha.mp4, ver program/js/renderers/posiciones.js) decide
  // que subset de "filas" se compone en Program -- una unica sincronizacion
  // web (o carga manual) llena las 11, el selector solo elige que ventana
  // mostrar, no dispara una segunda consulta. Columnas numericas reales
  // impresas en el grafico -- PTS, PJ, G, GXP, PXP, P, GF, GC, DG -- sin
  // inventar ni recortar siglas. "equipo" guarda solo el ID del catalogo
  // global (shared/teams.js); escudo y nombre completo se derivan siempre
  // de ahi, nunca se cargan a mano. El orden de "filas" es el oficial tal
  // como llega (de la web o cargado a mano): Program ya no recalcula un
  // ranking propio por PTS/DG, solo filtra por rango de posicion y ordena
  // por el campo "posicion" (ver renderer).
  posiciones: {
    id: 'posiciones',
    label: 'Tabla Global',
    category: 'Brackets',
    layer: 'fullscreen',
    sequencedReveal: true,
    fields: [],
    defaults: {
      titulo: 'POSICIONES',
      pagina: 'pagina1',
      filas: [
        { posicion: 1, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 2, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 3, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 4, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 5, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 6, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 7, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 8, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 9, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 10, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
        { posicion: 11, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0, pxp: 0, p: 0, gf: 0, gc: 0, dg: 0 },
      ],
      // Ajuste column-level (2026-08-15, auditoria completa): un unico
      // control por columna se aplica a todas las filas visibles -- ver
      // master-control/js/posiciones-panel.js.
      textAdjust: textAdjustDefaults('titulo', 'numero', 'equipo', 'pts', 'pj', 'g', 'gxp', 'pxp', 'p', 'gf', 'gc', 'dg'),
      // "crestOffsetX/Y/Scale" (2026-08-31, auditoria completa): mismo
      // criterio column-level -- el escudo nunca tuvo ajuste propio.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
  },

  posicionesTorneo: {
    id: 'posicionesTorneo',
    label: 'Posiciones Torneo',
    category: 'Brackets',
    layer: 'fullscreen',
    sequencedReveal: true,
    fields: [],
    defaults: {
      titulo: 'POSICIONES TORNEO',
      pagina: 'pagina1',
      filas: Array.from({ length: 6 }, (_, index) => ({
        posicion: index + 1, teamId: '', puntos: 0, pj: 0, g: 0, gxp: 0,
        pxp: 0, p: 0, gf: 0, gc: 0, dg: 0,
      })),
      ultimaActualizacionWeb: '',
      textAdjust: textAdjustDefaults('titulo', 'numero', 'equipo', 'pts', 'pj', 'g', 'gxp', 'pxp', 'p', 'gf', 'gc', 'dg'),
      // "crestOffsetX/Y/Scale" (2026-08-31, auditoria completa): mismo
      // criterio column-level que "posiciones" -- el escudo nunca tuvo
      // ajuste propio.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
  },

  // "cronogramaHoy"/"resultadosParciales"/"historial" (2026-09-02):
  // modulos de BRACKETS para Argentina Streamers, entregados por un
  // agente concurrente -- integrados tal cual el handoff (ver
  // docs/PATCH_SHARED_CLAUDE.md y docs/BRACKETS_ARGENTINA_STREAMERS.md),
  // sin modificar su forma de datos/logica. Renderer y panel dedicados
  // propios, sin tocar goleadores/asistidores/jugadores/fichaJugador.
  cronogramaHoy: {
    id: 'cronogramaHoy',
    label: 'Cronograma Hoy',
    category: 'Brackets',
    layer: 'fullscreen',
    sequencedReveal: true,
    fields: [],
    // "encuentros" (2026-09-02, reconstruido desde cero -- ver informe):
    // la implementacion anterior (2 partidos manuales, tarjeta fabricada
    // en CSS) se descarto por completo, pedido explicito del usuario ("no
    // reutilizar la placa vertical falsa anterior", "no quiero selector
    // duplicado de equipos"). Ahora hay un PNG real
    // (cronograma-hoy.png, VS_DEFAULT entregado) con UN solo partido.
    // "teamLocal"/"teamVisitante" (2026-09-04, cambio explicito del
    // usuario: "quiero poder armar manualmente un enfrentamiento" --
    // reemplaza la herencia automatica de scoreboard.teamA/teamB de
    // arriba, que ya no se usa) -- seleccion manual desde el panel
    // dedicado, catalogo Argentina Streamers. "presets" guarda
    // combinaciones completas (titulo+local+visitante, NO posiciones,
    // que siguen siendo layout) -- misma filosofia/helper que los presets
    // de texto de zocalos (ver master-control/js/presets-helper.js).
    // "crestByTeam" seedeado por teamId real (mismo patron que
    // zocaloCompuestoEquipos), asi la posicion de cada escudo sobrevive a
    // que cambie el equipo elegido.
    defaults: {
      titulo: 'PRÓXIMO PARTIDO',
      teamLocal: '',
      teamVisitante: '',
      presets: [],
      textAdjust: textAdjustDefaults('titulo'),
      crestByTeam: { local: {}, away: {} },
    },
  },

  resultadosParciales: {
    id: 'resultadosParciales',
    label: 'Resultados Parciales',
    category: 'Brackets',
    layer: 'fullscreen',
    sequencedReveal: true,
    fields: [],
    defaults: {
      titulo: 'RESULTADOS PARCIALES',
      // "encuentros" (2 partidos manuales con estado): NO se borra --
      // pedido explicito del usuario ("si ya tiene su propia lógica de
      // datos, no la destruyas"). Queda sin uso por el renderer nuevo
      // (2026-09-03, reconstruido sobre VS_RESULTADO.png real: un solo
      // partido, escudos+resultado heredados en vivo del Marcador, mismo
      // criterio que vsResultado/cronogramaHoy -- confirmado con el
      // usuario). Se conserva por si se reactiva un uso futuro.
      encuentros: [
        { teamA: 'argentina-streamers', teamB: 'oxen', scoreA: '2', scoreB: '1', estado: 'FINAL' },
        { teamA: 'peru-creadores', teamB: 'argentina-streamers-fem', scoreA: '0', scoreB: '0', estado: 'EN JUEGO' },
      ],
      textAdjust: textAdjustDefaults('titulo', 'teamA1', 'teamB1', 'scoreA1', 'scoreB1', 'estado1', 'teamA2', 'teamB2', 'scoreA2', 'scoreB2', 'estado2', 'scoreLocal', 'scoreVisitante'),
      // "localCrestOffset*/awayCrestOffset*" + "crestByTeam" (2026-09-03):
      // escudos heredados en vivo del Marcador (sb.teamA/teamB), mismo
      // mecanismo "crestTeam" que ya usan vsResultado/cronogramaHoy (ver
      // resolveCrestTeamOverride en program/js/main.js) -- el offset
      // flat es el default/fallback, "crestByTeam" guarda la posicion
      // propia por equipo una vez que el operador la ajusta y guarda.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      crestByTeam: { local: {}, away: {} },
    },
  },

  // "historial" (2026-09-02, reconstruido desde cero -- ver informe): la
  // version anterior de Antigravity (categorias + paginacion + tarjeta
  // fabricada en CSS) se descarto por completo, pedido explicito del
  // usuario ("NO reutilices su diseño CSS/provisorio... la geometria/render
  // debe partir del NUEVO asset"). Ahora hay un PNG real
  // (assets/themes/argentina-streamers/tablas/historial.png, medido pixel
  // a pixel: 5 filas fijas LOCAL/GOL LOCAL/GOL VISITANTE/VISITANTE, sin
  // fecha/competencia/categoria -- esas columnas no existen en el asset
  // real). Shape minimo pedido: 5 partidos fijos, cada uno con equipo
  // local/visitante (teamId real, escudo automatico) + goles como texto
  // libre (no siempre son numeros -- "P" de penales, etc., decision igual
  // que el resto del proyecto: nunca forzar tipo numerico en un campo que
  // el operador tipea).
  historial: {
    id: 'historial',
    label: 'Historial',
    category: 'Tablas',
    layer: 'fullscreen',
    sequencedReveal: true,
    fields: [],
    defaults: {
      // "titulo"/"tipoHistorial" (2026-09-02, pedido explicito del
      // usuario): titulo manual (aparece en la zona superior real del
      // PNG, ver overlay.css/".ov-performance-titulo" que reutiliza este
      // modulo) + categoria, valores internos estables para cuando se
      // conecte la web mas adelante -- por ahora es solo un dato mas que
      // el operador elige, sin logica de fetch.
      titulo: '',
      tipoHistorial: 'iwc',
      // "teamBCrestUrl"/"penalLocal"/"penalVisitante" (2026-09-04, pedido
      // explicito del usuario -- ver server/argentinaStreamersSync.js):
      // "teamBCrestUrl" es el escudo de un RIVAL HISTORICO sin equipo en
      // el catalogo local (Colombia/Malasia/etc, ver
      // server/argentinaStreamersClient.js), solo lo llena la sincro web;
      // el editor manual (teamB, select del catalogo local) siempre tiene
      // prioridad en el renderer y lo limpia al elegir un equipo a mano.
      // "penalLocal/penalVisitante" son SOLO texto (nunca inventados, ver
      // "wentToPenalties" real de la web) -- vacios = el partido no se
      // definio por penales, el renderer no dibuja nada debajo del gol.
      // "fase" (2026-09-04, pedido explicito del usuario): campo REAL de la
      // web ("stage" en product.matches[]/product.competitions.*[].matches,
      // ver server/argentinaStreamersSync.js) -- "FASE DE GRUPO IWC",
      // "SEMIFINAL ICC", "Amistoso", etc. Nunca inferido de la posicion del
      // partido; vacio si la web no publico fase para ese encuentro.
      partidos: [
        { teamA: '', golLocal: '', golVisitante: '', teamB: '', teamBCrestUrl: '', penalLocal: '', penalVisitante: '', fase: '' },
        { teamA: '', golLocal: '', golVisitante: '', teamB: '', teamBCrestUrl: '', penalLocal: '', penalVisitante: '', fase: '' },
        { teamA: '', golLocal: '', golVisitante: '', teamB: '', teamBCrestUrl: '', penalLocal: '', penalVisitante: '', fase: '' },
        { teamA: '', golLocal: '', golVisitante: '', teamB: '', teamBCrestUrl: '', penalLocal: '', penalVisitante: '', fase: '' },
        { teamA: '', golLocal: '', golVisitante: '', teamB: '', teamBCrestUrl: '', penalLocal: '', penalVisitante: '', fase: '' },
      ],
      // Ajuste POR COLUMNA (2026-09-02, pedido explicito del usuario:
      // "criterio por columna/bloque, no fila individual") -- un unico
      // offset se aplica a los 5 escudos locales por igual, otro a los 5
      // visitantes, mismo patron que "goleadores/asistidores" mas abajo.
      crestLocalOffsetX: 0, crestLocalOffsetY: 0, crestLocalScale: 1,
      crestVisitanteOffsetX: 0, crestVisitanteOffsetY: 0, crestVisitanteScale: 1,
      // "tituloCrestOffsetX/Y/Scale" (2026-09-04, pedido explicito del
      // usuario, item 7: escudo Argentina Streamers masculino a la
      // izquierda del titulo -- nunca existio para este modulo, se agrega
      // ahora, mismo patron ya usado en goleadores/asistidores/jugadores).
      tituloCrestOffsetX: 0, tituloCrestOffsetY: 0, tituloCrestScale: 1,
      // "tituloByCategoria" (2026-09-04, pedido explicito del usuario:
      // "no quiero una unica posicion/escala global del titulo, quiero
      // guardar ajustes INDEPENDIENTES por categoria" -- HISTORIAL - IWC
      // es mucho mas corto que HISTORIAL - AMISTOSOS OFICIALES). Un
      // textAdjust {dx,dy,dSize} completo por categoria, misma llave que
      // "tipoHistorial" -- el renderer/panel eligen cual usar segun la
      // categoria activa en vez del "textAdjust.titulo" unico de siempre
      // (que se mantiene igual para el ESCUDO del titulo, item 7 del
      // pedido: "no separar salvo que haga falta tecnicamente" -- el
      // escudo NO depende del largo del texto, sigue con un unico ajuste).
      tituloByCategoria: {
        iwc: { dx: 0, dy: 0, dSize: 0 },
        'copa-america': { dx: 0, dy: 0, dSize: 0 },
        'amistosos-oficiales': { dx: 0, dy: 0, dSize: 0 },
        amistosos: { dx: 0, dy: 0, dSize: 0 },
      },
      // "resultadoNormal"/"resultadoConPenales"/"penalesFino" (2026-09-04,
      // pedido explicito del usuario: "GOL LOCAL"/"GOL VISITANTE" como dos
      // controles de columna INDEPENDIENTES quedan eliminados -- "los dos
      // goles deben moverse juntos", y ademas con geometria propia segun
      // si la fila tiene penales o no, porque compartian demasiado la
      // misma logica de posicionamiento). Los 3 son bloques {dx,dy,dSize}
      // UNICOS (no por columna individual):
      //  - "resultadoNormal": mueve/escala JUNTOS gol local + gol
      //    visitante, SOLO en filas sin penales.
      //  - "resultadoConPenales": mueve/escala JUNTOS gol local + gol
      //    visitante + penal local + penal visitante, SOLO en filas CON
      //    penales (nunca toca las filas sin penales -- geometria
      //    completamente separada).
      //  - "penalesFino": ajuste ADICIONAL, encima de "resultadoConPenales",
      //    exclusivo de penal local/penal visitante -- mueve la segunda
      //    linea "(N) (N)" respecto del score reglamentario sin tocar
      //    donde esta parado el bloque completo.
      // Migracion de baseline (item 10 del pedido: "preservar las
      // posiciones actuales, no desacomodar todo de golpe"): los offsets
      // YA guardados en las columnas viejas ("textAdjust.golLocal/
      // golVisitante/penalLocal/penalVisitante", ver
      // shared/theme-layouts/argentinaStreamers.json) NO se descartan --
      // se hornean como base FIJA por elemento en
      // program/js/renderers/historial.js (GOL_LOCAL_BASE_ADJUST, etc.),
      // asi el look actual queda identico y estos 3 campos nuevos arrancan
      // en 0/0/0 (el punto de partida correcto para un ajuste ADICIONAL).
      resultadoNormal: { dx: 0, dy: 0, dSize: 0 },
      resultadoConPenales: { dx: 0, dy: 0, dSize: 0 },
      penalesFino: { dx: 0, dy: 0, dSize: 0 },
      textAdjust: textAdjustDefaults('fase'),
    },
  },

  // "Sitio Web Promo L" (2026-09-02, pedido explicito del usuario): placa
  // full-bleed estatica con el PNG real (ANUNCIO_AS entregado) -- sin
  // texto dinamico, el asset ya trae su contenido horneado (captura del
  // sitio web + boton "INGRESÁ"). Categoria nueva "Extras" (ninguna de las
  // existentes encajaba con "publicidad/promocion"). SOLO Argentina
  // Streamers -- GLA_HIDDEN_MODULES en master-control/js/main.js lo oculta
  // de su navegacion, mismo criterio que fichaJugador/historial/etc.
  sitioWebPromoL: {
    id: 'sitioWebPromoL',
    label: 'Sitio Web Promo L',
    category: 'Extras',
    layer: 'fullscreen',
    sequencedReveal: true,
    // "asset" (2026-09-14, RESTAURADO -- pedido explicito del usuario: "se
    // perdió/regresó el desplegable que ya habíamos agregado"). Investigado
    // antes de recrear a ciegas: revisé `git log` sobre este módulo -- el
    // único commit que lo toca ("83cf1fa") nunca tuvo este campo, así que
    // nunca llegó a confirmarse en un commit; era trabajo sin guardar de
    // una sesión anterior que se perdió sin dejar rastro en el historial
    // (no hay ningún diff/commit que lo haya "roto" -- simplemente nunca
    // quedó persistido). Campo SELECT genérico (sin panel dedicado, este
    // módulo nunca tuvo uno) -- decide qué variante de imagen usa
    // "resolveImageSrc" vía "asset.variants" en shared/themes.js.
    fields: [
      {
        key: 'asset', label: 'ASSET', type: FIELD_TYPES.SELECT,
        options: [
          { id: 'argentina-streamers', label: 'ARGENTINA STREAMERS' },
          { id: 'punch', label: 'PUNCH' },
        ],
      },
    ],
    defaults: {
      asset: 'argentina-streamers',
      compositionOffsetX: 0, compositionOffsetY: 0, compositionScale: 1,
    },
  },

  // Tablas de rendimiento: comparten panel y renderer, pero cada modulo
  // conserva sus propios jugadores y posicion. El orden no se guarda como
  // una segunda fuente de datos: se deriva de estas estadisticas con sort
  // estable cada vez que Program renderiza. El estado visual sigue fuera
  // de defaults, por lo que un reinicio siempre las deja OUT.
  goleadores: {
    id: 'goleadores',
    label: 'Goleadores',
    category: 'Tablas',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      // "titulo" (2026-09-02, pedido explicito del usuario: "TÍTULO
      // configurable según módulo" sobre TABLA_ESTADISTICAS.png) -- vacio
      // por default, el renderer cae al nombre de broadcast del modulo
      // ("GOLEADORES") si el operador no escribio nada, nunca lo pisa.
      titulo: '',
      posicion: 'placaL', fuente: 'liga', jugadores: [], snapshots: {}, ultimaActualizacionWeb: '',
      textAdjust: textAdjustDefaults('titulo', 'position', 'name', 'primaryStat'),
      // "crestOffsetX/Y/Scale" (2026-08-31, auditoria completa): ajuste
      // column-level, el escudo nunca tuvo ajuste propio.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
  },

  asistidores: {
    id: 'asistidores',
    label: 'Asistidores',
    category: 'Tablas',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      titulo: '',
      posicion: 'placaL', fuente: 'liga', jugadores: [], snapshots: {}, ultimaActualizacionWeb: '',
      textAdjust: textAdjustDefaults('titulo', 'position', 'name', 'primaryStat'),
      // "crestOffsetX/Y/Scale" (2026-08-31, auditoria completa): ajuste
      // column-level, el escudo nunca tuvo ajuste propio.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
  },

  jugadores: {
    id: 'jugadores',
    label: 'Jugadores',
    category: 'Tablas',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      // "titulo" (2026-09-02): en Argentina Streamers el renderer usa modo
      // "ranking" (posicion+nombre+UN estadistica -- ver
      // program/js/renderers/performanceTable.js) sobre el mismo PNG que
      // goleadores/asistidores, con "PARTICIPACIONES" (PJ del jugador,
      // metrica ya existente en el modulo) como estadistica -- GLA sigue
      // exactamente con su layout de 3 columnas (G/A/PJ) de siempre, sin
      // "position" ni "titulo" en su propio asset.
      titulo: '',
      posicion: 'placaL', fuente: 'liga', jugadores: [], snapshots: {}, ultimaActualizacionWeb: '',
      textAdjust: textAdjustDefaults('titulo', 'position', 'name', 'primaryStat', 'stat0', 'stat1', 'stat2'),
      // "crestOffsetX/Y/Scale" (2026-08-31, auditoria completa): ajuste
      // column-level, el escudo nunca tuvo ajuste propio.
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
  },

  // FICHA JUGADOR (2026-09-02, pedido explicito del usuario: placa
  // vertical individual con los datos de UN jugador, para Argentina
  // Streamers). Modulo NUEVO, registrado igual para los dos themes (mismo
  // criterio que el resto del proyecto: la estructura existe siempre, el
  // ASSET real es lo que falta -- ver "getModuleAssetStatus", que ya
  // infiere 'pending' sin "image"/"video" reales, sin tener que declarar
  // "status" a mano aca). GLA no tiene pedido ningun uso de este modulo
  // -- queda disponible en su navegacion (mismo patron que cualquier otro
  // modulo del registro) pero sin contenido/flujo pensado para GLA.
  //
  // REHECHO EN BLOQUE 4 (2026-09-09, pedido explicito del usuario: "FICHA
  // JUGADOR debe consumir el sistema central de JUGADORES implementado en
  // el BLOQUE 3... no crear otra lista manual independiente"). Antes de
  // este bloque el modulo mantenia su PROPIA lista de jugadores
  // (jugadores[]/snapshots/fuente, igual que Goleadores/Asistidores) --
  // eso quedaba desconectado del plantel central (server/playerRosters.js)
  // y obligaba a cargar cada jugador dos veces. Ahora el modulo solo
  // guarda una SELECCION ("equipo"+"jugadorId", apuntando al plantel
  // central) mas una COPIA sincronizada de lo ultimo confirmado (nombre +
  // 4 stats) -- exactamente el mismo patron que ya usa Estrellas
  // ("localJugador"/"localNombre"/"localG", ver mas arriba en este
  // archivo) para que Program nunca dependa de golpear la red: la copia
  // es lo que Program realmente lee, la sincronizacion real pasa por
  // server/playerRosters.js + server/argentinaStreamersPlayerStats.js
  // (persistida ahi, reusable por cualquier otro modulo que a futuro
  // quiera los mismos datos). "xDisponible" distingue "la web confirmo 0"
  // de "la web nunca informo este dato" (pedido explicito, seccion 7: "no
  // calcular una estadistica distinta y llamarla MVP" si no esta
  // disponible) -- el renderer nunca inventa un numero para un stat
  // marcado como no disponible. Sin "g+a": el PNG real (ver
  // assets/themes/argentina-streamers/tablas/ficha-jugador.png) NO tiene
  // ese recuadro -- se elimina el campo inventado de la version anterior
  // (creada antes de tener el asset real).
  fichaJugador: {
    id: 'fichaJugador',
    label: 'Ficha Jugador',
    category: 'Tablas',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      equipo: 'local', // 'local' | 'visitante' -- mismo criterio que Tarjeta/Cambios
      jugadorId: '', // id del jugador en el plantel central (server/playerRosters.js)
      teamId: '',
      nombre: '',
      goles: 0, asistencias: 0, presencias: 0, mvps: 0,
      golesDisponible: true, asistenciasDisponible: true, presenciasDisponible: true, mvpsDisponible: true,
      ultimaActualizacionWeb: '',
      webSyncStatus: '', // '' | 'ok' | 'error' | 'not-found' | 'ambiguous'
      webSyncError: '',
      textAdjust: textAdjustDefaults('nombre', 'goles', 'asistencias', 'presencias', 'mvps'),
    },
  },

  // CHARTS (SOFTX / GLA, 2026-10-29): placa estadística de partido
  // (PREVIA / ENTRETIEMPO / FIN DE PARTIDO) diseñada en CSS, sin asset, con
  // datos de gla.futbol (server/charts.js). "chart" es el snapshot ya
  // normalizado del partido elegido; "tipo" solo cambia cómo se dibuja.
  charts: {
    id: 'charts',
    label: 'CHARTS',
    category: 'Charts',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      torneo: '',
      dia: '',
      partido: '',
      tipo: 'entretiempo', // 'previa' | 'entretiempo' | 'final'
      chart: null,
      ultimaActualizacionWeb: '',
    },
  },

  // BAULETI vs BALANZA (SOFTX [3], 2026-10-30): módulos propios del
  // sistema, dibujados en CSS (program/css/bb.css) y operados con paneles
  // dedicados (master-control/js/bb/). Ocultos en GLA y Argentina Streamers.
  // "bbMarcador" es además la fuente del PARTIDO: equipos, resultado, reloj,
  // período y "matchEvents" (incidencias); junto con las alineaciones de
  // "bbFormacion" forman el matchState único (shared/bb-match.js).
  bbMarcador: {
    id: 'bbMarcador',
    label: 'MARCADOR',
    category: 'Partido',
    layer: 'scoreboard',
    live: true,
    fields: [],
    defaults: {
      teamA: 'bauleti',
      teamB: 'balanza',
      scoreA: 0,
      scoreB: 0,
      clock: emptyClock(),
      clockEndText: '20:00',
      period: '1T',
      extraMinutes: 0,
      showExtra: false,
      showCrests: true,
      matchEvents: [],
      // "rounds" (2026-11-06): tanda inicial de 3 o 5 penales por equipo.
      penalties: { active: false, first: 'local', rounds: 5 },
    },
  },

  // MARCADOR DE PENALES (FASE 2): misma familia que el Marcador, en su lugar
  // (no conviven: TAKE de uno saca al otro). Los remates son eventos
  // "penaltyShootout" de bbMarcador.matchEvents; este módulo solo guarda
  // cómo se muestra. "live": se repinta solo cuando cambia la tanda.
  bbPenales: {
    id: 'bbPenales',
    label: 'PENALES',
    category: 'Partido',
    layer: 'scoreboard',
    live: true,
    fields: [],
    defaults: {
      mostrarResultado: true,
    },
  },

  // Placa chica de tarjeta (abajo a la izquierda). "event" es la copia del
  // evento de matchEvents (más la foto del jugador). Sale sola a los
  // "autoOutSec" segundos (0 = manual).
  bbTarjeta: {
    id: 'bbTarjeta',
    label: 'TARJETAS',
    category: 'Partido',
    layer: 'event',
    fields: [],
    defaults: {
      event: null,
      autoOutSec: 7,
      // JUGADOR: PLANTEL / MANUAL (2026-11-06). MANUAL = jugador de último
      // momento solo para el evento; el plantel no se toca.
      jugadorModo: 'plantel',
      manual: { nombre: '', dorsal: '' },
    },
  },

  // CAMBIOS: misma zona y mecánica que la Tarjeta; "event" es la copia del
  // evento "substitution" (con la foto del que entra).
  bbCambio: {
    id: 'bbCambio',
    label: 'CAMBIOS',
    category: 'Partido',
    layer: 'event',
    fields: [],
    defaults: {
      event: null,
      autoOutSec: 8,
      // ENTRA / SALE: PLANTEL o MANUAL, cada uno por su lado (2026-11-06).
      modoEntra: 'plantel',
      modoSale: 'plantel',
      manualEntra: { nombre: '', dorsal: '' },
      manualSale: { nombre: '', dorsal: '' },
    },
  },

  // VAR: placa compacta abajo a la izquierda (2026-11-06; antes arriba a la
  // derecha, en la zona de la mosca). Comparte zona y exclusión con Tarjeta,
  // Cambio y Zócalos.
  bbVar: {
    id: 'bbVar',
    label: 'VAR',
    category: 'Partido',
    layer: 'event',
    fields: [],
    defaults: {
      decision: 'chequeo',
      motivo: '',
    },
  },

  // GOL POR EQUIPO (FASE 2): capa propia debajo del Marcador, sin
  // reconstruirlo. La dispara "GOL +" del panel del Marcador con la copia del
  // evento; sale sola. "replay" cambia para REPETIR ANIMACIÓN DE GOL.
  bbGol: {
    id: 'bbGol',
    label: 'GOL',
    category: 'Partido',
    layer: 'event',
    fields: [],
    defaults: {
      event: null,
      texto: 'GOOOL',
      mostrarAutor: true,
      replay: 0,
    },
  },

  // FORMACIÓN 6v6: "equipos[teamId]" guarda esquema, titulares (arquero
  // primero, después las líneas de defensa a ataque) y suplentes como IDs
  // de PLANTELES, más "plantel" = copia de los datos visibles de esos
  // jugadores (dorsal/nombre/foto) que el panel refresca desde PLANTELES.
  bbFormacion: {
    id: 'bbFormacion',
    label: 'FORMACIÓN',
    category: 'Placas',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      side: 'local',
      titulo: 'FORMACIÓN',
      mostrarSuplentes: true,
      // VISUAL (2026-11-06): 'foto' (camiseta si no hay foto) | 'camiseta'.
      visual: 'foto',
      equipos: {},
    },
  },

  bbVs: {
    id: 'bbVs',
    label: 'VS PREPARTIDO',
    category: 'Placas',
    layer: 'fullscreen',
    fields: [
      { key: 'evento', label: 'Texto superior (evento)', type: FIELD_TYPES.TEXT },
      { key: 'detalle', label: 'Texto inferior (fecha / sede / hora)', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      // Nombre oficial del evento (metadata de shared/themes.js).
      evento: THEMES.bauletiBalanza.event.name,
      detalle: '',
    },
  },

  // VS RESULTADO: la composición del VS PREPARTIDO con el resultado del
  // matchState en lugar de la insignia VS (y los penales debajo, si hubo).
  bbVsResultado: {
    id: 'bbVsResultado',
    label: 'VS RESULTADO',
    category: 'Placas',
    layer: 'fullscreen',
    live: true,
    fields: [
      { key: 'titulo', label: 'Texto superior', type: FIELD_TYPES.TEXT },
      {
        key: 'penales',
        label: 'Penales',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'auto', label: 'AUTOMÁTICO (si hubo tanda)' },
          { id: 'si', label: 'MOSTRAR' },
          { id: 'no', label: 'NO MOSTRAR' },
        ],
      },
      { key: 'detalle', label: 'Texto inferior', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      titulo: 'RESULTADO FINAL',
      penales: 'auto',
      detalle: '',
    },
  },
  bbYaComenzamos: {
    id: 'bbYaComenzamos',
    label: 'YA COMENZAMOS',
    category: 'Placas',
    layer: 'fullscreen',
    // YA COMENZAMOS / GRACIAS POR VER (2026-11-06): placas de pantalla
    // completa de apertura y cierre, misma familia que el VS (escudos de los
    // equipos del Marcador, texto principal grande) con un loop de fondo
    // suave mientras están al aire. Ver program/js/renderers/bbPlacas.js.
    fields: [
      { key: 'titulo', label: 'Texto principal', type: FIELD_TYPES.TEXT },
      { key: 'evento', label: 'Texto superior (evento)', type: FIELD_TYPES.TEXT },
      { key: 'detalle', label: 'Texto inferior (opcional)', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      titulo: 'YA COMENZAMOS',
      evento: THEMES.bauletiBalanza.event.name,
      detalle: '',
    },
  },
  bbGraciasPorVer: {
    id: 'bbGraciasPorVer',
    label: 'GRACIAS POR VER',
    category: 'Placas',
    layer: 'fullscreen',
    fields: [
      { key: 'titulo', label: 'Texto principal', type: FIELD_TYPES.TEXT },
      { key: 'evento', label: 'Texto superior (evento)', type: FIELD_TYPES.TEXT },
      { key: 'detalle', label: 'Texto inferior (opcional)', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      titulo: 'GRACIAS POR VER',
      evento: THEMES.bauletiBalanza.event.name,
      detalle: '',
    },
  },
  // MOSCA PDM (2026-11-06): arriba a la derecha, "PDM" que cada ~40 s se
  // despliega en "#PARTIDODELMOMENTO" y vuelve. El ciclo es CSS (sin timers,
  // ver program/js/renderers/bbMosca.js); cambiar ROTACIÓN o INTERVALO y
  // ACTUALIZAR lo reinicia desde PDM. Convive con todo; debajo de las placas
  // de pantalla completa queda oculta.
  bbMoscaPdm: {
    id: 'bbMoscaPdm',
    label: 'MOSCA PDM',
    category: 'Mosca',
    layer: 'bug',
    fields: [
      {
        key: 'rotacion',
        label: 'Rotación PDM ↔ #PARTIDODELMOMENTO',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'si', label: 'ACTIVA' },
          { id: 'no', label: 'DESACTIVADA (solo PDM)' },
        ],
      },
      { key: 'intervalo', label: 'Intervalo entre hashtags (segundos, 3 a 600)', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      rotacion: 'si',
      intervalo: '40',
    },
  },

  // ZÓCALOS: tres formatos del mismo sistema, abajo a la izquierda.
  bbZocaloLargo: {
    id: 'bbZocaloLargo',
    label: 'ZÓCALO LARGO DOBLE',
    category: 'Zocalos',
    layer: 'lowerThird',
    fields: [
      { key: 'linea1', label: 'Línea principal', type: FIELD_TYPES.TEXT },
      { key: 'linea2', label: 'Línea secundaria', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      linea1: 'TEAM BAULETI VS TEAM BALANZA',
      linea2: THEMES.bauletiBalanza.event.name,
    },
  },

  bbZocaloCorto: {
    id: 'bbZocaloCorto',
    label: 'ZÓCALO CORTO SIMPLE',
    category: 'Zocalos',
    layer: 'lowerThird',
    fields: [
      { key: 'linea1', label: 'Texto', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      linea1: 'EN VIVO',
    },
  },

  bbZocaloCortoDoble: {
    id: 'bbZocaloCortoDoble',
    label: 'ZÓCALO CORTO DOBLE',
    category: 'Zocalos',
    layer: 'lowerThird',
    // CANTIDAD 1 / 2 / 3 (2026-11-06): 1 = la pieza de siempre; 2 =
    // izquierda + derecha (estructura espejada, texto normal); 3 = izquierda
    // + centro + derecha (relator, comentarista, tercera persona). Cada
    // persona tiene su propio nombre y cargo.
    fields: [
      {
        key: 'cantidad',
        label: 'CANTIDAD DE ZÓCALOS',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: '1', label: '1 ZÓCALO' },
          { id: '2', label: '2 ZÓCALOS (izquierda + derecha)' },
          { id: '3', label: '3 ZÓCALOS (izquierda + centro + derecha)' },
        ],
      },
      { key: 'linea1', label: 'IZQUIERDA — nombre (o única persona)', type: FIELD_TYPES.TEXT },
      { key: 'linea2', label: 'IZQUIERDA — cargo / descripción', type: FIELD_TYPES.TEXT },
      { key: 'linea1Cen', label: 'CENTRO — nombre (solo con 3)', type: FIELD_TYPES.TEXT },
      { key: 'linea2Cen', label: 'CENTRO — cargo / descripción (solo con 3)', type: FIELD_TYPES.TEXT },
      { key: 'linea1Der', label: 'DERECHA — nombre (con 2 o 3)', type: FIELD_TYPES.TEXT },
      { key: 'linea2Der', label: 'DERECHA — cargo / descripción (con 2 o 3)', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      cantidad: '1',
      linea1: 'NOMBRE APELLIDO',
      linea2: 'CARGO / DESCRIPCIÓN',
      linea1Cen: '',
      linea2Cen: '',
      linea1Der: '',
      linea2Der: '',
    },
  },

  // CHARTS BxB: PREVIA / ENTRETIEMPO / FINAL desde el matchState de SOFTX
  // (no usa gla.futbol). "destacados" = IDs de jugadores elegidos para la
  // PREVIA y "destacadosData" su copia visible (dorsal/nombre/foto);
  // "stats" = filas manuales { label, local, visitante }, el lugar preparado
  // para estadísticas históricas.
  bbCharts: {
    id: 'bbCharts',
    label: 'CHARTS',
    category: 'Charts',
    layer: 'fullscreen',
    live: true,
    fields: [],
    defaults: {
      tipo: 'entretiempo', // 'previa' | 'entretiempo' | 'final'
      titulo: '',
      evento: '',
      destacados: { local: [], visitante: [] },
      destacadosData: {},
      stats: [],
      // DETALLE DE GOLES de ENTRETIEMPO y FINAL (2026-11-06): 'con' = autores,
      // timeline e incidencias (lo de siempre); 'sin' = solo equipos, logos,
      // resultado y datos principales. No borra eventos.
      detalleGoles: { entretiempo: 'con', final: 'con' },
    },
  },

  // COPA 4 NACIONES (SOFTX [4], 2026-11-04): módulos "c4n*" (solo en su
  // navegación). Cada uno: capa de FONDO (PNG del diseñador, PENDIENTE por
  // ahora -> transparente), capa de CONTENIDO y motion de entrada/salida
  // (program/css/c4n.css). Ajuste independiente de capas (fondo / contenido
  // / tamaño de texto / espaciado) en C4N_LAYER, aplicado en vivo.
  // "c4nMarcador" es el partido en juego (matchState / matchEvents, mismo
  // modelo que shared/bb-match.js); "c4nDatos" guarda la vista efectiva del
  // torneo (fixture, tabla, rankings) que arma server/copa4naciones.js.
  c4nMarcador: {
    id: 'c4nMarcador',
    label: 'MARCADOR',
    category: 'Partido',
    layer: 'scoreboard',
    live: true,
    fields: [],
    // fuentePartido: 'fixture' (partido del fixture, como siempre) o 'manual'
    // (equipos elegidos a mano, sin tocar el fixture; ver el panel).
    defaults: {
      fuentePartido: 'fixture',
      matchId: 'm1',
      stageLabel: 'FASE DE GRUPOS',
      teamA: 'argentina',
      teamB: 'uruguay',
      scoreA: 0,
      scoreB: 0,
      clock: emptyClock(),
      clockEndText: '20:00',
      period: '1T',
      // TIEMPO ADICIONAL (shared/c4n-match.js extraTimeState): minutos,
      // inicio automático (al llegar al fin del tiempo) o manual (showExtra +
      // su propio reloj "extraClock", atado al período / partido "extraFor").
      extraMinutes: 0,
      extraAuto: true,
      showExtra: false,
      extraClock: emptyClock(),
      extraFor: '',
      matchEvents: [],
      penalties: { active: false, first: 'local', show: false },
      ...C4N_LAYER,
    },
  },

  c4nTarjeta: {
    id: 'c4nTarjeta',
    label: 'TARJETAS',
    category: 'Partido',
    layer: 'event',
    fields: [],
    defaults: { event: null, autoOutSec: 7, ...C4N_LAYER },
  },

  c4nCambio: {
    id: 'c4nCambio',
    label: 'CAMBIOS',
    category: 'Partido',
    layer: 'event',
    fields: [],
    defaults: { event: null, autoOutSec: 8, ...C4N_LAYER },
  },

  // PENAL SHOOTOUT (2026-11-15): pieza abajo a la izquierda sobre el PNG de
  // TARJETAS (escudo de la selección que patea, PENAL SHOOTOUT, reloj y fase
  // del partido). "lado": local / visitante del MARCADOR; "fase": vacío =
  // automática (la del partido del fixture), texto = a mano; "toma": sube en
  // cada PENAL SHOOTOUT del panel. El reloj arranca en 00:00 en cada TAKE (y
  // en cada "toma" nueva) y cuenta para adelante sin tope, hasta OUT. "live":
  // el tick de Program (500 ms) lo repinta; sin timers propios.
  c4nPenalShootout: {
    id: 'c4nPenalShootout',
    label: 'PENAL SHOOTOUT',
    category: 'Partido',
    layer: 'event',
    live: true,
    fields: [],
    defaults: { lado: 'local', fase: '', toma: 0, ...C4N_LAYER },
  },

  c4nZocaloTexto: {
    id: 'c4nZocaloTexto',
    label: 'ZÓCALO LARGO SIMPLE',
    category: 'Zocalos',
    layer: 'lowerThird',
    fields: [{ key: 'linea1', label: 'Texto', type: FIELD_TYPES.TEXT }],
    defaults: { linea1: 'COPA 4 NACIONES · SPEEDCAMP BUENOS AIRES', ...C4N_LAYER },
  },

  c4nZocaloTextoDoble: {
    id: 'c4nZocaloTextoDoble',
    label: 'ZÓCALO TEXTO DOBLE',
    category: 'Zocalos',
    layer: 'lowerThird',
    fields: [
      { key: 'linea1', label: 'Línea principal', type: FIELD_TYPES.TEXT },
      { key: 'linea2', label: 'Línea secundaria', type: FIELD_TYPES.TEXT },
    ],
    defaults: { linea1: 'COPA 4 NACIONES', linea2: '14 Y 15 DE NOVIEMBRE · SPEEDCAMP BUENOS AIRES', ...C4N_LAYER },
  },

  c4nZocaloCorto: {
    id: 'c4nZocaloCorto',
    label: 'ZÓCALO CORTO SIMPLE',
    category: 'Zocalos',
    layer: 'lowerThird',
    fields: [{ key: 'linea1', label: 'Texto', type: FIELD_TYPES.TEXT }],
    defaults: { linea1: 'EN VIVO', ...C4N_LAYER },
  },

  c4nZocaloCortoDoble: {
    id: 'c4nZocaloCortoDoble',
    label: 'ZÓCALO CORTO DOBLE',
    category: 'Zocalos',
    layer: 'lowerThird',
    // ZÓCALO CASTER (PNG real 2026-11-11). CANTIDAD 1 / 2 / 3 / 4 (misma lógica
    // que el zócalo de talentos de BxB): 1 = una placa; 2 = izquierda + derecha
    // (placa espejada, texto normal); 3 = izquierda + centro + derecha
    // (relator, comentarista, analista); 4 (2026-11-15) = cuatro placas
    // simétricas sobre el borde inferior (TALENTO 1 = IZQUIERDA, 2, 3 y
    // TALENTO 4 = DERECHA; 3 y 4 espejadas, el texto nunca). Cada placa:
    // nombre y cargo propios.
    fields: [
      {
        key: 'cantidad',
        label: 'CANTIDAD DE ZÓCALOS',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: '1', label: '1 ZÓCALO' },
          { id: '2', label: '2 ZÓCALOS (izquierda + derecha)' },
          { id: '3', label: '3 ZÓCALOS (izquierda + centro + derecha)' },
          { id: '4', label: '4 ZÓCALOS (talentos 1 · 2 · 3 · 4)' },
        ],
      },
      { key: 'linea1', label: 'IZQUIERDA / TALENTO 1 — nombre (o única persona)', type: FIELD_TYPES.TEXT },
      { key: 'linea2', label: 'IZQUIERDA / TALENTO 1 — cargo / descripción', type: FIELD_TYPES.TEXT },
      { key: 'linea1T2', label: 'TALENTO 2 — nombre (solo con 4)', type: FIELD_TYPES.TEXT },
      { key: 'linea2T2', label: 'TALENTO 2 — cargo / descripción (solo con 4)', type: FIELD_TYPES.TEXT },
      { key: 'linea1Cen', label: 'CENTRO — nombre (solo con 3)', type: FIELD_TYPES.TEXT },
      { key: 'linea2Cen', label: 'CENTRO — cargo / descripción (solo con 3)', type: FIELD_TYPES.TEXT },
      { key: 'linea1T3', label: 'TALENTO 3 — nombre (solo con 4)', type: FIELD_TYPES.TEXT },
      { key: 'linea2T3', label: 'TALENTO 3 — cargo / descripción (solo con 4)', type: FIELD_TYPES.TEXT },
      { key: 'linea1Der', label: 'DERECHA / TALENTO 4 — nombre (con 2, 3 o 4)', type: FIELD_TYPES.TEXT },
      { key: 'linea2Der', label: 'DERECHA / TALENTO 4 — cargo / descripción (con 2, 3 o 4)', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      cantidad: '1',
      linea1: 'NOMBRE APELLIDO',
      linea2: 'CARGO / DESCRIPCIÓN',
      linea1T2: 'NOMBRE APELLIDO',
      linea2T2: 'CARGO / DESCRIPCIÓN',
      linea1Cen: 'NOMBRE APELLIDO',
      linea2Cen: 'ANALISTA',
      linea1T3: 'NOMBRE APELLIDO',
      linea2T3: 'CARGO / DESCRIPCIÓN',
      linea1Der: 'NOMBRE APELLIDO',
      linea2Der: 'COMENTARISTA',
      ...C4N_LAYER,
    },
  },

  // Logo (evento o equipo) + texto + rotativo de mensajes + sponsor.
  // ZÓCALO COMPUESTO (PNG real): izquierda PARTIDO (escudos del partido del
  // MARCADOR, fixture o manual) o COPA 4 NACIONES (logo + texto de la copa),
  // dos renglones y rotativo de sponsors (logos elegidos en ROTATIVO
  // SPONSORS). "live": sigue al partido del Marcador estando al aire.
  c4nZocaloCompuesto: {
    id: 'c4nZocaloCompuesto',
    label: 'ZÓCALO COMPUESTO',
    category: 'Zocalos',
    layer: 'lowerThird',
    live: true,
    fields: [
      {
        key: 'izquierda',
        label: 'Sector izquierdo',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'copa', label: 'COPA 4 NACIONES (logo + texto)' },
          { id: 'partido', label: 'PARTIDO (escudos del Marcador)' },
        ],
      },
      { key: 'texto', label: 'Renglón 1 (banda azul)', type: FIELD_TYPES.TEXT },
      { key: 'texto2', label: 'Renglón 2', type: FIELD_TYPES.TEXT },
      {
        key: 'sponsorsRotacion',
        label: 'Rotación sponsors (recuadro derecho)',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'si', label: 'ACTIVA (todos los logos de la carpeta)' },
          { id: 'no', label: 'DESACTIVADA (solo el primer logo)' },
        ],
      },
      { key: 'intervaloSec', label: 'Segundos por sponsor (2 a 60)', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      sponsorsRotacion: 'si',
      izquierda: 'copa',
      texto: 'COPA 4 NACIONES',
      texto2: '14 Y 15 DE NOVIEMBRE · SPEEDCAMP BUENOS AIRES',
      intervaloSec: '6',
      ...C4N_LAYER,
    },
  },

  c4nMoscaLogo: {
    id: 'c4nMoscaLogo',
    label: 'MOSCA LOGO',
    category: 'Mosca',
    layer: 'bug',
    fields: [],
    defaults: { ...C4N_LAYER },
  },

  c4nMoscaTexto: {
    id: 'c4nMoscaTexto',
    label: 'MOSCA TEXTO',
    category: 'Mosca',
    layer: 'bug',
    fields: [
      { key: 'linea1', label: 'Línea 1', type: FIELD_TYPES.TEXT },
      { key: 'linea2', label: 'Línea 2', type: FIELD_TYPES.TEXT },
    ],
    defaults: { linea1: 'COPA 4 NACIONES', linea2: 'EN VIVO', ...C4N_LAYER },
  },

  // MOSCA C4N (2026-11-11): reemplaza a MOSCA LOGO + MOSCA TEXTO (quedan
  // definidas pero fuera del panel). Logo de la copa arriba a la derecha y,
  // con ROTACIÓN ACTIVA, cada INTERVALO segundos el texto "COPA / CUATRO
  // NACIONES" se despliega a su izquierda, queda unos segundos y vuelve a
  // cerrarse (mismo funcionamiento que la MOSCA PDM de BxB, identidad C4N).
  c4nMosca: {
    id: 'c4nMosca',
    label: 'MOSCA C4N',
    category: 'Mosca',
    layer: 'bug',
    fields: [
      {
        key: 'rotacion',
        label: 'Rotación LOGO ↔ TEXTO',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'si', label: 'ACTIVA' },
          { id: 'no', label: 'DESACTIVADA (solo el logo)' },
        ],
      },
      { key: 'intervalo', label: 'Intervalo entre textos (segundos, 3 a 600; por defecto 40)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { rotacion: 'si', intervalo: '40', ...C4N_LAYER },
  },

  // VAR (2026-11-11): placa abajo a la izquierda sobre el PNG real
  // ("ZOCALO_VAR.png"), misma lógica que el VAR de BxB: decisión con un clic,
  // MOTIVO, cambio al aire sin rearmar la placa y REGISTRAR EN EL PARTIDO.
  c4nVar: {
    id: 'c4nVar',
    label: 'VAR',
    category: 'Partido',
    layer: 'event',
    // live: la lista de sponsors (RECARGAR) llega también con el VAR al aire.
    live: true,
    fields: [],
    // SPONSORS A LA DERECHA (2026-11-13): MOSTRAR / OCULTAR el mismo rotativo
    // de sponsors del ZÓCALO COMPUESTO (carpeta, rotación e intervalo de ese
    // módulo) en un recuadro a la derecha de la placa.
    defaults: { decision: 'chequeo', motivo: '', sponsors: 'ocultar', ...C4N_LAYER },
  },

  // SPONSORS (2026-11-13): placas de premio con sponsor sobre los PNG reales
  // (MVP DEL PARTIDO · PRAGMATIC PLAY, con el escudo de cada selección;
  // BALÓN DE ORO · COMPRA GAMER; GUANTE DE ORO · MOSTAZA; BOTÍN DE ORO ·
  // SPEED LÍDER). JUGADOR AUTOMÁTICO = el operador elige selección y jugador
  // del plantel (nombre y PNG se completan solos; el sistema nunca elige al
  // ganador) o MANUAL = texto libre. Piezas y geometría: shared/c4n-assets.js.
  c4nSponsors: {
    id: 'c4nSponsors',
    label: 'SPONSORS',
    category: 'Sponsors',
    layer: 'lowerThird',
    fields: [],
    defaults: { pieza: 'mvp', modo: 'auto', pais: 'argentina', jugador: null, nombre: '', escudo: '', ...C4N_LAYER },
  },

  // Rotativo de sponsors: logos PNG de assets/themes/copa4naciones/sponsors/
  // ("archivos" = elegidos en el panel; vacío = todos los de la carpeta).
  c4nRotativoSponsors: {
    id: 'c4nRotativoSponsors',
    label: 'ROTATIVO SPONSORS',
    category: 'Mosca',
    layer: 'bug',
    fields: [],
    defaults: { archivos: [], intervaloSec: 6, ...C4N_LAYER },
  },

  // Grupo L (zona derecha, mutuamente excluyentes): leen la vista efectiva
  // del torneo de "c4nDatos" (WEB o SOFTX según ACTUALIZADOR DE DATOS).
  // FUENTE por módulo: "auto" (ese dato) o "manual" (filas cargadas en el
  // propio módulo, snapshot separado: cambiar de fuente nunca borra el otro).
  c4nGoleadores: {
    id: 'c4nGoleadores',
    label: 'TABLA GOLEADORES',
    category: 'Tablas',
    layer: 'placaL',
    live: true,
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    defaults: { titulo: 'GOLEADORES', filas: 8, fuente: 'auto', manual: [], ...C4N_LAYER },
  },

  c4nAsistencias: {
    id: 'c4nAsistencias',
    label: 'TABLA ASISTENCIAS',
    category: 'Tablas',
    layer: 'placaL',
    live: true,
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    defaults: { titulo: 'ASISTENCIAS', filas: 8, fuente: 'auto', manual: [], ...C4N_LAYER },
  },

  c4nGA: {
    id: 'c4nGA',
    label: 'TABLA G+A',
    category: 'Tablas',
    layer: 'placaL',
    live: true,
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    defaults: { titulo: 'MEJORES JUGADORES · G+A', filas: 8, fuente: 'auto', manual: [], ...C4N_LAYER },
  },

  c4nPosiciones: {
    id: 'c4nPosiciones',
    label: 'TABLA DE POSICIONES',
    category: 'Tablas',
    layer: 'placaL',
    live: true,
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    // grupos (2026-11-10): asignación MANUAL de cada selección a GRUPO A / B
    // ({ teamId: 'A' | 'B' }); la web oficial publica una sola fase de grupos.
    // Vacía = un solo bloque con la tabla completa.
    defaults: { titulo: 'POSICIONES', grupos: {}, ...C4N_LAYER },
  },

  // TABLA VS (2026-11-11): placa de enfrentamiento (escudo + nombre de cada
  // equipo, VS, horario y fase) sobre TABLA_L, en la zona L. Fuente FIXTURE
  // (un partido del fixture efectivo, con AJUSTES opcionales solo de la placa)
  // o MANUAL (todo a mano). Nunca modifica el fixture: ver resolveTablaVs en
  // shared/c4n-match.js. Panel propio (master-control/js/c4n/c4n-tablavs-panel.js).
  c4nTablaVs: {
    id: 'c4nTablaVs',
    label: 'TABLA VS',
    category: 'Tablas',
    layer: 'placaL',
    fields: [],
    defaults: {
      fuente: 'fixture',
      matchId: '',
      ajuste: { teamA: '', teamB: '', crestA: '', crestB: '', nameA: '', nameB: '', horario: '', dia: '', fase: '' },
      manual: { teamA: 'argentina', teamB: 'uruguay', crestA: '', crestB: '', nameA: '', nameB: '', horario: '', dia: '', fase: 'FASE DE GRUPOS' },
      ...C4N_LAYER,
    },
  },

  // TABLA FIXTURE (2026-11-15): los partidos de un día sobre TABLA_L (la L de
  // las tablas), con tarjetas blancas como la TABLA DE POSICIONES. Mismos
  // partidos que FIXTURE (fixture efectivo de "c4nDatos"); "dia": auto (hoy) /
  // sabado / domingo; "ocultos": partidos que no se muestran; "ajustes":
  // { [matchId]: { hora, fase, local, visitante } } SOLO de esta placa (nunca
  // tocan el FIXTURE ni la web). "live": un resultado nuevo se ve al aire.
  c4nTablaFixture: {
    id: 'c4nTablaFixture',
    label: 'TABLA FIXTURE',
    category: 'Tablas',
    layer: 'placaL',
    live: true,
    fields: [],
    defaults: {
      kicker: 'COPA CUATRO NACIONES',
      titulo: 'FIXTURE DE HOY',
      pie: 'SEGUÍ TODAS LAS ESTADÍSTICAS Y RESULTADOS DESDE COPA4NACIONES.COM',
      dia: 'auto',
      ocultos: [],
      ajustes: {},
      ...C4N_LAYER,
    },
  },

  c4nPromoWeb: {
    id: 'c4nPromoWeb',
    label: 'PROMO WEB',
    category: 'Tablas',
    layer: 'placaL',
    // 2026-11-11: pieza editorial sobre TABLA_L (mensaje, los 4 escudos, la
    // web protagonista, texto secundario y SPEED CAMP).
    fields: [
      { key: 'mensaje1', label: 'Mensaje (línea 1)', type: FIELD_TYPES.TEXT },
      { key: 'mensaje2', label: 'Mensaje (línea 2)', type: FIELD_TYPES.TEXT },
      { key: 'web', label: 'Dirección web', type: FIELD_TYPES.TEXT },
      { key: 'bajada', label: 'Texto secundario', type: FIELD_TYPES.TEXT },
      { key: 'sede', label: 'Sede', type: FIELD_TYPES.TEXT },
      { key: 'pie', label: 'Pie', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      mensaje1: 'SEGUÍ TODOS LOS DATOS', mensaje2: 'DESDE NUESTRA WEB', web: 'COPA4NACIONES.COM',
      bajada: 'RESULTADOS, ESTADÍSTICAS Y POSICIONES EN VIVO', sede: 'SPEED CAMP', pie: 'COPA 4 NACIONES · BUENOS AIRES',
      ...C4N_LAYER,
    },
  },

  // Destacado / comparativa de jugadores (500×150): uno por selección.
  c4nMejoresJugadores: {
    id: 'c4nMejoresJugadores',
    label: 'MEJORES JUGADORES',
    category: 'Tablas',
    layer: 'lowerThird',
    // 2026-11-12: DATO = 'goals' / 'assists' / 'contributions' (el mejor de cada
    // selección del ranking efectivo, automático) o 'custom' (PERSONALIZADO: la
    // elección manual de siempre, en "jugadores"). "live": si los rankings
    // cambian con la placa al aire, se actualiza sola.
    live: true,
    fields: [],
    defaults: { titulo: 'JUGADORES A SEGUIR', dato: 'goals', jugadores: [], ...C4N_LAYER },
  },

  // FIXTURE del evento (placa 1500×950): partidos de un día (SÁBADO o
  // DOMINGO) del fixture efectivo de "c4nDatos" (fuente WEB o MANUAL elegida
  // en ACTUALIZADOR DE DATOS) con los resultados guardados desde el Marcador
  // y los cruces resueltos solos (1º-4º / 2º-3º, final y tercer puesto).
  c4nFixture: {
    id: 'c4nFixture',
    label: 'FIXTURE',
    category: 'Placas',
    layer: 'fullscreen',
    live: true,
    fields: [
      {
        key: 'dia',
        label: 'Día',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'sabado', label: 'SÁBADO' },
          { id: 'domingo', label: 'DOMINGO' },
        ],
      },
      { key: 'titulo', label: 'Título (vacío = FIXTURE · día)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { dia: 'sabado', titulo: '', ...C4N_LAYER },
  },

  c4nVsPrepartido: {
    id: 'c4nVsPrepartido',
    label: 'VS PREPARTIDO',
    category: 'Placas',
    layer: 'fullscreen',
    fields: [
      { key: 'titulo', label: 'Título / fase (vacío = la del partido)', type: FIELD_TYPES.TEXT },
      { key: 'detalle', label: 'Horario / detalle (vacío = el del fixture)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { titulo: '', detalle: '', ...C4N_LAYER },
  },

  c4nVsResultado: {
    id: 'c4nVsResultado',
    label: 'VS RESULTADO',
    category: 'Placas',
    layer: 'fullscreen',
    live: true,
    fields: [
      { key: 'titulo', label: 'Título / fase (vacío = la del partido)', type: FIELD_TYPES.TEXT },
      { key: 'estado', label: 'Subtítulo (vacío = automático: EN JUEGO · 1T / ENTRETIEMPO / FINAL DEL PARTIDO; "-" = sin subtítulo)', type: FIELD_TYPES.TEXT },
      {
        key: 'penales',
        label: 'Penales',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'auto', label: 'AUTOMÁTICO (si hubo tanda)' },
          { id: 'si', label: 'MOSTRAR' },
          { id: 'no', label: 'NO MOSTRAR' },
        ],
      },
    ],
    defaults: { titulo: '', estado: '', penales: 'auto', ...C4N_LAYER },
  },

  // FORMACIÓN: equipos[teamId] = { esquema, titulares[], suplentes[], plantel{} }
  // con IDs del plantel efectivo (WEB o MANUAL) y la copia visible.
  c4nFormacion: {
    id: 'c4nFormacion',
    label: 'FORMACIÓN',
    category: 'Placas',
    layer: 'fullscreen',
    fields: [],
    defaults: { side: 'local', titulo: 'FORMACIÓN', mostrarSuplentes: true, equipos: {}, ...C4N_LAYER },
  },

  c4nStatsPrevia: {
    id: 'c4nStatsPrevia',
    label: 'ESTADÍSTICAS PREVIA',
    category: 'Charts',
    layer: 'fullscreen',
    live: true,
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    defaults: { titulo: 'PREVIA', fuente: 'auto', manual: { local: {}, visitante: {} }, ...C4N_LAYER },
  },

  c4nStatsEntretiempo: {
    id: 'c4nStatsEntretiempo',
    label: 'ESTADÍSTICAS ENTRETIEMPO',
    category: 'Charts',
    layer: 'fullscreen',
    live: true,
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    defaults: {
      // FUENTE DE INCIDENCIAS (2026-11-11): 'softx' (lo de siempre) o 'web' (sync en vivo).
      incidencias: 'softx',
      titulo: 'ENTRETIEMPO', fuente: 'auto', manual: { scoreA: 0, scoreB: 0, penA: '', penB: '', events: [] }, ...C4N_LAYER },
  },

  c4nStatsFinal: {
    id: 'c4nStatsFinal',
    label: 'ESTADÍSTICAS FINAL',
    category: 'Charts',
    layer: 'fullscreen',
    live: true,
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    defaults: {
      // FUENTE DE INCIDENCIAS (2026-11-11): 'softx' (lo de siempre) o 'web' (sync en vivo).
      incidencias: 'softx',
      titulo: 'FINAL DEL PARTIDO', fuente: 'auto', manual: { scoreA: 0, scoreB: 0, penA: '', penB: '', events: [] }, ...C4N_LAYER },
  },

  // Vista efectiva del torneo (la escribe SOLO el servidor): pestaña
  // ACTUALIZADOR DE DATOS, nunca va al aire.
  c4nDatos: {
    id: 'c4nDatos',
    label: 'ACTUALIZADOR DE DATOS',
    category: 'General',
    layer: 'data',
    fields: [],
    defaults: {
      fixture: [],
      standings: { rows: [], source: 'calculada', hasResults: false, unresolvedTies: false },
      rankings: { goals: [], assists: [], contributions: [], source: 'softx' },
      tournament: { name: 'COPA 4 NACIONES', dates: '14 Y 15 DE NOVIEMBRE DE 2026', venue: 'SPEEDCAMP BUENOS AIRES' },
      webUpdatedAt: '',
      updatedAt: '',
    },
  },

  // =====================================================================
  // GLA SUPERCOPA (SOFTX [5], 2026-11-24): módulos "sc*" (solo en su
  // navegación). Misma operación que COPA 4 NACIONES (partido en juego con el
  // modelo de shared/bb-match.js, FIXTURE / MANUAL, ajuste de capas,
  // Preview multicapa, REINICIAR TODO), identidad propia: PNG de
  // shared/sc-assets.js y motion de program/css/sc.css. SIN ESTADÍSTICAS.
  // =====================================================================
  scMarcador: {
    id: 'scMarcador',
    label: 'MARCADOR',
    category: 'Partido',
    layer: 'scoreboard',
    live: true,
    fields: [],
    // Sin equipos precargados: se eligen en el panel (FIXTURE o MANUAL).
    // Tiempo adicional: "+N" es solo el aviso; la cuenta sigue sin tope
    // (shared/c4n-match.js extraTimeState). Penales: tanda de 3 (como GLA) o 5.
    defaults: {
      fuentePartido: 'fixture',
      matchId: '',
      stageLabel: '',
      teamA: '',
      teamB: '',
      scoreA: 0,
      scoreB: 0,
      clock: emptyClock(),
      clockEndText: '20:00',
      period: '1T',
      extraMinutes: 0,
      extraAuto: true,
      showExtra: false,
      extraClock: emptyClock(),
      extraFor: '',
      matchEvents: [],
      penalties: { active: false, first: 'local', show: false, rounds: 3 },
      ...SC_LAYER,
    },
  },

  scTarjeta: {
    id: 'scTarjeta',
    label: 'TARJETAS',
    category: 'Partido',
    layer: 'event',
    fields: [],
    defaults: { event: null, autoOutSec: 7, ...SC_LAYER },
  },

  // CAMBIOS v2: "lista" = CAMBIO 1..N preparados en el panel (equipo, sale,
  // entra, dorsales, minuto); "secuencia" = lo que sale al aire en el TAKE:
  // un cambio (pieza normal, sale sola a los autoOutSec) o varios en orden,
  // "segPorCambio" segundos cada uno (solo cambian los textos) y al terminar
  // el último sale la pieza entera.
  scCambio: {
    id: 'scCambio',
    label: 'CAMBIOS',
    category: 'Partido',
    layer: 'event',
    fields: [],
    defaults: { event: null, secuencia: [], lista: [], segPorCambio: 5, autoOutSec: 8, ...SC_LAYER },
  },

  // VAR: placa del PNG real en una de sus 3 posiciones; decisión con un clic,
  // MOTIVO y cambio al aire sin rearmar la placa.
  scVar: {
    id: 'scVar',
    label: 'VAR',
    category: 'Partido',
    layer: 'event',
    fields: [
      {
        key: 'posicion',
        label: 'Posición de la placa',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'abajoIzq', label: 'ABAJO A LA IZQUIERDA' },
          { id: 'arribaDer', label: 'ARRIBA A LA DERECHA' },
          { id: 'abajoDer', label: 'ABAJO A LA DERECHA' },
        ],
      },
    ],
    defaults: { decision: 'chequeo', motivo: '', posicion: 'abajoIzq', ...SC_LAYER },
  },

  // PENAL SHOOTOUT v2 (referencia 2026-11-25): [ESCUDO] | "10. MASSI" /
  // filete / "CRONÓMETRO: 00:00". Equipo (lado del Marcador o teamId elegido),
  // jugador del plantel o manual; cronómetro desde 00:00 en cada TAKE (toma
  // nueva), sin tope. "live": el tick de Program lo repinta, sin timers propios.
  scPenalShootout: {
    id: 'scPenalShootout',
    label: 'PENAL SHOOTOUT',
    category: 'Partido',
    layer: 'event',
    live: true,
    fields: [],
    defaults: { lado: 'local', teamId: '', jugador: null, fase: '', toma: 0, ...SC_LAYER },
  },

  scVsPrepartido: {
    id: 'scVsPrepartido',
    label: 'VS PREPARTIDO',
    category: 'Presentación',
    layer: 'lowerThird',
    // ESTADO (v2): la placa de arriba (A CONTINUACIÓN / EN JUEGO - 1T /
    // ENTRETIEMPO / EN JUEGO - 2T / FINAL / MANUAL) se maneja en la sección
    // ESTADO del panel (automático desde el Marcador o elegido a mano). "live":
    // en AUTOMÁTICO sigue al Marcador.
    live: true,
    fields: [
      { key: 'titulo', label: 'Fase (vacío = la del partido)', type: FIELD_TYPES.TEXT },
      { key: 'detalle', label: 'Horario / detalle (vacío = el del fixture; solo con A CONTINUACIÓN)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { titulo: '', detalle: '', estadoModo: 'auto', estadoManual: '', ...SC_LAYER },
  },

  scVsResultado: {
    id: 'scVsResultado',
    label: 'VS RESULTADO',
    category: 'Presentación',
    layer: 'lowerThird',
    live: true,
    // ESTADO (v2): sección ESTADO del panel (misma que VS PREPARTIDO).
    fields: [
      {
        key: 'penales',
        label: 'Penales',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'auto', label: 'AUTOMÁTICO (si hubo tanda)' },
          { id: 'si', label: 'MOSTRAR' },
          { id: 'no', label: 'NO MOSTRAR' },
        ],
      },
    ],
    defaults: { estado: '', estadoModo: 'auto', estadoManual: '', penales: 'auto', ...SC_LAYER },
  },

  // FORMACIÓN: equipos[teamId] = { esquema, titulares[], suplentes[], plantel{} }
  // (misma operación que la COPA: MANUAL, POR LISTA, GUARDAR / USAR ANTERIOR).
  // "formato": jugadores por equipo (6 = GLA, 11 = fútbol 11).
  scFormacion: {
    id: 'scFormacion',
    label: 'FORMACIÓN',
    category: 'Presentación',
    layer: 'fullscreen',
    fields: [],
    defaults: { side: 'local', titulo: 'FORMACIÓN', mostrarSuplentes: true, formato: '6', equipos: {}, ...SC_LAYER },
  },

  // FIXTURE: partidos de "scDatos".fixture (WEB SUPERCOPA o MANUAL; el
  // resultado llega desde el MARCADOR) sobre la PLACA nueva. Por jugar = barra
  // VS; jugado = barra VS RESULTADO (penales aparte, nunca mezclados con el
  // resultado). "dia": 'auto' (el próximo día con partidos por jugar), 'todos'
  // o la fecha AAAA-MM-DD (hasta 9 partidos por placa).
  scFixture: {
    id: 'scFixture',
    label: 'FIXTURE',
    category: 'Presentación',
    layer: 'fullscreen',
    live: true,
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    defaults: { titulo: 'FIXTURE', dia: 'auto', ocultos: [], ...SC_LAYER },
  },

  // PRESENTACIÓN DE PARTIDO (v3, 2026-11-25): sobre la misma PLACA de
  // FORMACIÓN, cumple la función de la placa VS de la COPA con el partido del
  // MARCADOR: escudos grandes, nombre abajo de cada uno con zócalo gris (mismo
  // tamaño y mismos renglones en los dos) y zócalo con la FASE / INSTANCIA.
  // "live": sigue al Marcador (equipos) y al fixture (fase / horario).
  scPresentacion: {
    id: 'scPresentacion',
    label: 'PRESENTACIÓN DE PARTIDO',
    category: 'Presentación',
    layer: 'fullscreen',
    live: true,
    fields: [
      {
        key: 'fase',
        label: 'Fase / instancia (zócalo de abajo)',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'auto', label: 'DEL PARTIDO (fixture / Marcador)' },
          { id: 'grupos', label: 'FASE DE GRUPOS' },
          { id: 'semi1', label: 'SEMIFINAL 1' },
          { id: 'semi2', label: 'SEMIFINAL 2' },
          { id: 'final', label: 'FINAL' },
          { id: 'granFinal', label: 'GRAN FINAL' },
          { id: 'manual', label: 'MANUAL (texto de abajo)' },
          { id: 'ninguna', label: 'SIN ZÓCALO DE FASE' },
        ],
      },
      { key: 'faseTexto', label: 'Fase MANUAL (con "MANUAL")', type: FIELD_TYPES.TEXT },
      { key: 'titulo', label: 'Título de la cabecera', type: FIELD_TYPES.TEXT },
      { key: 'detalle', label: 'Día / horario (cabecera; vacío = el del fixture)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { fase: 'auto', faseTexto: '', titulo: 'GLA SUPERCOPA', detalle: '', ...SC_LAYER },
  },

  // PLACA VS RESULTADO (v3): misma familia que PRESENTACIÓN DE PARTIDO, con el
  // recuadro de goles claro al centro. "resultado": 'normal' (2 - 1),
  // 'penales' (2(3) - 2(2)) o 'auto' (con penales si hubo tanda en el
  // Marcador). Penales MANUALES opcionales (vacío = los de la tanda). ESTADO
  // (cabecera) con la misma sección del panel que VS RESULTADO.
  scPlacaResultado: {
    id: 'scPlacaResultado',
    label: 'PLACA VS RESULTADO',
    category: 'Presentación',
    layer: 'fullscreen',
    live: true,
    fields: [
      {
        key: 'resultado',
        label: 'Resultado',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'auto', label: 'AUTOMÁTICO (con penales si hubo tanda)' },
          { id: 'normal', label: 'NORMAL · 2 - 1' },
          { id: 'penales', label: 'CON PENALES · 2(3) - 2(2)' },
        ],
      },
      { key: 'penLocal', label: 'Penales LOCAL (vacío = tanda del Marcador)', type: FIELD_TYPES.TEXT },
      { key: 'penVisitante', label: 'Penales VISITANTE (vacío = tanda del Marcador)', type: FIELD_TYPES.TEXT },
      {
        key: 'fase',
        label: 'Fase / instancia (zócalo de abajo)',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'auto', label: 'DEL PARTIDO (fixture / Marcador)' },
          { id: 'grupos', label: 'FASE DE GRUPOS' },
          { id: 'semi1', label: 'SEMIFINAL 1' },
          { id: 'semi2', label: 'SEMIFINAL 2' },
          { id: 'final', label: 'FINAL' },
          { id: 'granFinal', label: 'GRAN FINAL' },
          { id: 'manual', label: 'MANUAL (texto de abajo)' },
          { id: 'ninguna', label: 'SIN ZÓCALO DE FASE' },
        ],
      },
      { key: 'faseTexto', label: 'Fase MANUAL (con "MANUAL")', type: FIELD_TYPES.TEXT },
      { key: 'titulo', label: 'Título de la cabecera', type: FIELD_TYPES.TEXT },
    ],
    defaults: { resultado: 'auto', penLocal: '', penVisitante: '', fase: 'auto', faseTexto: '', titulo: 'GLA SUPERCOPA', estadoModo: 'auto', estadoManual: '', ...SC_LAYER },
  },

  // ZÓCALO CORTO: una persona. Con CARGO usa la placa CORTO DOBLE; sin cargo,
  // la CORTO SIMPLE.
  scZocaloCorto: {
    id: 'scZocaloCorto',
    label: 'ZÓCALO CORTO',
    category: 'Zocalos',
    layer: 'lowerThird',
    fields: [
      { key: 'linea1', label: 'Nombre', type: FIELD_TYPES.TEXT },
      { key: 'linea2', label: 'Cargo (vacío = placa simple, solo el nombre)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { linea1: 'NOMBRE APELLIDO', linea2: 'CARGO / DESCRIPCIÓN', ...SC_LAYER },
  },

  // TALENTOS: 1 / 2 / 3 / 4 placas CORTO DOBLE simétricas (la mitad derecha
  // espejada, el texto nunca), cada una con nombre y cargo. v2: todas con el
  // tamaño compacto de 4.
  scTalentos: {
    id: 'scTalentos',
    label: 'TALENTOS',
    category: 'Zocalos',
    layer: 'lowerThird',
    fields: [
      {
        key: 'cantidad',
        label: 'CANTIDAD',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: '1', label: '1 TALENTO' },
          { id: '2', label: '2 TALENTOS' },
          { id: '3', label: '3 TALENTOS' },
          { id: '4', label: '4 TALENTOS' },
        ],
      },
      { key: 'nombre1', label: 'TALENTO 1 — nombre', type: FIELD_TYPES.TEXT },
      { key: 'cargo1', label: 'TALENTO 1 — cargo', type: FIELD_TYPES.TEXT },
      { key: 'nombre2', label: 'TALENTO 2 — nombre (con 2, 3 o 4)', type: FIELD_TYPES.TEXT },
      { key: 'cargo2', label: 'TALENTO 2 — cargo', type: FIELD_TYPES.TEXT },
      { key: 'nombre3', label: 'TALENTO 3 — nombre (con 3 o 4)', type: FIELD_TYPES.TEXT },
      { key: 'cargo3', label: 'TALENTO 3 — cargo', type: FIELD_TYPES.TEXT },
      { key: 'nombre4', label: 'TALENTO 4 — nombre (con 4)', type: FIELD_TYPES.TEXT },
      { key: 'cargo4', label: 'TALENTO 4 — cargo', type: FIELD_TYPES.TEXT },
    ],
    defaults: {
      cantidad: '2',
      nombre1: 'NOMBRE APELLIDO', cargo1: 'RELATOR',
      nombre2: 'NOMBRE APELLIDO', cargo2: 'COMENTARISTA',
      nombre3: 'NOMBRE APELLIDO', cargo3: 'ANALISTA',
      nombre4: 'NOMBRE APELLIDO', cargo4: 'CAMPO DE JUEGO',
      ...SC_LAYER,
    },
  },

  // ZÓCALO LARGO: con texto secundario usa LARGO DOBLE; sin él, LARGO SIMPLE.
  scZocaloLargo: {
    id: 'scZocaloLargo',
    label: 'ZÓCALO LARGO',
    category: 'Zocalos',
    layer: 'lowerThird',
    fields: [
      { key: 'linea1', label: 'Texto principal', type: FIELD_TYPES.TEXT },
      { key: 'linea2', label: 'Texto secundario (vacío = placa simple)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { linea1: 'GLA SUPERCOPA', linea2: '', ...SC_LAYER },
  },

  // ZÓCALO L (compuesto, franja inferior): izquierda SUPERCOPA (emblema GLA +
  // rótulo) o PARTIDO (escudos del Marcador), dos renglones y sponsors (logos
  // de assets/themes/supercopa/sponsors/; sin logos, el emblema). "live":
  // sigue al partido del Marcador.
  scZocaloL: {
    id: 'scZocaloL',
    label: 'ZÓCALO L',
    category: 'Zocalos',
    layer: 'lowerThird',
    live: true,
    fields: [
      {
        key: 'izquierda',
        label: 'Sector izquierdo',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'supercopa', label: 'SUPERCOPA (emblema GLA)' },
          { id: 'partido', label: 'PARTIDO (escudos del Marcador)' },
        ],
      },
      { key: 'texto', label: 'Renglón 1 (papel claro)', type: FIELD_TYPES.TEXT },
      { key: 'texto2', label: 'Renglón 2 (franja oscura)', type: FIELD_TYPES.TEXT },
      {
        key: 'sponsorsRotacion',
        label: 'Sponsors (recuadro derecho)',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'si', label: 'ROTACIÓN ACTIVA (todos los logos de la carpeta)' },
          { id: 'no', label: 'SOLO EL PRIMER LOGO' },
        ],
      },
      { key: 'intervaloSec', label: 'Segundos por sponsor (2 a 60)', type: FIELD_TYPES.TEXT },
    ],
    defaults: { izquierda: 'supercopa', texto: 'GLA SUPERCOPA', texto2: 'EL TORNEO DE LOS CAMPEONES', sponsorsRotacion: 'si', intervaloSec: '6', ...SC_LAYER },
  },

  // MOSCA v2 (MOSCA_SUPERCOPA.png): emblema GLA + LocalStrike + VIVO; en el
  // recuadro blanco, la HORA REAL DE ARGENTINA (HH:MM, America/Argentina/
  // Buenos_Aires, nunca la zona de la PC). "live": el tick de Program actualiza
  // solo el texto de la hora (sin timers propios).
  scMosca: {
    id: 'scMosca',
    label: 'MOSCA SUPERCOPA',
    category: 'Branding',
    layer: 'bug',
    live: true,
    fields: [],
    defaults: { ...SC_LAYER },
  },

  // GRUPOS (L DERECHA): GRUPO A (A1 A2 A3) y GRUPO B (B1 B2 B3), asignados a
  // mano. Es la FUENTE DE VERDAD del seeding de FIXTURE L
  // (shared/sc-seeding.js). REINICIAR TODO no lo toca.
  scGrupos: {
    id: 'scGrupos',
    label: 'GRUPOS',
    category: 'Grupos',
    layer: 'lowerThird',
    fields: [{ key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT }],
    defaults: { titulo: 'GRUPOS', slots: { A1: '', A2: '', A3: '', B1: '', B2: '', B3: '' }, ...SC_LAYER },
  },

  // FIXTURE L (L DERECHA): SÁBADO 28 = P1..P9 derivados de GRUPOS (horario,
  // fase, local / visitante y resultado manuales van APARTE en "sabado");
  // DOMINGO 29 = SEMIFINAL 1, SEMIFINAL 2 y GRAN FINAL (A CONFIRMAR hasta
  // definirlos a mano en "domingo"). "live": sigue a GRUPOS.
  // PANTALLA SORTEO (2026-11-25): sorteo televisivo de los equipos de la
  // SUPERCOPA en GRUPO A / GRUPO B. "equipos": participantes (de la web
  // SUPERCOPA o, sin web, del catálogo; los carga el panel), "slots": A1..B3
  // (mismo formato que GRUPOS, shared/sc-seeding.js). Se ve SIEMPRE en la salida
  // propia /pantalla (program/pantalla.html, en vivo) y, con TAKE, en Program
  // (pantalla completa). Independiente de GRUPOS (el seeding real no cambia).
  scSorteo: {
    id: 'scSorteo',
    label: 'PANTALLA SORTEO',
    category: 'Grupos',
    layer: 'fullscreen',
    fields: [
      { key: 'titulo', label: 'Título', type: FIELD_TYPES.TEXT },
      { key: 'subtitulo', label: 'Subtítulo', type: FIELD_TYPES.TEXT },
    ],
    defaults: { titulo: 'SUPERCOPA', subtitulo: 'SORTEO DE EQUIPOS', equipos: [], slots: { A1: '', A2: '', A3: '', B1: '', B2: '', B3: '' }, ...SC_LAYER },
  },

  scFixtureL: {
    id: 'scFixtureL',
    label: 'FIXTURE L',
    category: 'Grupos',
    layer: 'lowerThird',
    live: true,
    fields: [],
    defaults: { dia: 'sabado', titulo: '', sabado: {}, domingo: {}, ...SC_LAYER },
  },

  // Vista efectiva del torneo (la escribe SOLO server/supercopa.js): fixture,
  // visual de jugadores y sponsors. Nunca va al aire ni tiene pestaña.
  scDatos: {
    id: 'scDatos',
    label: 'DATOS SUPERCOPA',
    category: 'General',
    layer: 'data',
    fields: [],
    defaults: { fixture: [], fixtureSource: 'manual', visualJugadores: 'foto', sponsors: [], tournament: { name: 'GLA SUPERCOPA' }, webUpdatedAt: '', updatedAt: '' },
  },

};

export const MODULE_IDS = Object.keys(MODULES);

// "AJUSTE DE COMPOSICIÓN" (2026-08-14, pedido explicito del usuario):
// posicion X/Y + escala de TODO un modulo, aplicados como una capa
// adicional sobre el diseño base ("posicion final = base + offset",
// "escala final = base × ajuste") -- ver program/js/main.js
// (applyModuleState) para donde se aplica el transform en Program, y
// master-control/js/composition-control.js para el control de UI.
// Mezclados aca, en el UNICO lugar por el que pasa CUALQUIER modulo al
// inicializar su estado (server/state.js y master-control/js/main.js
// llaman los dos a esta funcion), en vez de agregar estas 3 claves a mano
// en los ~25 "defaults" de arriba -- asi un modulo nuevo que se registre
// en el futuro hereda esta capa automaticamente, sin tocar este archivo
// de nuevo ni el panel de Master Control.
const COMPOSITION_DEFAULTS = {
  compositionOffsetX: 0,
  compositionOffsetY: 0,
  compositionScale: 1,
};

// "layoutOverride" (2026-09-01, LAYOUT BASE VERSIONADO -- pedido explicito
// del usuario: "GUARDAR POSICIÓN" tiene que producir un cambio que viaje
// con Git, no solo con el estado runtime gitignorado). Opcional a
// proposito: server/state.js es el UNICO caller que lo pasa (carga
// shared/theme-layouts/<themeId>.json al arrancar, ver ese archivo) --
// cualquier otro caller (ej. el placeholder que arma master-control/js/
// main.js antes de recibir el snapshot real del servidor) sigue sin
// pasarlo y obtiene exactamente el comportamiento de siempre (0/0/1
// estructural). Es un subconjunto disperso del mismo arbol de "defaults"
// (solo las claves de offset/escala/textAdjust que alguna vez se
// confirmaron con GUARDAR POSICIÓN) -- "deepMergeAdjustFields" lo aplica
// ENCIMA de los defaults estructurales, nunca al reves, para que un modulo
// nuevo o un campo nuevo sin base guardada todavia siga cayendo en su
// default de diseño de siempre.
export function cloneDefaults(moduleId, themeId, layoutOverride) {
  const cloned = {
    ...COMPOSITION_DEFAULTS,
    ...JSON.parse(JSON.stringify(MODULES[moduleId].defaults)),
  };
  // Argentina Streamers usa un asset de penales con 5 espacios por equipo
  // (GLA sigue en 3, sin cambios) -- pedido explicito del usuario, ver
  // CHANGELOG.md. Unico chokepoint: acá se genera el array por defecto de
  // "kicksA"/"kicksB"; el panel (buildPenaltyEditor) y el renderer de
  // Program (buildStructure) ya son 100% length-driven, no necesitan tocarse.
  if (moduleId === 'marcadorPenales' && themeId === ARGENTINA_STREAMERS_THEME_ID) {
    cloned.kicksA = penaltyKicksDefault(5);
    cloned.kicksB = penaltyKicksDefault(5);
  }
  if (layoutOverride) deepMergeAdjustFields(cloned, layoutOverride);
  return cloned;
}
