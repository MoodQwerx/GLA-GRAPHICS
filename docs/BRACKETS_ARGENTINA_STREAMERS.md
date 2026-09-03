# BRACKETS Argentina Streamers — Reestructuración y Arquitectura

Este documento especifica la reestructuración de la categoría **BRACKETS** para la identidad/theme `argentinaStreamers` dentro de GLA Broadcast Graphics System.

---

## 1. Resumen de Cambios

### Módulos ocultos ÚNICAMENTE para `argentinaStreamers`:
- **RESULTADOS** (`sideTable`)
- **TABLA GLOBAL** (`posiciones`)
- **POSICIONES TORNEO** (`posicionesTorneo`)

> **Importante:** Estos tres módulos siguen existiendo intactos en GLA. Sus renderers, registros, assets y esquemas no han sido borrados ni modificados. Únicamente se excluyen de la navegación y configuración activa cuando el theme seleccionado es `argentinaStreamers`.

### Módulos específicos agregados en `Brackets`:
1. **CRONOGRAMA HOY** (`cronogramaHoy`): Diseñado para mostrar dos encuentros del día con horario/estado.
2. **RESULTADOS PARCIALES** (`resultadosParciales`): Diseñado para dos encuentros con casilleros de goles y estado.
3. **HISTORIAL** (`historial`): Lista vertical de 5 resultados por página, con selección de categoría independiente, botón de sincronización web ("integración pendiente") y edición manual.

---

## 2. Definición y Modelo de Datos de los Módulos Nuevos

### 2.1. CRONOGRAMA HOY (`cronogramaHoy`)
- **ID:** `cronogramaHoy`
- **Label:** `Cronograma Hoy`
- **Categoría:** `Brackets`
- **Layer:** `fullscreen`
- **Sequenced Reveal:** `true`
- **Defaults:**
```json
{
  "titulo": "CRONOGRAMA HOY",
  "encuentros": [
    { "teamA": "argentina-streamers", "teamB": "oxen", "estado": "18:00 HS" },
    { "teamA": "peru-creadores", "teamB": "argentina-streamers-fem", "estado": "20:00 HS" }
  ],
  "textAdjust": {
    "titulo": { "dx": 0, "dy": 0, "dSize": 0 },
    "teamA1": { "dx": 0, "dy": 0, "dSize": 0 },
    "teamB1": { "dx": 0, "dy": 0, "dSize": 0 },
    "estado1": { "dx": 0, "dy": 0, "dSize": 0 },
    "teamA2": { "dx": 0, "dy": 0, "dSize": 0 },
    "teamB2": { "dx": 0, "dy": 0, "dSize": 0 },
    "estado2": { "dx": 0, "dy": 0, "dSize": 0 }
  },
  "compositionOffsetX": 0,
  "compositionOffsetY": 0,
  "compositionScale": 1
}
```

---

### 2.2. RESULTADOS PARCIALES (`resultadosParciales`)
- **ID:** `resultadosParciales`
- **Label:** `Resultados Parciales`
- **Categoría:** `Brackets`
- **Layer:** `fullscreen`
- **Sequenced Reveal:** `true`
- **Defaults:**
```json
{
  "titulo": "RESULTADOS PARCIALES",
  "encuentros": [
    { "teamA": "argentina-streamers", "teamB": "oxen", "scoreA": "2", "scoreB": "1", "estado": "FINAL" },
    { "teamA": "peru-creadores", "teamB": "argentina-streamers-fem", "scoreA": "0", "scoreB": "0", "estado": "EN JUEGO" }
  ],
  "textAdjust": {
    "titulo": { "dx": 0, "dy": 0, "dSize": 0 },
    "teamA1": { "dx": 0, "dy": 0, "dSize": 0 },
    "teamB1": { "dx": 0, "dy": 0, "dSize": 0 },
    "scoreA1": { "dx": 0, "dy": 0, "dSize": 0 },
    "scoreB1": { "dx": 0, "dy": 0, "dSize": 0 },
    "estado1": { "dx": 0, "dy": 0, "dSize": 0 },
    "teamA2": { "dx": 0, "dy": 0, "dSize": 0 },
    "teamB2": { "dx": 0, "dy": 0, "dSize": 0 },
    "scoreA2": { "dx": 0, "dy": 0, "dSize": 0 },
    "scoreB2": { "dx": 0, "dy": 0, "dSize": 0 },
    "estado2": { "dx": 0, "dy": 0, "dSize": 0 }
  },
  "compositionOffsetX": 0,
  "compositionOffsetY": 0,
  "compositionScale": 1
}
```

---

### 2.3. HISTORIAL (`historial`)
- **ID:** `historial`
- **Label:** `Historial`
- **Categoría:** `Brackets`
- **Layer:** `fullscreen`
- **Sequenced Reveal:** `true`
- **Categorías Estables (Claves Claves):** `iwc`, `amistosos-oficiales`, `copa-america`, `amistosos`.
- **Defaults:**
```json
{
  "titulo": "HISTORIAL DE PARTIDOS",
  "categoriaActiva": "iwc",
  "pagina": 1,
  "webIntegrationStatus": "pendiente",
  "categorias": {
    "iwc": [
      { "fecha": "FECHA 1", "teamA": "argentina-streamers", "teamB": "oxen", "scoreA": "3", "scoreB": "1", "competencia": "IWC" },
      { "fecha": "FECHA 2", "teamA": "peru-creadores", "teamB": "argentina-streamers-fem", "scoreA": "2", "scoreB": "2", "competencia": "IWC" }
    ],
    "amistosos-oficiales": [
      { "fecha": "AMISTOSO 1", "teamA": "argentina-streamers", "teamB": "peru-creadores", "scoreA": "1", "scoreB": "0", "competencia": "Amistoso Oficial" }
    ],
    "copa-america": [
      { "fecha": "FASE GRUPOS", "teamA": "argentina-streamers", "teamB": "oxen", "scoreA": "2", "scoreB": "0", "competencia": "Copa América" }
    ],
    "amistosos": [
      { "fecha": "PRACTICA", "teamA": "argentina-streamers-fem", "teamB": "oxen", "scoreA": "1", "scoreB": "1", "competencia": "Amistoso" }
    ]
  },
  "textAdjust": {
    "titulo": { "dx": 0, "dy": 0, "dSize": 0 },
    "categoriaTitulo": { "dx": 0, "dy": 0, "dSize": 0 },
    "fecha": { "dx": 0, "dy": 0, "dSize": 0 },
    "equipoLocal": { "dx": 0, "dy": 0, "dSize": 0 },
    "equipoVisitante": { "dx": 0, "dy": 0, "dSize": 0 },
    "golesLocal": { "dx": 0, "dy": 0, "dSize": 0 },
    "golesVisitante": { "dx": 0, "dy": 0, "dSize": 0 },
    "competencia": { "dx": 0, "dy": 0, "dSize": 0 },
    "paginaInfo": { "dx": 0, "dy": 0, "dSize": 0 }
  },
  "compositionOffsetX": 0,
  "compositionOffsetY": 0,
  "compositionScale": 1
}
```

---

## 3. Estado de Integración Web y Contrato Futuro para `argentinastreamers.com`

En el Master Control del módulo **Historial**, el botón **ACTUALIZAR DATOS DE LA WEB** muestra el aviso:
`⚠️ INTEGRACIÓN PENDIENTE: La conexión en tiempo real con argentinastreamers.com está pendiente de activación backend.`

### Contrato Futuro Esperado (Endpoint Único):
Cuando la integración web esté lista en el servidor backend de GLA / Argentina Streamers, una sola llamada reemplazará los datos en `data.categorias` conservando las claves estables:

```json
{
  "categorias": {
    "iwc": [
      { "fecha": "2026-08-10", "teamA": "argentina-streamers", "teamB": "oxen", "scoreA": "3", "scoreB": "1", "competencia": "IWC" }
    ],
    "amistosos-oficiales": [ ... ],
    "copa-america": [ ... ],
    "amistosos": [ ... ]
  },
  "ultimaActualizacionWeb": "2026-09-02T15:00:00Z"
}
```

---

## 4. Estado de Assets y Tolerancia a Faltantes

Ninguno de los 3 módulos crea assets ficticios en CSS ni realiza HTTP requests a imágenes inexistentes.
- `shared/themes.js` declara para `argentinaStreamers`:
  - `cronogramaHoy`: `{ image: null }` (o status `pending`)
  - `resultadosParciales`: `{ image: null }` (o status `pending`)
  - `historial`: `{ image: null }` (o status `pending`)
- Master Control detecta la ausencia mediante `getModuleAssetStatus(themeId, moduleId)` y muestra el badge discreto `ASSET ARGENTINA STREAMERS: PENDIENTE`.
- Los renderers en Program evalúan `resolveImageSrc(moduleId, null)`. Al recibir `null`, renderizan las capas dinámicas (nombres de equipo, escudos derivados por `teamId`, goles y textos) limpiamente sobre el fondo transparente del lienzo 1920×1080.
- La futura entrega de assets desde `cosas sueltas/` requerirá únicamente ubicar los archivos PNG en `assets/themes/argentina-streamers/brackets/`, registrar su ruta en `shared/themes.js` y probar.

---

## 5. Handoff a Claude / Patch para Archivos Compartidos

Dado que Claude trabaja en paralelo sobre los archivos compartidos del repositorio, a continuación se proporciona la especificación exacta del patch requerido en los archivos bloqueados:

### A. `shared/themes.js`
Agregar las claves en `THEME_ASSET_MODULES` y en los assets del theme `argentinaStreamers`:
```javascript
// En THEME_ASSET_MODULES:
{ key: 'cronogramaHoy', label: 'Cronograma Hoy' },
{ key: 'resultadosParciales', label: 'Resultados Parciales' },
{ key: 'historial', label: 'Historial' },

// En THEMES.argentinaStreamers.assets:
cronogramaHoy: { image: null },
resultadosParciales: { image: null },
historial: { image: null },
```

### B. `shared/modules.js`
Inyectar las definiciones de `cronogramaHoy`, `resultadosParciales` y `historial`.
Importar helpers desde `./historial-helpers.js`.

### C. `master-control/js/main.js`
1. Importar los paneles dedicados:
```javascript
import { renderCronogramaHoyPanel } from './cronograma-hoy-panel.js';
import { renderResultadosParcialesPanel } from './resultados-parciales-panel.js';
import { renderHistorialPanel } from './historial-panel.js';
```
2. En `buildTabs()`, al listar los módulos de la categoría `Brackets` cuando el theme activo es `argentinaStreamers`:
   - Excluir `sideTable`, `posiciones`, `posicionesTorneo`.
   - Incluir `cronogramaHoy`, `resultadosParciales`, `historial`.
3. En `renderPanel()`, despachar el render de cada panel correspondiente cuando `activeId` sea uno de los tres nuevos módulos.

### D. `program/js/main.js`
1. Importar los renderers:
```javascript
import renderCronogramaHoy from './renderers/cronogramaHoy.js';
import renderResultadosParciales from './renderers/resultadosParciales.js';
import renderHistorial from './renderers/historial.js';
```
2. Registrar los tres renderers en la tabla `RENDERERS`.

### E. `program/index.html`
Agregar los nodos de overlay en la sección `Brackets`:
```html
<div id="mod-cronogramaHoy" class="gfx gfx-fullstage is-hidden"><div class="content"></div></div>
<div id="mod-resultadosParciales" class="gfx gfx-fullstage is-hidden"><div class="content"></div></div>
<div id="mod-historial" class="gfx gfx-fullstage is-hidden"><div class="content"></div></div>
```
