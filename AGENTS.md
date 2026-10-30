# Instrucciones para agentes

Este archivo es el punto de entrada común para cualquier agente que trabaje en SOFTX (antes GLA Broadcast Graphics System / LIVE GRAPHICS): Codex, Claude Code, Gemini CLI u otras herramientas equivalentes. Aplica a todo el repositorio.

## Autoridad y lectura obligatoria

Las instrucciones se interpretan en este orden:

1. Pedido explícito del usuario y restricciones de la sesión.
2. Este `AGENTS.md`.
3. [`.agents/global-rules.md`](.agents/global-rules.md), fuente normativa principal del proyecto.
4. El workflow y el rol aplicables dentro de `.agents/`.
5. La documentación funcional existente (`README.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `CHANGELOG.md`).

Antes de modificar:

1. Leer este archivo.
2. Leer `.agents/global-rules.md`.
3. Leer únicamente el contexto, workflow y rol que correspondan a la tarea; el mapa está en [`.agents/README.md`](.agents/README.md).
4. Inspeccionar la implementación real relacionada. La documentación orienta, pero el código vigente decide cuando hay divergencias.
5. Definir el alcance exacto y los archivos que razonablemente deberían cambiar.

## Regla de alcance no negociable

Los agentes no deben mejorar, limpiar, modernizar o refactorizar partes del proyecto que no hayan sido solicitadas. Si detectan un problema adicional, deben informarlo por separado y no modificarlo sin autorización.

No aprovechar una tarea localizada para cambiar otros módulos, reorganizar carpetas, renombrar IDs, reemplazar helpers, ajustar assets o alterar estilos globales.

## Inbox de assets del operador

`cosas sueltas/` es la carpeta de entrada donde el operador deja assets nuevos pendientes de integrar. Revisar únicamente esa carpeta para nuevas entregas; no usarla como ruta runtime definitiva. Cada archivo identificado y utilizado debe moverse a su ubicación estable en `assets/` o `ai-gfx/`, actualizar sus referencias y verificarse. Los archivos todavía no identificados o no utilizados se conservan en la inbox.

## Mapa rápido

- Contexto real del repositorio: [`.agents/project-context.md`](.agents/project-context.md)
- Invariantes y límites arquitectónicos: [`.agents/architecture.md`](.agents/architecture.md)
- Reglas normativas: [`.agents/global-rules.md`](.agents/global-rules.md)
- Flujo de trabajo: [`.agents/workflows.md`](.agents/workflows.md)
- Verificación: [`.agents/testing-checklist.md`](.agents/testing-checklist.md)
- Política de changelog: [`.agents/changelog-policy.md`](.agents/changelog-policy.md)
- Responsabilidades especializadas: [`.agents/roles/`](.agents/roles/)

## Cierre obligatorio

Toda entrega debe indicar:

- archivos modificados;
- comportamiento cambiado y comportamiento preservado;
- verificaciones ejecutadas y su resultado;
- verificaciones no realizadas y el motivo;
- riesgos o problemas adicionales detectados, sin afirmar que fueron corregidos si quedaron fuera de alcance.

No afirmar que una tarea está terminada sin evidencia proporcional al cambio.

## Compatibilidad entre herramientas

Estas instrucciones son Markdown neutral y no dependen de comandos propios de un agente. Los archivos específicos de una herramienta, como `CLAUDE.md`, son adaptadores complementarios: nunca reemplazan ni contradicen este archivo o `.agents/global-rules.md`.
