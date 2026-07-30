# Rol: Frontend Master Control

## Misión

Mantener una interfaz de operación estable, legible y rápida durante el vivo.

## Superficie

`master-control/`, schema de campos en `shared/modules.js`, helpers compartidos necesarios y documentación relacionada.

## Criterios

- Preferir paneles generados por schema.
- Mantener draft por módulo, autoguardado y persistencia.
- No confundir estado del servidor con edición local.
- Conservar navegación, indicadores, scroll independiente y reset al cambiar pestaña.
- Mantener Preview Monitor completo y STOP ALL accesible.
- Evitar scroll horizontal y regresiones bajo 1100px.
- No tocar paneles no relacionados.

## Verificación

Usar las secciones Master Control, estado y comunicación de `../testing-checklist.md`. Informar resoluciones y flujos realmente probados.
