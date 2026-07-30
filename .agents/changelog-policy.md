# Política de changelog

`CHANGELOG.md` registra cambios materiales del proyecto y la evidencia utilizada. No debe convertirse en una lista de intenciones.

## Cuándo actualizar

Actualizarlo cuando el cambio:

- modifica comportamiento operativo, visual, estado, API o persistencia;
- agrega, reemplaza, retira o recoloca un asset o módulo;
- corrige una regresión;
- cambia instrucciones permanentes o workflows de desarrollo;
- altera documentación de forma que modifica el contrato mantenido.

Una corrección tipográfica aislada puede omitirse si no cambia significado.

## Formato vigente

Mantener el patrón actual:

```md
## [Unreleased] - AAAA-MM-DD (N)

### Agregado|Cambiado|Corregido|Reemplazado|Eliminado — Resumen

Descripción del alcance, archivos y decisiones.

### Verificado

- Evidencia realmente obtenida.
```

Usar el siguiente número disponible y la fecha local de trabajo. No reescribir entradas históricas salvo que el usuario pida corregirlas.

## Contenido obligatorio

- Qué cambió y por qué.
- Qué archivos o superficies se tocaron.
- Qué se preservó cuando sea relevante.
- Migraciones, compatibilidad o archivos conservados.
- Pruebas realizadas con resultados concretos.
- Limitaciones de verificación.

No afirmar “sin errores”, “idéntico” o “verificado” sin evidencia. No documentar como implementado algo pendiente.

## Coordinación con otros documentos

- `README.md`: uso y puesta en marcha para operadores.
- `docs/ARCHITECTURE.md`: contratos y diseño técnico vigente.
- `docs/MODULES.md`: ficha por gráfica y geometría relevante.
- `AGENTS.md` y `.agents/`: reglas de trabajo para agentes.
- `CHANGELOG.md`: historia y evidencia del cambio.

Cada dato debe vivir en su documento natural; enlazar en vez de copiar bloques extensos.
