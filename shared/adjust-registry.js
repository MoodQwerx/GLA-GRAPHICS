// Registro declarativo de elementos editables por modulo (2026-08-31,
// pedido explicito del usuario: "que agregar un nuevo elemento editable
// sea conceptualmente tan simple como definir id/label/xKey/yKey/
// scaleKey/target"). Fuente UNICA de verdad, importada tanto por
// Master Control (arma el acordeon "AJUSTE DE COMPOSICION" -> ver
// master-control/js/main.js "renderModuleAdjustAccordion") como por
// Program (aplica los offsets -> ver program/js/main.js
// "applyElementAdjustRegistry") -- evita mantener la misma lista de
// ids/keys duplicada en dos lados.
//
// Cada entrada de "elements" es uno de dos tipos:
//   - kind:'composition' -- para elementos NO textuales (escudos, logos,
//     sponsors, guiones, iconos) o cualquier bloque que deba moverse/
//     escalarse como unidad. Requiere:
//       1. el renderer del modulo marca el nodo con data-adjust="<id>"
//          (sin logica nueva, solo el atributo en el template);
//       2. shared/modules.js define <xKey>/<yKey>/<scaleKey> en los
//          defaults del modulo (default 0/0/1, no-op);
//       3. Program aplica el offset SOLO -- ver "applyElementAdjustRegistry"
//          en program/js/main.js, corre junto a "applyComposition" para
//          cualquier modulo con entradas de este tipo, sin codigo nuevo
//          por elemento.
//   - kind:'text' -- para texto que YA pasa por "textAdjust" (el mismo
//     mecanismo de siempre, dx/dy/dSize, ver program/js/text-fit.js).
//     No requiere nada nuevo en Program: el renderer ya llama
//     readTextAdjust/applyPlainTextAdjust para ese campo. Solo declara
//     que existe, para que el acordeon de Master Control lo muestre.
//
// "COMPOSICION COMPLETA" (compositionOffsetX/Y/Scale) NO se declara aca:
// ya es universal para los 30 modulos via COMPOSITION_DEFAULTS
// (shared/modules.js) y se agrega siempre, automaticamente, al
// principio del acordeon -- ver renderModuleAdjustAccordion.
//
// "crestTeam" (2026-09-01, pedido explicito del usuario: "la posicion de
// un escudo tiene que guardarse POR equipo, no solo por slot" -- los 4
// equipos de Argentina Streamers tienen proporciones/pesos visuales muy
// distintos). Marca, en una entrada "kind:'composition'" que es
// especificamente un ESCUDO de equipo (nunca un logo/sponsor/guion), de
// que lado sale el teamId que la identifica en runtime:
//   'A'       -> siempre el equipo LOCAL del Marcador (scoreboard.teamA).
//   'B'       -> siempre el equipo VISITANTE del Marcador (scoreboard.teamB).
//   'dynamic' -> un unico slot que puede ser A o B segun otro campo del
//                propio modulo (ej. tarjeta/cambios: data.equipo).
// Master Control (renderModuleAdjustAccordion) y Program
// (applyElementAdjustRegistry) son los DOS unicos lugares que leen este
// campo -- ninguno de los renderers individuales necesita saber nada de
// esto. Sin "crestTeam" (sponsors, logos, guiones, y los "crest" de
// columna en tablas -- grupos/sideTable/posiciones/goleadores/etc., que
// a proposito NO lo declaran) el elemento se comporta EXACTAMENTE igual
// que siempre: una unica posicion/escala por slot, sin distincion de
// equipo. Solo tiene efecto real cuando el theme activo es
// argentinaStreamers -- GLA nunca puebla "crestByTeam" en su propio
// arbol de datos, asi que esta logica cae siempre al camino de fallback
// sin cambiar nada de su comportamiento.
//
// "themeOnly" (2026-09-01, pedido explicito del usuario: "trabajar
// unicamente sobre Argentina Streamers, no tocar GLA, no tocar otros
// modulos"). Marca una entrada como visible SOLO en el acordeon generico
// de Master Control (renderModuleAdjustAccordion) cuando el theme activo
// coincide -- Program (applyElementAdjustRegistry) la aplica igual para
// cualquier theme, sin chequear "themeOnly" (es un concern de UI de
// Master Control, no de renderizado): para GLA los campos que respalda
// simplemente nunca se tocan/guardan, asi que quedan en su default
// (0/0/1, no-op) para siempre. Usado por los 12 elementos nuevos de
// "marcadorPenales" (10 circulos + 2 nombres) -- ninguna otra entrada del
// registro lo necesita hoy.
export const ADJUST_REGISTRY = {
  // MARCADOR (2026-08-31): migrado desde la funcion hecha a medida
  // "renderScoreboardAdjustAccordion" -- mismo orden, mismas labels,
  // mismo comportamiento, ahora descripto de forma declarativa.
  scoreboard: {
    elements: [
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'nameA', label: 'NOMBRE / ABREVIATURA LOCAL', kind: 'text', textKey: 'nameA' },
      { id: 'scoreA', label: 'GOL LOCAL', kind: 'text', textKey: 'scoreA' },
      { id: 'separator', label: 'GUIÓN', kind: 'composition', xKey: 'separatorOffsetX', yKey: 'separatorOffsetY', scaleKey: 'separatorScale' },
      { id: 'scoreB', label: 'GOL VISITANTE', kind: 'text', textKey: 'scoreB' },
      { id: 'nameB', label: 'NOMBRE / ABREVIATURA VISITANTE', kind: 'text', textKey: 'nameB' },
      { id: 'awayCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'awayCrestOffsetX', yKey: 'awayCrestOffsetY', scaleKey: 'awayCrestScale', crestTeam: 'B' },
      { id: 'clock', label: 'CONTADOR / RELOJ', kind: 'text', textKey: 'clock' },
      { id: 'period', label: 'PERÍODO', kind: 'text', textKey: 'period' },
      { id: 'sponsor', label: 'SPONSOR', kind: 'composition', xKey: 'sponsorOffsetX', yKey: 'sponsorOffsetY', scaleKey: 'sponsorScale' },
    ],
  },
  // --- Tanda 1 ---
  tarjeta: {
    elements: [
      { id: 'crest', label: 'ESCUDO', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale', crestTeam: 'dynamic' },
      { id: 'jugador', label: 'JUGADOR', kind: 'text', textKey: 'jugador' },
    ],
  },
  cambios: {
    // "titulo" ELIMINADO (2026-09-01, pedido explicito del usuario) -- ver
    // shared/modules.js y program/js/renderers/cambios.js.
    elements: [
      { id: 'crest', label: 'ESCUDO', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale', crestTeam: 'dynamic' },
      { id: 'entra', label: 'JUGADOR ENTRA', kind: 'text', textKey: 'entra' },
      { id: 'sale', label: 'JUGADOR SALE', kind: 'text', textKey: 'sale' },
    ],
  },
  varCheck: {
    elements: [
      // "varGroup" (2026-08-31): bug pre-existente encontrado al probar
      // esta tanda -- ".ov-var-group1" leia directamente
      // compositionOffsetX/Y/Scale (las mismas keys de "COMPOSICIÓN
      // COMPLETA"), y al ser hijo de ".content" el offset quedaba
      // compuesto DOS VECES solo para este grupo. Se separo en
      // varGroupOffsetX/Y/Scale (ver shared/modules.js) -- ahora es un
      // control legitimo e independiente (mueve SOLO el clip VAR +
      // sponsor dentro del modulo), no redundante con "COMPOSICIÓN
      // COMPLETA".
      { id: 'varGroup', label: 'GRUPO VAR (CLIP + SPONSOR)', kind: 'composition', xKey: 'varGroupOffsetX', yKey: 'varGroupOffsetY', scaleKey: 'varGroupScale' },
      { id: 'sponsor', label: 'SPONSOR', kind: 'composition', xKey: 'sponsorOffsetX', yKey: 'sponsorOffsetY', scaleKey: 'sponsorScale' },
      // "motivoGroup" ya existe de antes (pre-fecha este registro, ver
      // varCheck.js): el renderer YA lee motivoOffsetX/Y/Scale y mueve
      // ".ov-var-motivo-group" el solo en cada pasada -- no necesita
      // data-adjust ni pasar por applyElementAdjustRegistry, se declara
      // aca solo para que el acordeon de Master Control muestre su control.
      { id: 'motivoGroup', label: 'MOTIVO COMPLETO', kind: 'composition', xKey: 'motivoOffsetX', yKey: 'motivoOffsetY', scaleKey: 'motivoScale' },
      { id: 'motivo', label: 'TEXTO MOTIVO', kind: 'text', textKey: 'motivo' },
    ],
  },
  replay: {
    elements: [
      { id: 'sponsor', label: 'SPONSOR', kind: 'composition', xKey: 'sponsorOffsetX', yKey: 'sponsorOffsetY', scaleKey: 'sponsorScale' },
    ],
  },
  bug: {
    elements: [
      { id: 'clock', label: 'RELOJ', kind: 'text', textKey: 'clock' },
    ],
  },
  gol: {
    // Sin panel propio en Master Control (HIDDEN_FROM_NAV_IDS, ver
    // master-control/js/main.js): modulo oneShot disparado automaticamente
    // por scoreGoal() al anotar un gol en el Marcador, sin datos propios
    // que editar (fields: [] en shared/modules.js). Hereda
    // compositionOffsetX/Y/Scale via COMPOSITION_DEFAULTS igual que
    // cualquier otro modulo, pero no hay panel donde mostrar "COMPOSICIÓN
    // COMPLETA" -- excepcion documentada en el informe final, no una falta
    // de cobertura.
    elements: [],
  },

  // --- Resto de MARCADOR (2026-08-31) ---
  marcadorTiempoAdicional: {
    elements: [
      { id: 'addedMinutes', label: 'MINUTOS AGREGADOS', kind: 'text', textKey: 'addedMinutes' },
      { id: 'clock', label: 'RELOJ', kind: 'text', textKey: 'clock' },
    ],
  },
  marcadorEntretiempo: {
    elements: [
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'nameA', label: 'ABREVIATURA LOCAL', kind: 'text', textKey: 'nameA' },
      { id: 'scoreA', label: 'GOL LOCAL', kind: 'text', textKey: 'scoreA' },
      { id: 'scoreB', label: 'GOL VISITANTE', kind: 'text', textKey: 'scoreB' },
      { id: 'nameB', label: 'ABREVIATURA VISITANTE', kind: 'text', textKey: 'nameB' },
      { id: 'awayCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'awayCrestOffsetX', yKey: 'awayCrestOffsetY', scaleKey: 'awayCrestScale', crestTeam: 'B' },
    ],
  },
  // Orden pedido explicitamente por el usuario (2026-08-31, corrección
  // Marcador de Penales): COMPOSICIÓN COMPLETA (universal, siempre
  // primera) -> escudo local -> fila de penales local -> resultado local
  // -> guión -> resultado visitante -> fila de penales visitante ->
  // escudo visitante -> título -> sponsor. "nameA"/"nameB" (abreviatura)
  // se mantienen al final: siguen existiendo para GLA (fila propia, sin
  // relacion con el "ARG PER" que se retiró del centro de Argentina
  // Streamers -- ver overlay.css), no pedidos en la lista nueva pero
  // tampoco a remover, mismo criterio que "VIVO" en bug.js (control
  // universal, sin efecto visual donde el elemento esta oculto).
  marcadorPenales: {
    elements: [
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'kicksLocal', label: 'FILA DE PENALES LOCAL', kind: 'composition', xKey: 'kicksLocalOffsetX', yKey: 'kicksLocalOffsetY', scaleKey: 'kicksLocalScale' },
      { id: 'scoreA', label: 'RESULTADO LOCAL', kind: 'text', textKey: 'scoreA' },
      { id: 'separator', label: 'GUIÓN DEL RESULTADO', kind: 'composition', xKey: 'separatorOffsetX', yKey: 'separatorOffsetY', scaleKey: 'separatorScale' },
      { id: 'scoreB', label: 'RESULTADO VISITANTE', kind: 'text', textKey: 'scoreB' },
      { id: 'kicksVisitante', label: 'FILA DE PENALES VISITANTE', kind: 'composition', xKey: 'kicksVisitanteOffsetX', yKey: 'kicksVisitanteOffsetY', scaleKey: 'kicksVisitanteScale' },
      { id: 'awayCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'awayCrestOffsetX', yKey: 'awayCrestOffsetY', scaleKey: 'awayCrestScale', crestTeam: 'B' },
      { id: 'titulo', label: 'TÍTULO "PENALES"', kind: 'text', textKey: 'titulo' },
      { id: 'sponsor', label: 'SPONSOR', kind: 'composition', xKey: 'sponsorOffsetX', yKey: 'sponsorOffsetY', scaleKey: 'sponsorScale' },
      { id: 'nameA', label: 'ABREVIATURA LOCAL (solo GLA)', kind: 'text', textKey: 'nameA' },
      { id: 'nameB', label: 'ABREVIATURA VISITANTE (solo GLA)', kind: 'text', textKey: 'nameB' },
      // "kickLocal{1-5}"/"kickVisitante{1-5}" (2026-09-01, pedido explicito
      // del usuario: control total por circulo desde Master Control, sin
      // mas ajustes hardcodeados en CSS). "themeOnly" (ver docstring mas
      // abajo) los mantiene invisibles para GLA en el acordeon generico;
      // el panel dedicado de Argentina Streamers Penales
      // (renderPenalesArgentinaAccordion en master-control/js/main.js) los
      // agrupa en su propia seccion "AJUSTE DE INTENTOS" en vez de listarlos
      // aca sueltos.
      { id: 'kickLocal1', label: 'LOCAL 1', kind: 'composition', xKey: 'kickLocal1OffsetX', yKey: 'kickLocal1OffsetY', scaleKey: 'kickLocal1Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickLocal2', label: 'LOCAL 2', kind: 'composition', xKey: 'kickLocal2OffsetX', yKey: 'kickLocal2OffsetY', scaleKey: 'kickLocal2Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickLocal3', label: 'LOCAL 3', kind: 'composition', xKey: 'kickLocal3OffsetX', yKey: 'kickLocal3OffsetY', scaleKey: 'kickLocal3Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickLocal4', label: 'LOCAL 4', kind: 'composition', xKey: 'kickLocal4OffsetX', yKey: 'kickLocal4OffsetY', scaleKey: 'kickLocal4Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickLocal5', label: 'LOCAL 5', kind: 'composition', xKey: 'kickLocal5OffsetX', yKey: 'kickLocal5OffsetY', scaleKey: 'kickLocal5Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickVisitante1', label: 'VISITANTE 1', kind: 'composition', xKey: 'kickVisitante1OffsetX', yKey: 'kickVisitante1OffsetY', scaleKey: 'kickVisitante1Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickVisitante2', label: 'VISITANTE 2', kind: 'composition', xKey: 'kickVisitante2OffsetX', yKey: 'kickVisitante2OffsetY', scaleKey: 'kickVisitante2Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickVisitante3', label: 'VISITANTE 3', kind: 'composition', xKey: 'kickVisitante3OffsetX', yKey: 'kickVisitante3OffsetY', scaleKey: 'kickVisitante3Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickVisitante4', label: 'VISITANTE 4', kind: 'composition', xKey: 'kickVisitante4OffsetX', yKey: 'kickVisitante4OffsetY', scaleKey: 'kickVisitante4Scale', themeOnly: 'argentinaStreamers' },
      { id: 'kickVisitante5', label: 'VISITANTE 5', kind: 'composition', xKey: 'kickVisitante5OffsetX', yKey: 'kickVisitante5OffsetY', scaleKey: 'kickVisitante5Scale', themeOnly: 'argentinaStreamers' },
      // "nombreLocal"/"nombreVisitante" (2026-09-01): nombre de broadcast
      // en la franja azul arriba de cada fila de circulos -- ver
      // shared/broadcast-names.js. Solo Argentina Streamers.
      { id: 'nombreLocal', label: 'NOMBRE LOCAL', kind: 'text', textKey: 'nombreLocal', themeOnly: 'argentinaStreamers' },
      { id: 'nombreVisitante', label: 'NOMBRE VISITANTE', kind: 'text', textKey: 'nombreVisitante', themeOnly: 'argentinaStreamers' },
    ],
  },
  marcadorZocalo: {
    elements: [
      { id: 'titulo', label: 'TÍTULO', kind: 'text', textKey: 'titulo' },
      { id: 'clock', label: 'RELOJ', kind: 'text', textKey: 'clock' },
    ],
  },

  // --- PLACAS ---
  formacionEquipos: {
    // "playerName"/"playerNumber"/"subsTitle"/"subsList" NO se declaran
    // aca: ya tienen su propio control (con GUARDAR POSICIÓN) dentro de la
    // seccion "AJUSTE DE TEXTOS" del panel dedicado (2026-08-31, ver
    // master-control/js/formation-list-panel.js) -- agregarlos aca
    // duplicaria el control. Solo "crest" es genuinamente nuevo (escudo,
    // nunca tuvo ajuste propio), se resuelve via el acordeon generico.
    elements: [
      { id: 'crest', label: 'ESCUDO EQUIPO ACTIVO', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
    ],
  },
  vsPrepartido: {
    elements: [
      { id: 'titulo', label: 'TÍTULO', kind: 'text', textKey: 'titulo' },
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'nameA', label: 'NOMBRE EQUIPO LOCAL', kind: 'text', textKey: 'nameA' },
      { id: 'nameB', label: 'NOMBRE EQUIPO VISITANTE', kind: 'text', textKey: 'nameB' },
      { id: 'awayCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'awayCrestOffsetX', yKey: 'awayCrestOffsetY', scaleKey: 'awayCrestScale', crestTeam: 'B' },
    ],
  },
  vsResultado: {
    elements: [
      { id: 'titulo', label: 'TÍTULO', kind: 'text', textKey: 'titulo' },
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'nameA', label: 'NOMBRE EQUIPO LOCAL', kind: 'text', textKey: 'nameA' },
      { id: 'scoreA', label: 'GOL LOCAL', kind: 'text', textKey: 'scoreA' },
      { id: 'scoreB', label: 'GOL VISITANTE', kind: 'text', textKey: 'scoreB' },
      { id: 'nameB', label: 'NOMBRE EQUIPO VISITANTE', kind: 'text', textKey: 'nameB' },
      { id: 'awayCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'awayCrestOffsetX', yKey: 'awayCrestOffsetY', scaleKey: 'awayCrestScale', crestTeam: 'B' },
    ],
  },
  // "estrellas": solo "crest" (composition) via el acordeon generico --
  // "titulo"/"localNombre"/"localG"/etc. YA tienen su propio control (con
  // GUARDAR POSICIÓN) en la seccion "AJUSTE DE TEXTOS" del panel dedicado
  // (2026-08-31, ver master-control/js/estrellas-panel.js) -- declararlos
  // tambien aca duplicaria el control.
  estrellas: {
    elements: [
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'visitanteCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'visitanteCrestOffsetX', yKey: 'visitanteCrestOffsetY', scaleKey: 'visitanteCrestScale', crestTeam: 'B' },
    ],
  },

  // --- EVENTOS / ZOCALOS ---
  longDouble: {
    elements: [
      { id: 'line1', label: 'TÍTULO PRINCIPAL', kind: 'text', textKey: 'line1' },
      { id: 'line2', label: 'SUBTÍTULO / BAJADA', kind: 'text', textKey: 'line2' },
    ],
  },
  shortSimple: {
    elements: [
      { id: 'text', label: 'TEXTO', kind: 'text', textKey: 'text' },
    ],
  },
  // "shortDouble": sin entradas -- "name"/"role"/"double1.name"/etc. YA
  // tienen su propio control (con GUARDAR POSICIÓN) en el panel dedicado
  // (2026-08-31, ver master-control/js/short-double-panel.js), y el
  // modulo no tiene ningun escudo/logo/sponsor sin ajuste. Solo
  // "COMPOSICIÓN COMPLETA" (universal) aplica aca.
  shortDouble: {
    elements: [],
  },
  vs: {
    elements: [
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'nameA', label: 'NOMBRE EQUIPO LOCAL', kind: 'text', textKey: 'nameA' },
      { id: 'goalA', label: 'GOL LOCAL', kind: 'text', textKey: 'goalA' },
      { id: 'scorersLocal', label: 'BLOQUE GOLEADORES LOCAL', kind: 'text', textKey: 'scorersLocal' },
      { id: 'statusTexto', label: 'TEXTO LIBRE RENGLÓN CENTRAL', kind: 'text', textKey: 'statusTexto' },
      { id: 'scorersVisitante', label: 'BLOQUE GOLEADORES VISITANTE', kind: 'text', textKey: 'scorersVisitante' },
      { id: 'goalB', label: 'GOL VISITANTE', kind: 'text', textKey: 'goalB' },
      { id: 'nameB', label: 'NOMBRE EQUIPO VISITANTE', kind: 'text', textKey: 'nameB' },
      { id: 'awayCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'awayCrestOffsetX', yKey: 'awayCrestOffsetY', scaleKey: 'awayCrestScale', crestTeam: 'B' },
      { id: 'sponsor', label: 'SPONSOR', kind: 'composition', xKey: 'sponsorOffsetX', yKey: 'sponsorOffsetY', scaleKey: 'sponsorScale' },
    ],
  },
  zocaloCompuesto: {
    elements: [
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'awayCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'awayCrestOffsetX', yKey: 'awayCrestOffsetY', scaleKey: 'awayCrestScale', crestTeam: 'B' },
      { id: 'logo', label: 'LOGO GLA', kind: 'composition', xKey: 'logoOffsetX', yKey: 'logoOffsetY', scaleKey: 'logoScale' },
      { id: 'texto1', label: 'TEXTO 1', kind: 'text', textKey: 'texto1' },
      { id: 'texto2', label: 'TEXTO 2', kind: 'text', textKey: 'texto2' },
      { id: 'sponsor1', label: 'SPONSOR 1', kind: 'composition', xKey: 'sponsor1OffsetX', yKey: 'sponsor1OffsetY', scaleKey: 'sponsor1Scale' },
      { id: 'sponsor2', label: 'SPONSOR 2', kind: 'composition', xKey: 'sponsor2OffsetX', yKey: 'sponsor2OffsetY', scaleKey: 'sponsor2Scale' },
    ],
  },
  // Unica entrada de cada uno (2026-09-02, auditoria de wiring): habia una
  // segunda entrada duplicada mas abajo en este objeto, sin "sponsor" -- en
  // un literal de objeto JS la clave repetida MAS TARDE gana, asi que esa
  // version incompleta (sin editor de posicion de sponsor en el acordeon
  // generico) era la que realmente terminaba en ADJUST_REGISTRY, no esta.
  // Se elimino el duplicado.
  zocaloCompuestoEquipos: {
    elements: [
      { id: 'localCrest', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'localCrestOffsetX', yKey: 'localCrestOffsetY', scaleKey: 'localCrestScale', crestTeam: 'A' },
      { id: 'awayCrest', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'awayCrestOffsetX', yKey: 'awayCrestOffsetY', scaleKey: 'awayCrestScale', crestTeam: 'B' },
      { id: 'texto1', label: 'TEXTO MAIN (TIRA AZUL)', kind: 'text', textKey: 'texto1' },
      { id: 'texto2', label: 'SUBTEXTO (TIRA VERDE)', kind: 'text', textKey: 'texto2' },
      { id: 'sponsor', label: 'SPONSOR', kind: 'composition', xKey: 'sponsorOffsetX', yKey: 'sponsorOffsetY', scaleKey: 'sponsorScale' },
    ],
  },
  zocaloCompuestoLogo: {
    elements: [
      { id: 'logo', label: 'LOGO', kind: 'composition', xKey: 'logoOffsetX', yKey: 'logoOffsetY', scaleKey: 'logoScale' },
      { id: 'texto1', label: 'TEXTO MAIN (TIRA AZUL)', kind: 'text', textKey: 'texto1' },
      { id: 'texto2', label: 'SUBTEXTO (TIRA VERDE)', kind: 'text', textKey: 'texto2' },
      { id: 'sponsor', label: 'SPONSOR', kind: 'composition', xKey: 'sponsorOffsetX', yKey: 'sponsorOffsetY', scaleKey: 'sponsorScale' },
    ],
  },
  // "zocaloFinal"/"zocaloFinalDiv" (2026-08-31): sin entrada de registro.
  // HIDDEN_FROM_NAV_IDS (ver master-control/js/main.js) -- reemplazados
  // por "zocaloCompuesto" (2026-08-16), sin panel propio en Master Control
  // donde mostrar ningun acordeon. Excepcion documentada en el informe
  // final, no una falta de cobertura.

  // --- GRUPOS / BRACKETS / TABLAS ---
  // Las 6 entradas de abajo (grupos/sideTable/posiciones/posicionesTorneo/
  // goleadores/asistidores/jugadores) declaran SOLO "crest" (composition):
  // todos los demas campos (titulo/nombre/puntos/numero/equipo/pts/pj/g/
  // gxp/pxp/p/gf/gc/dg/golLocal/golVisitante/estado/estadoFullscreen/
  // tituloBracket/position/name/primaryStat/stat0/stat1/stat2) YA tienen
  // su propio control por columna (con GUARDAR POSICIÓN) dentro de la
  // seccion "AJUSTE DE TEXTOS"/"AJUSTE DE COMPOSICIÓN" de cada panel
  // dedicado (2026-08-31, ver grupos-panel.js, resultados-panel.js,
  // posiciones-panel.js, performance-table-panel.js) -- declararlos aca
  // tambien duplicaria el control. "crest" es el unico elemento
  // genuinamente nuevo (escudo por fila/columna, nunca tuvo ajuste propio).
  grupos: {
    elements: [
      { id: 'crest', label: 'ESCUDO (COLUMNA)', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
    ],
  },
  sideTable: {
    elements: [
      { id: 'crestLocal', label: 'ESCUDO LOCAL (COLUMNA)', kind: 'composition', xKey: 'crestLocalOffsetX', yKey: 'crestLocalOffsetY', scaleKey: 'crestLocalScale' },
      { id: 'crestVisitante', label: 'ESCUDO VISITANTE (COLUMNA)', kind: 'composition', xKey: 'crestVisitanteOffsetX', yKey: 'crestVisitanteOffsetY', scaleKey: 'crestVisitanteScale' },
    ],
  },
  posiciones: {
    elements: [
      { id: 'crest', label: 'ESCUDO (COLUMNA)', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
    ],
  },
  posicionesTorneo: {
    elements: [
      { id: 'crest', label: 'ESCUDO (COLUMNA)', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
    ],
  },
  goleadores: {
    elements: [
      { id: 'crest', label: 'ESCUDO (COLUMNA)', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
    ],
  },
  asistidores: {
    elements: [
      { id: 'crest', label: 'ESCUDO (COLUMNA)', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
    ],
  },
  jugadores: {
    elements: [
      { id: 'crest', label: 'ESCUDO (COLUMNA)', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
    ],
  },
  // "fichaJugador" (2026-09-02, pedido explicito del usuario, Argentina
  // Streamers): un unico escudo (el del jugador seleccionado), mismo
  // criterio "column-level" que arriba aunque solo haya una fila -- no es
  // "crestTeam" (ver esa docstring mas arriba) porque no depende de
  // LOCAL/VISITANTE del Marcador, depende del jugador elegido en el
  // propio modulo.
  fichaJugador: {
    elements: [
      { id: 'crest', label: 'ESCUDO', kind: 'composition', xKey: 'crestOffsetX', yKey: 'crestOffsetY', scaleKey: 'crestScale' },
    ],
  },
  // "historial" (2026-09-02, reconstruido desde cero sobre el PNG real --
  // ver informe): sin panel dedicado de composicion propio, el acordeon
  // generico alcanza para las 4 columnas (2 escudos + 2 goles) mas
  // "COMPOSICIÓN COMPLETA" automatica -- mismo criterio "column-level" que
  // goleadores/asistidores/jugadores arriba, un unico ajuste se aplica a
  // las 5 filas por igual.
  historial: {
    elements: [
      { id: 'titulo', label: 'TÍTULO', kind: 'text', textKey: 'titulo' },
      { id: 'crestLocal', label: 'ESCUDO LOCAL (COLUMNA)', kind: 'composition', xKey: 'crestLocalOffsetX', yKey: 'crestLocalOffsetY', scaleKey: 'crestLocalScale' },
      { id: 'crestVisitante', label: 'ESCUDO VISITANTE (COLUMNA)', kind: 'composition', xKey: 'crestVisitanteOffsetX', yKey: 'crestVisitanteOffsetY', scaleKey: 'crestVisitanteScale' },
      { id: 'golLocal', label: 'GOL LOCAL (COLUMNA)', kind: 'text', textKey: 'golLocal' },
      { id: 'golVisitante', label: 'GOL VISITANTE (COLUMNA)', kind: 'text', textKey: 'golVisitante' },
    ],
  },
  // "cronogramaHoy" (2026-09-02, reconstruido desde cero sobre el PNG real
  // -- ver informe): escudos con "crestTeam" (posicion propia por teamId
  // real del Marcador, mismo mecanismo ya probado en zocaloCompuestoEquipos/
  // marcadorPenales) -- nunca un selector de equipo propio, pedido
  // explicito del usuario.
  cronogramaHoy: {
    elements: [
      { id: 'titulo', label: 'TÍTULO', kind: 'text', textKey: 'titulo' },
      { id: 'crestLocal', label: 'ESCUDO LOCAL', kind: 'composition', xKey: 'crestLocalOffsetX', yKey: 'crestLocalOffsetY', scaleKey: 'crestLocalScale', crestTeam: 'A' },
      { id: 'crestVisitante', label: 'ESCUDO VISITANTE', kind: 'composition', xKey: 'crestVisitanteOffsetX', yKey: 'crestVisitanteOffsetY', scaleKey: 'crestVisitanteScale', crestTeam: 'B' },
    ],
  },
  // "placaLInfo" (2026-08-31): sin entrada de registro aca a proposito --
  // ya tiene un panel dedicado propio (master-control/js/placa-l-info-panel.js)
  // con 4 zocalos independientes, cada uno con su propia composicion
  // (offsetX/Y/scale) y ajuste de texto (textAdjust), montados directo
  // sobre el sub-objeto de cada zocalo (no sobre el "data" del modulo
  // completo, que es lo unico que ADJUST_REGISTRY/renderModuleAdjustAccordion
  // saben resolver) -- agregar una entrada aca duplicaria controles ya
  // existentes y funcionando. "COMPOSICIÓN COMPLETA" (mueve los 4 zocalos
  // juntos) se sigue mostrando igual, es universal y no depende del
  // registro.
};
