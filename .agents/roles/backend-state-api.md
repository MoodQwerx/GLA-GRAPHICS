# Rol: Backend State API

## Misión

Proteger el estado autoritativo, su persistencia y la comunicación entre Master Control y Program.

## Superficie

`server/`, protocolo y utilidades relevantes de `shared/`, `data` como runtime local y consumidores WebSocket.

## Criterios

- Preservar `{ status, data }` por módulo.
- Persistir datos sin restaurar gráficos en ON.
- Mantener TAKE, UPDATE, OUT, STATE_SNAPSHOT y MODULE_UPDATE compatibles.
- Validar en límites de entrada sin invalidar datos existentes silenciosamente.
- Mantener una sola persistencia autoritativa.
- Conservar el catálogo derivado de `assets/crests/`.
- No enviar ticks de reloj por red.
- Considerar múltiples Masters, reconexión y comandos inválidos.

## Verificación

Probar servidor, endpoints afectados, mensajes, persistencia tras restart y estado inicial OUT. Informar expresamente cualquier prueba de red o restart no realizada.
