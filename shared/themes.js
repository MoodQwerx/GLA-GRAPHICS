// REGISTRO DE THEMES (2026-08-20, pedido explícito: "preparar el proyecto
// para que deje de estar atado exclusivamente a GLA"). Este archivo es el
// ÚNICO lugar que sabe qué asset le corresponde a cada módulo según el
// theme activo -- la idea es que en vez de "if GLA... if Argentina..."
// repartido en 25 renderers, cada renderer pueda preguntar
// "getThemeAsset(themeId, moduleId)" y listo.
//
// 2026-08-21, ETAPA 2 (pedido explícito: "no quiero solamente un
// placeholder... quiero ARGENTINA STREAMERS OPERATIVO AHORA"): los
// renderers de Program YA consumen este manifest vía
// program/js/theme-assets.js -- para GLA siguen usando su constante
// hardcodeada de siempre como fuente de verdad (nunca el manifest, ver
// esa razón en theme-assets.js), así que esto no cambia nada de lo que
// ya se veía. Para cualquier theme que NO sea GLA, "video"/"image" en
// null significa literalmente "todavía no hay archivo" -- Program
// entonces NO monta ninguna capa de video/imagen para ese módulo y
// renderiza solo el contenido dinámico (texto/escudos/números) sobre
// transparencia. Ver docs/THEMES.md para el detalle completo.
//
// LIVE GRAPHICS (el software) -> THEME seleccionado -> assets
// correspondientes. "GLA" acá es pura y exclusivamente un THEME/
// competencia (Gran Liga Relámpago) -- nada de esto reemplaza gla.futbol,
// los módulos de datos GLA, ni ningún identificador interno existente.

export const DEFAULT_THEME_ID = 'gla';
export const ARGENTINA_STREAMERS_THEME_ID = 'argentinaStreamers';

// Catálogo de módulos con asset gráfico propio (pedido explícito, sección
// 12) -- nombres DESCRIPTIVOS de referencia; la clave real que usa cada
// entrada de "assets" abajo es el MODULE_ID real de shared/modules.js.
export const THEME_ASSET_MODULES = [
  { key: 'scoreboard', label: 'Marcador' },
  { key: 'marcadorTiempoAdicional', label: 'Tiempo adicional' },
  { key: 'marcadorEntretiempo', label: 'Entretiempo' },
  { key: 'marcadorPenales', label: 'Penales' },
  { key: 'marcadorZocalo', label: 'Marcador Zócalo' },
  { key: 'tarjeta', label: 'Tarjetas' },
  { key: 'cambios', label: 'Cambios' },
  { key: 'gol', label: 'Gol' },
  { key: 'varCheck', label: 'VAR' },
  { key: 'varCheckMotivo', label: 'VAR Motivo (zócalo corto)' },
  { key: 'replay', label: 'Replay' },
  { key: 'bug', label: 'Mosca' },
  { key: 'longDouble', label: 'Zócalo largo doble' },
  { key: 'shortSimple', label: 'Zócalo corto simple' },
  { key: 'shortDouble', label: 'Zócalo corto doble' },
  { key: 'zocaloCompuesto', label: 'Zócalo compuesto' },
  { key: 'zocaloCompuestoEquipos', label: 'Zócalo compuesto con equipos' },
  { key: 'zocaloCompuestoLogo', label: 'Zócalo compuesto con logo' },
  { key: 'zocaloFinal', label: 'Zócalo final' },
  { key: 'zocaloFinalDiv', label: 'Zócalo final con equipos' },
  { key: 'placaLInfo', label: 'Placa L Info' },
  { key: 'vs', label: 'VS' },
  { key: 'vsPrepartido', label: 'VS Prepartido' },
  { key: 'vsResultado', label: 'VS con resultado' },
  { key: 'formacionEquipos', label: 'Formaciones' },
  { key: 'estrellas', label: 'Estrellas' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'goleadores', label: 'Goleadores' },
  { key: 'asistidores', label: 'Asistidores' },
  { key: 'jugadores', label: 'Mejores jugadores' },
  { key: 'fichaJugador', label: 'Ficha Jugador' },
  // "cronogramaHoy"/"resultadosParciales"/"historial" (2026-09-02):
  // modulos de BRACKETS entregados por un agente concurrente -- ver
  // docs/PATCH_SHARED_CLAUDE.md (handoff recibido) y
  // docs/BRACKETS_ARGENTINA_STREAMERS.md. Integrados tal cual pidio el
  // patch, sin tocar su logica/renderer/panel.
  { key: 'cronogramaHoy', label: 'Cronograma Hoy' },
  { key: 'resultadosParciales', label: 'Resultados Parciales' },
  { key: 'historial', label: 'Historial' },
  { key: 'sitioWebPromoL', label: 'Sitio Web Promo L' },
  { key: 'sideTable', label: 'Resultados' },
  { key: 'posiciones', label: 'Posiciones' },
  { key: 'posicionesTorneo', label: 'Posiciones (Torneo)' },
  { key: 'sponsors', label: 'Sponsors' },
];

export const THEMES = {
  gla: {
    id: 'gla',
    name: 'GRAN LIGA RELÁMPAGO',
    shortName: 'GLA',
    // "ready: true" -- este theme ya tiene TODOS sus assets reales
    // (los mismos que el proyecto usa hoy, sin ningún cambio).
    ready: true,
    // Fuente de datos externa asociada a este theme (sección 10):
    // gla.futbol pertenece EXCLUSIVAMENTE a este theme.
    dataSource: 'gla-futbol',
    // Espejo de las rutas YA hardcodeadas en cada renderer (ver grep de
    // "VIDEO_SRC"/"IMG_SRC" en program/js/renderers/*.js) -- documentado
    // acá para que el manifest sea la fuente de verdad el día que se
    // migren los renderers, pero HOY los renderers siguen usando su
    // propia constante, no esto.
    assets: {
      scoreboard: { video: '/assets/marcador/marcador-principal-alpha.mp4' },
      marcadorTiempoAdicional: { image: '/assets/marcador/marcador-tiempo-adicional.png' },
      marcadorEntretiempo: { video: '/assets/marcador/marcador-entretiempo-alpha.mp4' },
      marcadorPenales: { video: '/assets/marcador/marcador-penales-alpha.mp4' },
      marcadorZocalo: { image: '/assets/marcador/marcador-zocalo.png' },
      tarjeta: {
        video: '/assets/eventos/tarjeta-amarilla-alpha.mp4',
        variants: {
          amarilla: '/assets/eventos/tarjeta-amarilla-alpha.mp4',
          roja: '/assets/eventos/tarjeta-roja-alpha.mp4',
          azul: '/assets/eventos/tarjeta-azul-alpha.mp4',
        },
      },
      cambios: { video: '/assets/eventos/cambios-alpha.mp4' },
      gol: { video: '/assets/eventos/gol-alpha.mp4' },
      varCheck: { video: '/assets/var/var-chequeo-alpha.mp4', image: '/assets/var/zocalo-cortito-brackets.png' },
      replay: { video: '/assets/replay/replay-sponsor-alpha.mp4' },
      bug: { video: '/assets/mosca/mosca-localstrike-alpha.mp4' },
      longDouble: { video: '/assets/zocalos/zocalo-largo-doble-alpha.mp4' },
      shortSimple: { video: '/assets/zocalos/zocalo-corto-simple-alpha.mp4' },
      shortDouble: { video: '/assets/zocalos/zocalo-corto-doble-alpha.mp4' },
      zocaloCompuesto: { image: '/assets/images/gla-logo.png' },
      zocaloCompuestoEquipos: { video: '/assets/zocalos/zocalo-final-div-alpha.mp4' },
      zocaloCompuestoLogo: { video: '/assets/zocalos/zocalo-final-alpha.mp4', image: '/assets/images/gla-logo.png' },
      zocaloFinal: { video: '/assets/zocalos/zocalo-final-alpha.mp4', image: '/assets/images/gla-logo.png' },
      zocaloFinalDiv: { video: '/assets/zocalos/zocalo-final-div-alpha.mp4' },
      placaLInfo: { image: '/assets/var/zocalo-cortito-brackets.png' },
      vs: {
        variants: {
          normal: '/assets/zocalos/zocalo-vs-alpha.mp4',
          alto: '/assets/zocalos/zocalo-vs-renglon-alto-alpha.mp4',
          medio: '/assets/zocalos/zocalo-vs-renglon-medio-alpha.mp4',
          fino: '/assets/zocalos/zocalo-vs-renglon-fino-alpha.mp4',
        },
      },
      vsPrepartido: { video: '/assets/placas/vs-prepartido-alpha.mp4' },
      vsResultado: { video: '/assets/placas/vs-resultado-alpha.mp4' },
      formacionEquipos: {
        video: '/assets/placas/formacion-equipos.mp4',
        image: '/assets/placas/formacion-camisetas.png',
      },
      estrellas: { video: '/assets/placas/estrellas-alpha.mp4' },
      grupos: { image: '/assets/tablas/resultados-sin-vs.png' },
      goleadores: { image: '/assets/tablas/resultados-sin-vs.png' },
      asistidores: { image: '/assets/tablas/resultados-sin-vs.png' },
      jugadores: { image: '/assets/tablas/resultados-sin-vs.png' },
      sideTable: { image: '/assets/tablas/resultados-sin-vs.png' },
      posiciones: {
        variants: {
          pagina1: '/assets/tablas/posiciones-alpha.mp4',
          pagina2: '/assets/tablas/posiciones-5-alpha.mp4',
        },
      },
      posicionesTorneo: {
        variants: {
          pagina1: '/assets/tablas/posiciones-alpha.mp4',
          pagina2: '/assets/tablas/posiciones-5-alpha.mp4',
        },
      },
      sponsors: { folder: '/assets/sponsors' },
    },
  },

  argentinaStreamers: {
    id: 'argentinaStreamers',
    name: 'ARGENTINA STREAMERS',
    shortName: 'AR STREAMERS',
    // "ready: false" -- ningún módulo tiene TODAVÍA su asset gráfico
    // definitivo (pedido explícito: "NO inventes, copies ni reemplaces
    // assets del nuevo theme"). Esto ya NO bloquea nada -- ni TAKE, ni
    // Program, ni la lógica de ningún módulo (pedido explícito, etapa 2)
    // -- solo controla el banner informativo "ASSETS PENDIENTES" de
    // Master Control. Cada módulo de "assets" abajo tiene además su
    // propio "status" individual para el indicador por-módulo.
    ready: false,
    // Sin integración externa todavía -- decisión futura (sección 10,
    // pedido explícito: "por ahora MANUAL").
    dataSource: 'manual',
    // Paleta CELESTE + BLANCO (sección 1, pedido explícito) -- fuente de
    // verdad única de los 3 colores pedidos; master-control/css/master.css
    // los usa vía "data-theme" + variables CSS, no duplica los hex.
    palette: {
      primary: '#6ECBF5',   // celeste principal
      accent: '#209DDB',    // azul complementario
      base: '#FFFFFF',      // blanco
    },
    // Equipos iniciales para este theme (sección 9 del pedido, ejemplo
    // concreto dado: "ARGENTINA STREAMERS vs PERÚ CREADORES"). Escudos
    // reales cargados 2026-08-31 (pedido explícito del usuario, "carga de
    // escudos") en assets/themes/argentina-streamers/escudos/ -- los
    // renderers ya sabían mostrar un equipo sin escudo mientras "file" era
    // null (ver "setCrest()" en program/js/renderers/scoreboard.js, sin
    // cambios). Catálogo SEPARADO del de GLA (server/teams.js lo resuelve
    // por theme) -- agregar equipos acá nunca aparece en el selector de
    // equipos de GLA ni al revés.
    teams: [
      { id: 'argentina-streamers', name: 'Argentina Streamers', abbr: 'ARG', file: '/assets/themes/argentina-streamers/escudos/argentina-streamers.png' },
      { id: 'peru-creadores', name: 'Perú Creadores', abbr: 'PER', file: '/assets/themes/argentina-streamers/escudos/peru-creadores.png' },
      // "oxen" y "argentina-streamers-fem": 2 equipos mas (pedido
      // explicito, 2026-09-01) con sus escudos reales ya en
      // assets/themes/argentina-streamers/escudos/. "ARF" (no "ARG") para
      // que no choque con el abbr del equipo masculino de arriba -- misma
      // convencion de 3 letras que server/teams.js, con override manual
      // (igual que los "overrides puntuales" que ya usa ese archivo para
      // los equipos de GLA) porque la derivacion automatica de las 2
      // primeras palabras de "Argentina Streamers FEM" tambien da "ARG".
      { id: 'oxen', name: 'OXEN', abbr: 'OXE', file: '/assets/themes/argentina-streamers/escudos/oxen.png' },
      { id: 'argentina-streamers-fem', name: 'Argentina Streamers FEM', abbr: 'ARF', file: '/assets/themes/argentina-streamers/escudos/argentina-streamers-fem.png' },
      // Argentina Senior (2026-09-04, pedido explicito del usuario): escudo
      // extraido del PDF vectorial entregado en "cosas sueltas/" (nunca
      // usado directo en runtime -- exportado una vez a PNG transparente,
      // recorte ajustado al bounding box real del arte via analisis de
      // canal alfa, misma carpeta que el resto de escudos AS). "LSF" es la
      // abreviatura pedida explicitamente (no derivada del logo).
      { id: 'argentina-senior', name: 'ARGENTINA SENIOR', abbr: 'LSF', file: '/assets/themes/argentina-streamers/escudos/argentina-senior.png' },
    ],
    // Un objeto por cada módulo de THEME_ASSET_MODULES, generado acá mismo
    // (no a mano) para garantizar que NINGUNO quede afuera -- "video"/
    // "image" en null = "status: pending". Los módulos que ya recibieron su
    // asset real (2026-08-28, primera entrega del diseñador -- carpeta
    // "ARGENTINA STREAMERS VS PERU CREADORES 5/9") pisan ese default más
    // abajo: sin "status" explícito, "getModuleAssetStatus()" infiere
    // 'ready' solo con que haya un video/image real, mismo criterio que
    // GLA. Cuando llegue el resto, el mismo patrón (copiar archivo acá +
    // agregar una línea abajo) alcanza -- nada de código nuevo.
    assets: {
      ...Object.fromEntries(THEME_ASSET_MODULES.map(({ key }) => [
        key,
        { video: null, image: null, status: 'pending' },
      ])),
      scoreboard: { video: '/assets/themes/argentina-streamers/marcador/scoreboard-alpha.mp4' },
      marcadorPenales: { video: '/assets/themes/argentina-streamers/marcador/marcador-penales-alpha.mp4' },
      marcadorTiempoAdicional: { image: '/assets/themes/argentina-streamers/marcador/marcador-tiempo-adicional.png' },
      // ACTUALIZADO (2026-09-04, pedido explicito del usuario): el PNG que
      // vivia aca ("marcador-entretiempo.png", entregado 2026-09-01) en
      // realidad no era el asset correcto de ESTE modulo -- el usuario
      // aviso explicitamente "no lo confundas con el asset que ya
      // identificamos como de MARCADOR ZÓCALO" (ver esa entrada, unas
      // lineas abajo, que sigue usando ese archivo viejo sin tocarse).
      // Este es el PNG real de Entretiempo ("ENTRETIEMPO_FINAL2.png" en
      // cosas sueltas/), archivo PROPIO (nunca compartido con Zócalo) para
      // que un futuro cambio de uno no afecte al otro por accidente.
      marcadorEntretiempo: { image: '/assets/themes/argentina-streamers/marcador/entretiempo.png' },
      // "marcadorZocalo" (2026-09-04, correccion explicita del usuario: "el
      // error fue mio con el nombre") no tenia entrada propia aca -- quedaba
      // sin asset (solo texto/reloj flotando). Sigue usando el PNG viejo de
      // arriba (el que en su momento se identifico, erroneamente, como
      // "ENTRETIEMPO") -- ese diseño SI es el correcto para Zócalo, no se
      // toca.
      marcadorZocalo: { image: '/assets/themes/argentina-streamers/marcador/marcador-entretiempo.png' },
      gol: { video: '/assets/themes/argentina-streamers/incidencias/gol-alpha.mp4' },
      cambios: { video: '/assets/themes/argentina-streamers/incidencias/cambios-alpha.mp4' },
      tarjeta: {
        video: '/assets/themes/argentina-streamers/incidencias/tarjeta-amarilla-alpha.mp4',
        variants: {
          amarilla: '/assets/themes/argentina-streamers/incidencias/tarjeta-amarilla-alpha.mp4',
          roja: '/assets/themes/argentina-streamers/incidencias/tarjeta-roja-alpha.mp4',
          azul: '/assets/themes/argentina-streamers/incidencias/tarjeta-azul-alpha.mp4',
        },
      },
      varCheck: { video: '/assets/themes/argentina-streamers/var-replay/var-chequeo-alpha.mp4' },
      varCheckMotivo: { video: '/assets/themes/argentina-streamers/zocalos/zocalo-corto-doble-alpha.mp4' },
      replay: { video: '/assets/themes/argentina-streamers/var-replay/replay-sponsor-alpha.mp4' },
      bug: { video: '/assets/themes/argentina-streamers/mosca/mosca-localstrike-alpha.mp4' },
      shortSimple: { video: '/assets/themes/argentina-streamers/zocalos/zocalo-corto-simple-alpha.mp4' },
      shortDouble: { video: '/assets/themes/argentina-streamers/zocalos/zocalo-corto-doble-alpha.mp4' },
      longDouble: { video: '/assets/themes/argentina-streamers/zocalos/zocalo-largo-doble-alpha.mp4' },
      // Zocalo Compuesto: UN solo modulo con 2 variantes por "tipo" (ver
      // data.tipo en program/js/renderers/zocaloCompuesto.js, logica ya
      // existente sin cambios) -- "logo" deja el area de logo vacia por
      // ahora (llega despues), "equipos" hereda escudos LOCAL/VISITANTE en
      // vivo del Marcador (mismo patron que tarjeta/cambios).
      // CORRECCION (2026-09-01, mismo dia -- el usuario aviso que la
      // primera entrega/asignacion estaba mal por una confusion suya): los
      // assets REALES son "ZOCALO_LARGO.mov" (sin division, para "logo")
      // y "ZOCALO_LARGO_linea.mov" (con la linea divisoria del lado
      // izquierdo, para "equipos") -- confirmado por INSPECCION VISUAL
      // real de un frame de cada uno (ffmpeg), no por nombre de archivo:
      // "_linea" es, literamente, el unico de los dos con una linea
      // blanca vertical separando la zona de escudos del resto del
      // zocalo. Los .mov de la entrega anterior (derivados de
      // ZOCALO_VS/ZOCALO_VS_V2) quedaron archivados en
      // ai-gfx/argentina-streamers/unused/ -- ya NO son el asset activo.
      // NOTA (2026-09-01): los .mov entregados eran ProRes 4444 (canal alfa
      // real, "yuva444p12le") -- ningun navegador/Chromium (ni el Program
      // real dentro de vMix) puede decodificar ese codec (confirmado en
      // vivo: video.error.message = "DEMUXER_ERROR_NO_SUPPORTED_STREAMS").
      // Transcodificados UNA vez a .mp4 H.264 apilado color+alfa (mismo
      // formato que usa el resto del proyecto -- ver el comentario de
      // cabecera de program/js/alpha-video.js, que documenta este mismo
      // pipeline como el estandar ya usado en todo el proyecto). Mismo
      // contenido visual, sin recortes ni ediciones -- solo cambia el
      // contenedor/codec para que sea reproducible. Los .mov originales NO
      // se borraron: quedan archivados en
      // ai-gfx/argentina-streamers/prores-originals/ (fuera de git, ver
      // .gitignore) por si hace falta re-transcodificar con otros ajustes.
      zocaloCompuesto: {
        variants: {
          logo: '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-logo-alpha.mp4',
          equipos: '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-equipos-alpha.mp4',
        },
      },
      zocaloCompuestoEquipos: { video: '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-equipos-alpha.mp4' },
      zocaloCompuestoLogo: {
        video: '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-logo-alpha.mp4',
        image: '/assets/themes/argentina-streamers/zocalos/logo-localstrike.png'
      },
      // VS Prepartido/Resultado (2026-09-01): los 2 assets estaban
      // CRUZADOS -- el que hoy vivia acá como "vsPrepartido" en realidad
      // tenia el recuadro verde de resultado (confirmado por inspeccion
      // real de frames con ffmpeg, no por nombre de archivo). Corregido:
      // "vs-prepartido-alpha.mov" (sin recuadro verde, del ZIP) es el
      // Prepartido real; el .mp4 que estaba mal puesto aca se movio a
      // "vsResultado" (recuadro verde, contenido correcto para ese modulo).
      vsPrepartido: { video: '/assets/themes/argentina-streamers/vs/vs-prepartido-alpha.mp4' },
      // vsResultado (2026-09-02): PNG real (VS_RESULTADO entregado por el
      // usuario) reemplaza al .mp4 anterior -- geometria vertical medida
      // pixel a pixel, ver program/js/renderers/vsResultado.js. El video
      // viejo (vs-resultado-alpha.mp4) queda sin referenciar; no se borro
      // el archivo por las dudas, solo se dejo de usar.
      // Revertido (2026-09-04, pedido explicito del usuario: "se reemplazo
      // accidentalmente por el asset que corresponde a RESULTADOS
      // PARCIALES") al video que este modulo usaba ANTES del cambio a PNG
      // del 2026-09-02 (commit 83cf1fa) -- confirmado por git history, no
      // inventado. El PNG "vs-resultado.png" y su geometria vertical
      // quedan reservados exclusivamente para "resultadosParciales" (ver
      // esa entrada mas abajo), que ya tiene su propio asset separado
      // "resultados-parciales.png" -- no se vuelven a mezclar.
      vsResultado: { video: '/assets/themes/argentina-streamers/vs/vs-resultado-alpha.mp4' },
      // Estrellas (2026-09-01): asset real ("ASSET ESTRELLAS" del ZIP) --
      // solo el asset visual, la logica de datos (jugadores/escudos/
      // stats/PJ/editores/posiciones) sigue exactamente igual, sin tocar.
      estrellas: { video: '/assets/themes/argentina-streamers/estrellas/estrellas-alpha.mp4' },
      formacionEquipos: {
        video: '/assets/themes/argentina-streamers/formaciones/formacion-alpha.mp4',
        // Mapping por teamId estable. Argentina masculino y femenino
        // comparten el PNG entregado; equipos con valor null quedan sin
        // capa de camisetas hasta que el operador integre su asset real.
        formationAssetsByTeam: {
          'argentina-streamers': '/assets/themes/argentina-streamers/formaciones/kits/formacion-arg.png',
          'argentina-streamers-fem': '/assets/themes/argentina-streamers/formaciones/kits/formacion-arg.png',
          // Argentina Senior (2026-09-04, pedido explicito): misma camiseta
          // FORMACION ARG que Argentina Streamers / FEM.
          'argentina-senior': '/assets/themes/argentina-streamers/formaciones/kits/formacion-arg.png',
          oxen: '/assets/themes/argentina-streamers/formaciones/kits/formacion-oxen.png',
          'peru-creadores': '/assets/themes/argentina-streamers/formaciones/kits/formacion-peru.png',
        },
      },
      // Historial (2026-09-02): PNG real entregado por el usuario --
      // geometria medida pixel a pixel, ver program/js/renderers/historial.js.
      historial: { image: '/assets/themes/argentina-streamers/tablas/historial.png' },
      // Goleadores/Asistidores/Participaciones (2026-09-02): comparten UN
      // unico PNG real (10 slots, sin escudo por fila -- ver
      // program/js/renderers/performanceTable.js), mismo archivo en los 3,
      // sin duplicarlo en disco.
      goleadores: { image: '/assets/themes/argentina-streamers/tablas/tabla-estadisticas.png' },
      asistidores: { image: '/assets/themes/argentina-streamers/tablas/tabla-estadisticas.png' },
      jugadores: { image: '/assets/themes/argentina-streamers/tablas/tabla-estadisticas.png' },
      // Cronograma Hoy (2026-09-02): PNG real (VS_DEFAULT entregado por el
      // usuario) -- reemplaza la tarjeta fabricada en CSS que habia antes.
      cronogramaHoy: { image: '/assets/themes/argentina-streamers/brackets/cronograma-hoy.png' },
      // Resultados Parciales (2026-09-03, corrección explícita del
      // usuario): PNG real entregado en "cosas sueltas/PSD/vs_resultado.psd"
      // (confirmado por inspección -- mismos escudos con cuadrito blanco
      // de resultado que VS_RESULTADO), exportado y copiado a la carpeta
      // permanente de este theme (no referencia "cosas sueltas" en
      // runtime) -- reemplaza la tarjeta fabricada en CSS que habia antes.
      resultadosParciales: { image: '/assets/themes/argentina-streamers/brackets/resultados-parciales.png' },
      // Sitio Web Promo L (2026-09-02): PNG real (ANUNCIO_AS entregado).
      sitioWebPromoL: { image: '/assets/themes/argentina-streamers/extras/anuncio-as.png' },
    },
  },
};

export function listThemes() {
  return Object.values(THEMES);
}

export function isValidThemeId(themeId) {
  return Object.prototype.hasOwnProperty.call(THEMES, themeId);
}

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME_ID];
}

export function isThemeReady(themeId) {
  return Boolean(getTheme(themeId)?.ready);
}

// getThemeAsset(themeId, moduleId, kind?) -- el punto de entrada que
// pidió el enunciado ("Cada módulo debería poder preguntar qué asset
// corresponde al theme activo"). "kind" es opcional ('video'/'image'/
// 'folder'/'variants'); sin "kind" devuelve el objeto de asset completo
// del módulo para ese theme, o null si el theme no tiene ese módulo
// todavía preparado (ej. cualquier módulo de "argentinaStreamers" hoy).
export function getThemeAsset(themeId, moduleId, kind) {
  const theme = getTheme(themeId);
  const moduleAsset = theme.assets[moduleId];
  if (!moduleAsset) return null;
  return kind ? (moduleAsset[kind] ?? null) : moduleAsset;
}

// Estado por-módulo (sección 6 del pedido: "Master puede mostrar
// discretamente ASSET ARGENTINA STREAMERS: PENDIENTE dentro del módulo
// correspondiente"). Si la entrada trae "status" explícito (Argentina
// Streamers, siempre) se usa tal cual; si no (GLA, que nunca lo declara
// porque sus assets ya existen todos) se infiere 'ready' con solo
// comprobar que el módulo tenga *algún* asset real cargado.
export function getModuleAssetStatus(themeId, moduleId) {
  const asset = getThemeAsset(themeId, moduleId);
  if (!asset) return 'pending';
  if (asset.status) return asset.status;
  return (asset.video || asset.image || asset.folder || asset.variants) ? 'ready' : 'pending';
}

// Catálogo de equipos propio del theme (sección 9: "Preparar también la
// lógica de equipos"). GLA sigue resolviendo su catálogo desde
// assets/crests/ (ver server/teams.js) -- esto es exclusivamente para
// themes que todavía no tienen esa carpeta de escudos real.
export function getThemeTeams(themeId) {
  return getTheme(themeId)?.teams || [];
}
