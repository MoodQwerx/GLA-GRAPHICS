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
import { ARGENTINA_STREAMERS_THEME_ID } from './themes.js';
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
      { key: 'scoreA', label: 'Goles local', type: FIELD_TYPES.TEXT, adjustable: true },
      { key: 'scoreB', label: 'Goles visitante', type: FIELD_TYPES.TEXT, adjustable: true },
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
      { key: 'clock', label: 'Reloj (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: {
      addedMinutes: '5', clock: emptyClock(),
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
      textAdjust: textAdjustDefaults('nameA', 'nameB', 'scoreA', 'scoreB'),
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
      textAdjust: textAdjustDefaults('titulo', 'nameA', 'nameB', 'scoreA', 'scoreB'),
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
      name: '', role: '',
      airMode: 'single',
      double1: { name: '', role: '' },
      double2: { name: '', role: '' },
      textPresets: [],
      // Claves con ruta "grupo.campo" para los textos de los pares del
      // modo doble -- distinguen el ajuste de "double1.name" del de
      // "double2.name" aunque compartan las mismas clases CSS (ver
      // program/js/renderers/shortDouble.js), porque son campos de datos
      // independientes, no un unico elemento reutilizado.
      textAdjust: textAdjustDefaults('name', 'role', 'double1.name', 'double1.role', 'double2.name', 'double2.role'),
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
      { key: 'status', label: 'Estado del encuentro', type: FIELD_TYPES.SELECT, options: MATCH_STATUS_OPTIONS },
      {
        key: 'statusTexto',
        label: 'Texto libre del renglon central (opcional, reemplaza al Estado de arriba si se completa)',
        type: FIELD_TYPES.TEXT,
        adjustable: true,
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
      {
        key: 'contentType',
        label: 'Contenido central',
        type: FIELD_TYPES.SELECT,
        options: [
          { id: 'match_info', label: 'Resultado / Estado' },
          { id: 'sponsor', label: 'Sponsor' },
        ],
      },
      {
        key: 'sponsor',
        label: 'Sponsor Zocalo Medio',
        type: FIELD_TYPES.SELECT,
        options: SPONSOR_OPTIONS.vs_compact,
      },
      // "nameA"/"nameB"/"goalA"/"goalB"/"scorersLocal"/"scorersVisitante"
      // (2026-08-15, auditoria completa): los 6 quedaban fuera de la
      // primera pasada de este modulo -- nombre y gol de cada equipo se
      // derivan en vivo de "scoreboard" (sin campo propio) y los bloques de
      // goleadores, aunque se tipean en las 2 TEXTAREA de arriba, se
      // renderizan como lista/marquesina (no un unico punto de texto) por
      // lo que su ajuste es de BLOQUE (posicion + tamaño de fuente de toda
      // la lista), no por linea individual -- ver applyScorersAdjust en
      // program/js/renderers/vs.js.
      { key: 'nameA', label: 'Nombre equipo local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'nameB', label: 'Nombre equipo visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'goalA', label: 'Gol local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'goalB', label: 'Gol visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'scorersLocal', label: 'Bloque goleadores local (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
      { key: 'scorersVisitante', label: 'Bloque goleadores visitante (posición/tamaño)', type: FIELD_TYPES.ADJUST_ONLY },
    ],
    defaults: {
      renglon: 'normal', status: '', statusTexto: '', goleadoresLocal: '', goleadoresVisitante: '',
      contentType: 'match_info', sponsor: '',
      textAdjust: textAdjustDefaults('statusTexto', 'nameA', 'nameB', 'goalA', 'goalB', 'scorersLocal', 'scorersVisitante'),
      // "localCrestOffset*/awayCrestOffset*/sponsorOffset*" (2026-08-31,
      // auditoria completa): ninguno de los 3 tenia ajuste propio.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      sponsorOffsetX: 0, sponsorOffsetY: 0, sponsorScale: 1,
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
      // "localCrestOffset*/awayCrestOffset*/logoOffset*/sponsor1Offset*/
      // sponsor2Offset*" (2026-08-31, auditoria completa): ninguno de los
      // 5 elementos graficos tenia ajuste propio.
      localCrestOffsetX: 0, localCrestOffsetY: 0, localCrestScale: 1,
      awayCrestOffsetX: 0, awayCrestOffsetY: 0, awayCrestScale: 1,
      logoOffsetX: 0, logoOffsetY: 0, logoScale: 1,
      sponsor1OffsetX: 0, sponsor1OffsetY: 0, sponsor1Scale: 1,
      sponsor2OffsetX: 0, sponsor2OffsetY: 0, sponsor2Scale: 1,
    },
  },

  // "zocaloCompuestoEquipos"/"zocaloCompuestoLogo" (2026-09-02, auditoria de
  // wiring): habia una SEGUNDA entrada duplicada de cada uno mas abajo en
  // este mismo objeto, incompleta (sin sponsorOffset*/compositionOffset*/
  // textPresets) -- en un literal de objeto JS la clave repetida MAS TARDE
  // gana, asi que esa version incompleta era la que realmente terminaba en
  // MODULES, no esta. Se elimino el duplicado; esta queda como unica fuente.
  zocaloCompuestoEquipos: {
    id: 'zocaloCompuestoEquipos',
    label: 'Zócalo Compuesto con Equipos',
    category: 'Zocalos',
    layer: 'bottom-left',
    live: true,
    sequencedReveal: true,
    // "fields: []" (2026-09-02, auditoria de wiring): el CONTENIDO
    // (texto1/texto2/sponsor) lo muestra el panel dedicado
    // (master-control/js/zocalo-compuesto-equipos-panel.js) -- declararlos
    // aca tambien los duplicaba (2 cajas "TEXTO MAIN" en pantalla, una
    // generica sin ACTUALIZAR y otra del panel). Mismo criterio que
    // "formacionEquipos" mas arriba.
    fields: [],
    defaults: {
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
      textAdjust: textAdjustDefaults('texto1', 'texto2'),
      crestByTeam: { local: {}, away: {} },
    },
  },

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

  placaLInfo: {
    id: 'placaLInfo',
    label: 'Placa L Info',
    category: 'Zocalos',
    layer: 'fullscreen',
    sequencedReveal: true,
    fields: [],
    defaults: {
      completePresets: [],
      zocalo1: { text: 'CÁMARA 1', active: true, offsetX: -1256, offsetY: 408, scale: 1, textAdjust: { dx: 0, dy: 0, dSize: 0 }, presets: [] },
      zocalo2: { text: 'CÁMARA 2', active: true, offsetX: -296, offsetY: 408, scale: 1, textAdjust: { dx: 0, dy: 0, dSize: 0 }, presets: [] },
      zocalo3: { text: 'CÁMARA 3', active: true, offsetX: -1256, offsetY: 948, scale: 1, textAdjust: { dx: 0, dy: 0, dSize: 0 }, presets: [] },
      zocalo4: { text: 'CÁMARA 4', active: true, offsetX: -296, offsetY: 948, scale: 1, textAdjust: { dx: 0, dy: 0, dSize: 0 }, presets: [] },
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
    // (cronograma-hoy.png, VS_DEFAULT entregado) con UN solo partido: los
    // escudos se heredan siempre del Marcador (scoreboard.teamA/teamB, en
    // vivo), nunca se eligen aca -- por eso no hay "teamA"/"teamB" en
    // estos defaults. "crestByTeam" seedeado por teamId real (mismo
    // patron que zocaloCompuestoEquipos), asi la posicion de cada escudo
    // sobrevive a que cambie el equipo.
    defaults: {
      titulo: 'PRÓXIMO PARTIDO',
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
      encuentros: [
        { teamA: 'argentina-streamers', teamB: 'oxen', scoreA: '2', scoreB: '1', estado: 'FINAL' },
        { teamA: 'peru-creadores', teamB: 'argentina-streamers-fem', scoreA: '0', scoreB: '0', estado: 'EN JUEGO' },
      ],
      textAdjust: textAdjustDefaults('titulo', 'teamA1', 'teamB1', 'scoreA1', 'scoreB1', 'estado1', 'teamA2', 'teamB2', 'scoreA2', 'scoreB2', 'estado2'),
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
      partidos: [
        { teamA: '', golLocal: '', golVisitante: '', teamB: '' },
        { teamA: '', golLocal: '', golVisitante: '', teamB: '' },
        { teamA: '', golLocal: '', golVisitante: '', teamB: '' },
        { teamA: '', golLocal: '', golVisitante: '', teamB: '' },
        { teamA: '', golLocal: '', golVisitante: '', teamB: '' },
      ],
      // Ajuste POR COLUMNA (2026-09-02, pedido explicito del usuario:
      // "criterio por columna/bloque, no fila individual") -- un unico
      // offset se aplica a los 5 escudos locales por igual, otro a los 5
      // visitantes, mismo patron que "goleadores/asistidores" mas abajo.
      crestLocalOffsetX: 0, crestLocalOffsetY: 0, crestLocalScale: 1,
      crestVisitanteOffsetX: 0, crestVisitanteOffsetY: 0, crestVisitanteScale: 1,
      textAdjust: textAdjustDefaults('titulo', 'golLocal', 'golVisitante'),
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
    fields: [],
    defaults: {
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
  // "jugadores" (el roster manual, mismo shape base que
  // goleadores/asistidores/participaciones: teamId+nombre+stats) es la
  // lista de CANDIDATOS -- "selectedPlayerId" elige cual de esa lista se
  // esta mostrando ahora mismo en la placa. Doble fuente de datos
  // (manual/futura sync web) preparada igual que el resto de Tablas:
  // "fuente"/"snapshots" ya soportan reemplazar la lista completa sin
  // tocar la logica del panel ni del renderer -- ver
  // ficha-jugador-panel.js. "mvp" es el unico stat nuevo (no existia en
  // ningun otro modulo); "g+a" se calcula en render, nunca se guarda
  // aparte (mismo criterio que el resto de Tablas: la fuente de verdad
  // son los stats base, no un numero derivado tipeado a mano).
  fichaJugador: {
    id: 'fichaJugador',
    label: 'Ficha Jugador',
    category: 'Tablas',
    layer: 'fullscreen',
    fields: [],
    defaults: {
      fuente: 'manual',
      jugadores: [],
      snapshots: {},
      ultimaActualizacionWeb: '',
      selectedPlayerId: '',
      textAdjust: textAdjustDefaults('nombre', 'goles', 'asistencias', 'gMasA', 'presencias', 'mvps'),
      crestOffsetX: 0, crestOffsetY: 0, crestScale: 1,
    },
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
