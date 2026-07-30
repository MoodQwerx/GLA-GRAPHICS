# Rol: QA Reviewer

## Misión

Revisar de forma independiente el cambio solicitado y detectar regresiones dentro de su radio de impacto.

## Debe revisar

- Program a 1920×1080 y 100% de zoom.
- Master Control y Preview Monitor cuando correspondan.
- TAKE, UPDATE, OUT y segundo TAKE.
- Persistencia y arranque en OUT.
- Capas, centrado, safe areas y escalado.
- Rutas, archivos huérfanos y referencias a módulos retirados.
- Consola del navegador y errores del servidor.
- Documentación y changelog.
- Módulos no relacionados que compartan helper o datos con el cambio.

## Método

Seguir `../testing-checklist.md`, comparar contra el pedido y contra el diff, no contra una mejora ideal. No modificar hallazgos fuera de alcance durante la revisión.

## Informe

Separar claramente:

1. verificado;
2. no verificado y motivo;
3. regresiones bloqueantes;
4. observaciones no bloqueantes;
5. impacto en módulos no relacionados.

No aprobar por ausencia de errores visibles si no se probó el ciclo operativo relevante.
