# Límites arquitectónicos

Este documento describe dónde debe vivir cada cambio. Las reglas obligatorias están en [`global-rules.md`](global-rules.md).

## Flujo principal

```text
Master Control
  └─ TAKE / UPDATE / OUT
       └─ servidor: valida moduleId, actualiza estado y persiste data
            └─ STATE_SNAPSHOT / MODULE_UPDATE
                 ├─ Master Control: estado visible y sincronización
                 └─ Program: renderer, clases IN/OUT y reproducción
```

El servidor es la única autoridad de estado compartido. El draft de cada Master es una capa de edición local, no una segunda autoridad.

## Contratos que deben preservarse

### Registro de módulos

`shared/modules.js` alimenta defaults, campos y navegación del Master. Un módulo de Program también necesita:

1. renderer registrado en `program/js/renderers/index.js`;
2. nodo `mod-<id>` en `program/index.html`;
3. composición y posición en `program/css/overlay.css`;
4. documentación en `docs/MODULES.md`.

Los IDs deben coincidir exactamente en todas esas superficies.

### Estado

- `data`: persistente y editable.
- `status`: visual, `OUT` o `ON`, nunca restaurado en `ON` tras reiniciar.
- `TAKE`: mezcla datos y pasa a `ON`.
- `UPDATE`: mezcla datos sin cambiar status.
- `OUT`: pasa a `OUT` y conserva datos.

No agregar un store paralelo, almacenamiento del navegador o archivo adicional para datos que pertenecen a este contrato sin una decisión arquitectónica explícita.

### Datos compartidos

- Equipos relacionados con el partido se resuelven desde el ID guardado en `scoreboard`.
- Escudo, nombre y abreviatura se derivan del catálogo central.
- Los colores usan `shared/team-colors.js`.
- Los relojes usan la referencia `{ running, accumulatedMs, startedAt }` y helpers de `shared/clock.js`.
- Los módulos dependientes reciben `allData`; no deben duplicar campos del marcador solo para copiar información.

### Ciclo de vida del Program

- `justTaken` distingue un TAKE real de un UPDATE o tick.
- Los videos se reproducen desde cero únicamente cuando corresponde.
- `live` habilita repintado periódico, no mensajes de red por segundo.
- `oneShot` vuelve a `OUT` cuando termina el asset.
- `autoRunClock` inicia el reloj al tomar al aire.
- La salida debe conservar la capacidad de hacer más de un ciclo `TAKE → OUT → TAKE`.

Antes de alterar el desmontaje, revisar propiedades guardadas en nodos (`_alphaVideo`, `_plainVideo`, intervalos y `dataset`) y su limpieza.

### Render visual

El asset es la geometría primaria. El renderer aporta datos y `overlay.css` los ubica en las áreas útiles medidas. El orden real de capas surge del DOM, transforms y CSS; no asumir que el valor `layer` crea un z-index.

## Decisión de ubicación

- Campo, default o flag común: `shared/modules.js`.
- Protocolo o estado transversal: `shared/constants.js` y servidor.
- Operación genérica del Master: `field-editors.js` o `master-control/js/main.js`.
- Control excepcional de un módulo: panel dedicado, solo si el schema genérico no alcanza.
- Presentación de una gráfica: renderer específico + `overlay.css`.
- Composición alfa/opaca: helpers existentes de `alpha-video.js`.
- Ajuste reutilizable de texto: `text-fit.js`.
- Identidad global: `theme.css`; no repetir variables por módulo.

## Cambios transversales

Renombrar IDs, mensajes, rutas, estructuras persistidas o helpers compartidos requiere revisar consumidores, datos existentes, documentación y compatibilidad operativa. No hacerlo como efecto secundario de una tarea local.
