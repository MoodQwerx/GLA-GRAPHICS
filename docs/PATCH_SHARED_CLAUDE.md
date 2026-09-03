# PATCH EXACTO PARA ARCHIVOS COMPARTIDOS — ENTREGA A CLAUDE

Este documento contiene el **patch exacto** y las instrucciones necesarias para sincronizar los módulos de **ZÓCALO COMPUESTO CON EQUIPOS** y **ZÓCALO COMPUESTO CON LOGO** de Argentina Streamers y la ocultación de **BRACKETS** y **GRUPOS** en el theme Argentina Streamers.

---

## Estado Actual de Módulos para Argentina Streamers

### 1. BRACKETS & GRUPOS (Ocultos de la Navegación en Argentina Streamers)
- `cronogramaHoy`, `resultadosParciales`, `historial` y `grupos` están **OCULTOS** de la barra de navegación cuando el theme activo es `argentinaStreamers`.
- GLA conserva sus módulos originales (`sideTable`, `posiciones`, `posicionesTorneo`, `grupos`) 100% intactos en su navegación.
- Los helpers (`shared/historial-helpers.js`) y especificaciones avanzadas se conservan guardados en el proyecto para cuando lleguen los assets PNG definitivos.

### 2. DOS ZÓCALOS COMPUESTOS INDEPENDIENTES
- **`zocaloCompuestoEquipos`**:
  - Asset: `/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-equipos-alpha.mp4` (`ZOCALO_LARGO_LINEA`).
  - Escudos: `teamA` y `teamB` en vivo de Marcador.
  - MAIN TEXT = `#FFFFFF` (BLANCO PURO REAL).
- **`zocaloCompuestoLogo`**:
  - Asset: `/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-logo-alpha.mp4` (`ZOCALO_LARGO`).
  - Logo: `/assets/themes/argentina-streamers/zocalos/logo-localstrike.png` (movido desde `cosas sueltas/`).
  - MAIN TEXT = `#FFFFFF` (BLANCO PURO REAL).

---

## Archivos Compartidos Modificados

### 1. `master-control/js/main.js`

**Filtro por Theme en `buildTabs()`:**
```javascript
  const ARGENTINA_STREAMERS_HIDDEN_MODULES = new Set([
    'sideTable', 'posiciones', 'posicionesTorneo',
    'cronogramaHoy', 'resultadosParciales', 'historial', 'grupos', 'zocaloCompuesto',
  ]);
  const GLA_HIDDEN_MODULES = new Set(['cronogramaHoy', 'resultadosParciales', 'historial', 'fichaJugador']);
```

**Dispatch en `renderPanel()`:**
```javascript
  } else if (activeId === 'zocaloCompuestoEquipos') {
    panelCleanup = renderZocaloCompuestoEquiposPanel(extraContainer, draft[activeId], draft.scoreboard, () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  } else if (activeId === 'zocaloCompuestoLogo') {
    panelCleanup = renderZocaloCompuestoLogoPanel(extraContainer, draft[activeId], () => {
      scheduleAutoSave(idForThisRender);
    }, buildSaveOptions(activeId));
  }
```

---

### 2. `program/css/theme.css`

**Regla de Texto Principal Blanco Puro `#FFFFFF`:**
```css
body[data-theme='argentinaStreamers'] .ov-zfd-texto1,
body[data-theme='argentinaStreamers'] .ov-zf-texto1 {
  color: #ffffff !important;
}
```

---

### 3. `shared/themes.js`

```javascript
      zocaloCompuestoEquipos: { video: '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-equipos-alpha.mp4' },
      zocaloCompuestoLogo: {
        video: '/assets/themes/argentina-streamers/zocalos/zocalo-compuesto-logo-alpha.mp4',
        image: '/assets/themes/argentina-streamers/zocalos/logo-localstrike.png'
      },
```

---

### 4. `shared/modules.js`

```javascript
  zocaloCompuestoEquipos: {
    id: 'zocaloCompuestoEquipos',
    label: 'Zócalo Compuesto con Equipos',
    category: 'Zocalos',
    layer: 'bottom-left',
    live: true,
    sequencedReveal: true,
    fields: [],
    defaults: {
      texto1: '', texto2: '', sponsor: '',
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
      texto1: '', texto2: '', sponsor: '',
      logoOffsetX: 0, logoOffsetY: 0, logoScale: 1,
      textAdjust: textAdjustDefaults('texto1', 'texto2'),
    },
  },
```

---

### 5. `program/index.html`

```html
  <div id="mod-zocaloCompuestoEquipos" class="gfx gfx-fullstage is-hidden"><div class="content"></div></div>
  <div id="mod-zocaloCompuestoLogo" class="gfx gfx-fullstage is-hidden"><div class="content"></div></div>
```
