# Flujos de trabajo

## Flujo estándar obligatorio

1. Leer `AGENTS.md`.
2. Leer `global-rules.md` y solo los archivos de `.agents` relevantes al rol.
3. Identificar el alcance exacto, comportamiento esperado y superficies potencialmente afectadas.
4. Revisar el estado del workspace y distinguir cambios preexistentes o de otros agentes.
5. Revisar archivos relacionados, consumidores y lógica compartida antes de editar.
6. Registrar mentalmente qué no debe cambiar.
7. Implementar el cambio mínimo necesario.
8. Ejecutar las verificaciones aplicables de `testing-checklist.md`.
9. Revisar errores del navegador, servidor y carga de assets.
10. Actualizar documentación y changelog cuando corresponda.
11. Entregar archivos modificados, pruebas realizadas, resultados y límites de la verificación.

Si aparece un defecto ajeno al pedido, anotarlo para el informe y continuar sin corregirlo.

## Cambio localizado en un módulo

1. Leer su entrada en `shared/modules.js`, renderer, HTML, CSS y ficha de `docs/MODULES.md`.
2. Buscar dependencias con `rg` por ID, clases y ruta de asset.
3. Confirmar si hereda datos de `scoreboard` o usa helpers compartidos.
4. Cambiar solo schema, renderer o CSS que el pedido requiera.
5. Probar TAKE, UPDATE, OUT y segundo TAKE.
6. Verificar que otros módulos simultáneos no cambiaron.

## Cambio de Master Control

1. Determinar si pertenece al schema genérico, al shell del Master o a un panel excepcional.
2. Conservar draft por módulo, autoguardado, estado recibido y navegación.
3. Verificar escritorio y breakpoint menor a 1100px.
4. Comprobar scroll horizontal, scroll independiente, Preview Monitor y STOP ALL.
5. No tocar Program salvo que el pedido lo requiera.

## Cambio de estado, servidor o API

1. Trazar mensaje desde emisor hasta todos los consumidores.
2. Revisar persistencia existente y compatibilidad de `data`.
3. Confirmar que un restart conserva datos pero fuerza `OUT`.
4. Validar múltiples clientes y reconexión si el contrato cambia.
5. No crear un nuevo canal o almacén en paralelo sin decisión explícita.

## Integración o reemplazo de asset

1. Localizar el original y el archivo runtime relacionado.
2. Medir resolución, fps, duración, codec, alfa y bounding box.
3. Determinar si es alfa compuesto o video opaco.
4. Mantener escala nativa salvo instrucción explícita.
5. Actualizar solo las rutas y composición necesarias.
6. Buscar referencias antiguas antes de eliminar cualquier archivo.
7. Verificar visualmente el asset asentado, entrada, salida y transparencia.
8. Documentar procedencia, transformación y evidencia.

## Retiro de módulo o asset

1. Buscar ID, imports, nodos DOM, selectores CSS, rutas y documentación.
2. Distinguir “dejar sin uso” de “eliminar físicamente”; no son equivalentes.
3. Confirmar que registro, renderers y Program siguen alineados.
4. Revisar datos persistidos y compatibilidad.
5. Informar cualquier archivo conservado deliberadamente.

## Solo documentación

1. Contrastar afirmaciones con código actual.
2. Corregir únicamente documentos dentro del alcance.
3. Evitar cambiar ejemplos o conteos no relacionados sin evidencia.
4. Comprobar enlaces relativos, nombres de archivos y ausencia de autoridades duplicadas.
