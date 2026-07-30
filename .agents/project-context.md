# Contexto del proyecto

## Producto

Sistema local de gráficas para transmisiones de fútbol:

- **Master Control** en `/master-control/` (acceso abreviado `/master`): operación, carga de datos, estado al aire y Preview Monitor.
- **Program** en `/program/`: salida transparente 1920×1080 para OBS, vMix o Browser Source equivalente.
- **Servidor Node.js**: Express para archivos/rutas y `ws` para sincronización en tiempo real.

No hay build step. Se sirven HTML, CSS y módulos ES nativos. Node.js 18 o superior es el runtime esperado. Las únicas dependencias de producción actuales son `express` y `ws`.

## Mapa real

- `server/`: HTTP, WebSocket, catálogo de equipos y estado autoritativo.
- `shared/`: protocolo, schema de módulos, relojes, equipos, colores, escape y cliente WebSocket.
- `master-control/`: interfaz del operador y editores generados desde schema.
- `program/`: stage broadcast, compositor de alfa, renderers y posicionamiento.
- `assets/`: fuentes, escudos y medios procesados usados en runtime.
- `ai-gfx/`: fuentes originales de diseño; no se sirve en runtime.
- `data/`: datos del Master persistidos localmente; está ignorada por Git.
- `docs/`: arquitectura y ficha funcional/visual de módulos.

## Fuentes de verdad actuales

- Registro, campos y defaults de módulos: `shared/modules.js`.
- Tipos de mensajes, estados y campos: `shared/constants.js`.
- Estado autoritativo y persistencia: `server/state.js`.
- Equipos: archivos de `assets/crests/`, expuestos por `server/teams.js` y consumidos mediante `shared/teams.js`.
- Colores de camiseta: `shared/team-colors.js`.
- Composición de cada módulo: su renderer más las reglas correspondientes en `program/css/overlay.css`.
- Identidad visual compartida: `program/css/theme.css`.
- Operación del Master: `master-control/js/main.js` y `field-editors.js`.

## Estado y operación vigente

El servidor mantiene por módulo `{ status, data }`. `data` se persiste en `data/master-control-state.json`; `status` no se persiste y siempre arranca en `OUT`. El Master autoguarda ediciones con `UPDATE` y debounce, además de los comandos explícitos TAKE/UPDATE/OUT.

El Program permite varias capas simultáneas. No existe exclusión automática de fullscreen. El campo `layer` del schema es descriptivo; el orden de apilado efectivo depende del DOM y CSS.

Hay 21 módulos registrados en siete categorías. Los módulos con `live`, `oneShot` o `autoRunClock` tienen ciclos de vida especiales definidos en `shared/modules.js`.

## Restricciones operativas

- El Program está diseñado para 1920×1080 fijo, fondo transparente y 100% de zoom.
- OBS/vMix no deben apagar la fuente al ocultarla si eso corta la conexión.
- Los assets con alfa se entregan al navegador como MP4 color+matte y se componen con `program/js/alpha-video.js`.
- Los datos dinámicos se superponen en HTML; el arte del paquete gráfico no se recrea en CSS.
- Anton local es la tipografía del Program. Master Control sobrescribe la tipografía con una fuente de sistema por legibilidad operativa.
- No hay suite automática ni linter configurados; las verificaciones manuales y `node --check` son parte de la evidencia.
