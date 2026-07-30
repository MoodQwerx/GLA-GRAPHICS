# Reglas globales

Este archivo es la fuente normativa principal para los agentes del proyecto.

## Alcance y disciplina

- Revisar la implementación existente antes de modificar.
- Implementar el cambio mínimo que satisface el pedido.
- Reutilizar lógica compartida y patrones ya aprobados.
- No duplicar estado, catálogos, helpers, campos ni fuentes de datos.
- No crear una solución aislada cuando el proyecto ya tiene un mecanismo equivalente.
- No hacer refactors generales salvo pedido explícito.
- No cambiar archivos o módulos no relacionados.
- No cambiar IDs, endpoints, mensajes WebSocket ni estructuras persistidas sin necesidad demostrable.
- Preservar compatibilidad con OBS, vMix y Browser Source.

**Regla fuerte:** los agentes no deben mejorar, limpiar, modernizar o refactorizar partes del proyecto que no hayan sido solicitadas. Si detectan un problema adicional, deben informarlo por separado y no modificarlo sin autorización.

## Trabajo concurrente entre agentes

- Asumir que el workspace puede ser compartido y contener cambios todavía no entregados.
- Inspeccionar el estado de los archivos antes de editar y volver a revisarlo antes de cerrar.
- No revertir, formatear, mover ni “normalizar” cambios cuyo autor o propósito no se conoce.
- Dividir trabajo paralelo por archivos o superficies no superpuestas siempre que sea posible.
- Si dos agentes necesitan editar el mismo bloque o contrato, coordinar el orden y el responsable de la integración antes de continuar.
- No borrar artefactos, notas o archivos temporales de otro agente sin confirmar que son descartables.
- En el handoff, declarar los archivos tocados, supuestos, pruebas y trabajo pendiente para que el siguiente agente no repita ni pise cambios.

## Assets

- No reescalar, recortar, recolocar, retranscodificar ni rediseñar assets salvo pedido explícito.
- Si un PNG ya está preparado en 1920×1080, usarlo a escala nativa.
- No recrear en CSS una pieza que corresponde al asset gráfico original.
- No usar directamente un MOV profesional en el navegador; respetar el pipeline existente de alfa.
- Verificar dimensiones, duración, transparencia, bounding box y codec antes de decidir una integración.
- No asumir que un problema visual es solo de posición: inspeccionar primero alfa y área útil.
- Respetar el orden de capas del renderer y del DOM.
- Eliminar o reemplazar assets anteriores solo después de comprobar que no quedan referencias activas en código, CSS, HTML ni documentación.
- No borrar originales de `ai-gfx/` salvo pedido explícito.
- No introducir dependencias de CDN para recursos críticos en vivo.

## Diseño broadcast

- Verificar Program a 1920×1080 y 100% de zoom.
- Mantener todos los elementos dentro del cuadro y de la safe area aplicable.
- Medir sobre el asset; no posicionar “a ojo” cuando se pueda obtener bounding box o coordenadas reales.
- Centrar respecto del área útil del asset, no necesariamente respecto de toda la pantalla.
- Mantener simetría geométrica real.
- Aprovechar recuadros internos sin pegar texto, escudos o resultados a sus bordes.
- Mantener coherencia con los módulos ya aprobados, especialmente tipografía, jerarquía, espacios y presencia de escudos.
- No aplicar transforms globales para corregir un único módulo.
- No alterar escalas o posiciones de módulos no involucrados.
- Usar Anton local en Program y los helpers existentes para texto variable.

## Master Control

- Mantener una operación clara, predecible y estable durante un vivo.
- No mezclar drafts ni estados entre módulos.
- Preservar autoguardado y persistencia de controles.
- Mantener STOP ALL accesible en la columna vigente salvo rediseño explícito.
- Preservar Preview Monitor como instancia real del Program.
- Evitar scroll horizontal y conservar navegación, scroll independiente y breakpoint existente.
- Preferir campos generados desde schema; crear un panel especial solo para una interacción que no pueda expresarse allí.
- No modificar paneles, categorías o estilos no relacionados con la tarea.

## Estado y backend

- Preservar la separación entre `data` persistente y `status` visual.
- Nunca restaurar un gráfico en `ON` después de reiniciar salvo requerimiento explícito.
- No introducir una segunda fuente de persistencia incompatible.
- Mantener valores por defecto seguros y compatibilidad con datos ya guardados.
- Validar en el límite adecuado sin cambiar silenciosamente contratos existentes.
- No romper WebSocket ni sustituirlo por SSE u otro transporte: el mecanismo real del proyecto es WebSocket.
- Mantener el catálogo de equipos derivado de `assets/crests/`.
- Evitar ticks de reloj por red; usar el modelo temporal compartido.

## Código y seguridad

- Mantener módulos ES nativos y ausencia de build step.
- No agregar dependencias sin justificar y obtener autorización cuando cambien la arquitectura operativa.
- Escapar texto antes de usar `innerHTML`; preferir `textContent`.
- No ocultar errores relevantes ni declarar éxito si hubo errores de consola, servidor o assets.
- Preservar cambios preexistentes del usuario y no sobrescribir trabajo ajeno.

## Documentación

- Mantener coherentes `README.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `CHANGELOG.md`, `AGENTS.md` y `.agents/` según la superficie cambiada.
- No copiar reglas completas a varios archivos; enlazar a esta fuente.
- Describir el comportamiento implementado, no el comportamiento supuesto.
- Registrar qué se verificó realmente y qué quedó sin verificar.
