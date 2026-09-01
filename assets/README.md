# assets/

Este directorio mezcla dos convenciones a propósito, no por descuido — ver la
razón de cada una abajo.

## `crests/`, `eventos/`, `fonts/`, `grupos/`, `images/`, `marcador/`, `mosca/`,
## `placas/`, `replay/`, `tablas/`, `var/`, `zocalos/`

Assets de **GRAN LIGA RELÁMPAGO** (GLA), el theme por defecto. Viven en rutas
planas (`/assets/marcador/...`, no `/assets/themes/gran-liga-relampago/...`)
**a propósito**: son las mismas ~30 rutas que ya están hardcodeadas como
fallback en cada renderer de `program/js/renderers/*.js` — es justamente lo
que garantiza que GLA nunca dependa del manifest multi-theme
(`shared/themes.js`) ni pueda romperse por un error ahí. Migrarlas a una
carpeta `themes/gran-liga-relampago/` requeriría reescribir esas ~30 rutas en
código sin ningún beneficio funcional, así que se decidió explícitamente NO
hacerlo (2026-08-25, limpieza de estructura — ver CHANGELOG.md).

## `shared/`

Recursos genuinamente compartidos entre **todos** los themes, sin branding
específico de ninguno. Hoy: `sponsors/` (logos de anunciantes — el mismo
sponsor puede rotar en el Marcador de cualquier theme, no pertenece a la
identidad visual de GLA ni de Argentina Streamers).

## `themes/<themeId>/`

Assets propios de un theme **no-GLA**, organizados por función
(`marcador/`, `incidencias/`, `zocalos/`, `escudos/`, etc. — ver
`shared/themes.js` → `THEME_ASSET_MODULES` para el mapeo completo a
módulos). Hoy: `argentina-streamers/`, con la estructura de carpetas ya
creada y vacía (`.gitkeep`), lista para recibir los archivos del diseñador.
Ver [docs/THEMES.md](../docs/THEMES.md) para el flujo completo de cómo
cargar un asset real ahí.

Si se agrega un tercer theme (`copaX`, `torneoY`, ...), su carpeta va acá
también — nunca mezclada con las de GLA ni con `shared/`.
