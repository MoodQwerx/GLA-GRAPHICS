# Sistema de trabajo para agentes

Esta carpeta contiene instrucciones permanentes y específicas de SOFTX (antes GLA Broadcast Graphics System). `AGENTS.md` es el punto de entrada; `global-rules.md` es la fuente normativa principal. Los demás documentos agregan contexto o procedimientos sin redefinir las reglas.

## Qué leer según la tarea

| Tarea | Lectura mínima adicional |
|---|---|
| Decisión transversal, módulo nuevo o cambio de contrato | `architecture.md`, `workflows.md`, `roles/architect.md` |
| Master Control | `project-context.md`, `roles/frontend-master-control.md`, `testing-checklist.md` |
| Servidor, estado, persistencia, API o WebSocket | `architecture.md`, `roles/backend-state-api.md`, `testing-checklist.md` |
| Program, composición o estilos de una gráfica | `architecture.md`, `roles/broadcast-graphics.md`, `testing-checklist.md` |
| Alta, reemplazo o retiro de assets | `roles/assets-manager.md`, `workflows.md`, `testing-checklist.md` |
| Revisión final | `roles/qa-reviewer.md`, `testing-checklist.md` |
| Documentación | `roles/documentation.md`, `changelog-policy.md` |

Si una tarea combina áreas, se leen los roles correspondientes. No es necesario cargar todos los documentos para un cambio localizado.

## División de responsabilidades

- `project-context.md`: hechos estables y mapa del repositorio.
- `architecture.md`: límites, contratos y fuentes de verdad.
- `global-rules.md`: obligaciones y prohibiciones.
- `workflows.md`: secuencia para ejecutar cambios.
- `testing-checklist.md`: evidencia mínima por superficie afectada.
- `changelog-policy.md`: qué y cómo registrar.
- `roles/*.md`: foco y criterios de revisión de cada especialidad.

## Resolución de contradicciones

No se duplican reglas completas entre archivos. Si un rol resume una regla, la definición vinculante sigue siendo `global-rules.md`. Si la documentación funcional contradice el código, verificar el historial y usar la implementación vigente como base; luego corregir la documentación dentro del alcance autorizado.
