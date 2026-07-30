# Checklist de verificación

Aplicar las secciones afectadas. Un agente no debe marcar una prueba como realizada si solo la infirió.

## Verificación estática

- [ ] Revisar `git diff` o equivalente y confirmar que solo hay archivos esperados.
- [ ] Buscar por ID de módulo, clase, endpoint y ruta modificados.
- [ ] Confirmar que no quedan imports, selectores, nodos o assets huérfanos.
- [ ] Confirmar alineación entre `shared/modules.js`, registro de renderers y `program/index.html`.
- [ ] Ejecutar `node --check` sobre los JavaScript modificados.
- [ ] Verificar rutas y existencia de assets referenciados.
- [ ] Revisar que texto operado use `textContent`, `escapeHtml` o `nl2br`.

No ejecutar `npm test` como evidencia: actualmente no existe una suite configurada.

## Servidor y comunicación

- [ ] El servidor inicia sin errores.
- [ ] `/master`, `/program` y `/api/teams` responden según corresponda.
- [ ] WebSocket entrega `STATE_SNAPSHOT` al conectar.
- [ ] TAKE, UPDATE y OUT producen `MODULE_UPDATE`.
- [ ] Dos clientes reciben el mismo estado compartido.
- [ ] Una reconexión recupera snapshot sin poner gráficos al aire indebidamente.
- [ ] No hay errores en consola del servidor.

## Estado y persistencia

- [ ] UPDATE conserva el status actual.
- [ ] OUT conserva los datos.
- [ ] Reiniciar conserva `data`.
- [ ] Reiniciar fuerza todos los módulos a `OUT`.
- [ ] Los drafts no se mezclan entre pestañas o módulos.
- [ ] Los relojes mantienen el comportamiento solicitado.

## Program 1920×1080

- [ ] Viewport 1920×1080, zoom 100%, fondo transparente.
- [ ] TAKE reproduce la entrada desde el comienzo.
- [ ] UPDATE cambia datos sin reiniciar indebidamente el asset.
- [ ] OUT completa la salida y oculta el módulo.
- [ ] Un segundo TAKE vuelve a montar y reproducir correctamente.
- [ ] Módulos `oneShot` vuelven a OUT al terminar.
- [ ] Módulos `live` actualizan sin reiniciar el video.
- [ ] No hay contenido fuera de cuadro, recortado o sobre bordes internos.
- [ ] Textos y escudos están centrados respecto del área útil real.
- [ ] Capas simultáneas conservan el orden esperado.
- [ ] No hay errores de consola, 404, fallos de reproducción ni canvas.

## Assets

- [ ] Resolución, dimensiones y relación de aspecto verificadas.
- [ ] Transparencia y bounding box inspeccionados.
- [ ] Escala y transform coinciden con lo pedido.
- [ ] El asset runtime corresponde al original correcto.
- [ ] No quedan versiones activas duplicadas.
- [ ] Antes de borrar, búsqueda global sin referencias.

## Master Control

- [ ] Navegación y categoría correctas.
- [ ] Campos muestran y conservan el módulo correcto.
- [ ] Autoguardado y botones explícitos funcionan.
- [ ] Indicadores EN AIRE/FUERA se sincronizan.
- [ ] STOP ALL sigue accesible y funcional.
- [ ] Preview Monitor muestra el Program completo.
- [ ] Sin scroll horizontal.
- [ ] Scroll de columnas y reset del panel conservados.
- [ ] Layout verificado en escritorio y por debajo de 1100px si fue afectado.
- [ ] Sin errores de consola.

## Regresión dirigida

- [ ] Probar el módulo cambiado junto con al menos una capa compatible relevante.
- [ ] Confirmar que módulos vecinos o que comparten helper no cambiaron.
- [ ] Revisar el estado inicial vacío del Program.
- [ ] Verificar nombres, rutas y documentación de módulos eliminados o reemplazados.

## Informe

El cierre debe separar:

- verificado y aprobado;
- verificado con limitaciones;
- no verificado y motivo;
- problemas adicionales encontrados fuera de alcance.
