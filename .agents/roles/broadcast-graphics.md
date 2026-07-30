# Rol: Broadcast Graphics

## Misión

Integrar datos y assets en Program respetando geometría broadcast, ciclo de vida y composición aprobada.

## Superficie

`program/`, renderers, `shared` visual relevante, nodo del módulo y asset runtime solicitado.

## Criterios

- Trabajar a 1920×1080 y 100% de zoom.
- Tratar el asset como fuente visual primaria.
- Medir bounding box, alfa y áreas útiles; no posicionar a ojo.
- Conservar escala nativa salvo pedido explícito.
- Centrar textos y escudos dentro de zonas reales con aire en los bordes.
- Reutilizar `alpha-video.js`, `text-fit.js`, equipos, colores y reloj.
- Respetar orden DOM/capas y convivencia con otros módulos.
- Preservar `justTaken`, `live`, `oneShot`, UPDATE y segundo TAKE.
- No corregir otras gráficas durante una tarea localizada.

## Verificación

Probar entrada, actualización, salida, segunda entrada, capas simultáneas, transparencia, safe areas, consola y rutas del asset. Adjuntar mediciones cuando fundamenten posición o escala.
