# Persistencia de datos del operador

## Diseño

El servidor mantiene una sola autoridad en memoria y persiste cuatro claves extensibles:

| Clave cloud | Fallback local | Contenido |
|---|---|---|
| `master_control_state` | `data/master-control-state.json` | `data` completo de todos los modulos: presets, posiciones, escalas, formaciones, colores, snapshots web y cualquier campo futuro |
| `team_abbreviations` | `data/team-abbreviations.json` | abreviaturas personalizadas por equipo |
| `gla_futbol_rosters` | `data/gla-futbol-rosters.json` | ultimo plantel web valido por equipo |
| `gla_lower_third_context` | `data/gla-lower-third-context.json` | ultimo contexto estadistico valido del Generador de Zocalos, separado por Liga/Torneo |

`status` visual no se persiste: tras cada arranque todos los modulos quedan en `OUT` por seguridad.

Las escrituras se agrupan durante 500 ms, se serializan y no bloquean el event loop. Cada JSON se reemplaza atomicamente, conserva una copia anterior en `data/backups/<nombre>.previous.json` y hasta cinco snapshots espaciados al menos diez minutos. En Supabase, cada fila conserva `value` y `previous_value`; cada nueva escritura desplaza el ultimo valor cloud a `previous_value`.

## Backend elegido: Supabase

Se usa la Data REST API nativa desde Node, sin SDK ni dependencia adicional. El plan gratuito vigente ofrece 500 MB de base, muy por encima del estado JSON de GLA. Render Postgres gratuito expira a los 30 dias, por lo que no sirve como persistencia definitiva. Neon tambien es viable, pero requeriria agregar y mantener un driver PostgreSQL; Supabase REST reduce piezas operativas.

Referencias: [Supabase Free](https://supabase.com/pricing), [Supabase Data REST API](https://supabase.com/docs/guides/api), [Render Postgres gratuito](https://render.com/docs/postgresql-refresh), [filesystem efimero de Render](https://render.com/docs/disks), [Neon Free](https://neon.com/pricing).

## Configuracion inicial

1. Crear un proyecto gratuito en Supabase.
2. Ejecutar una sola vez [`supabase-app-state.sql`](supabase-app-state.sql) en **SQL Editor**.
3. En la PC que contiene los JSON actuales, definir temporalmente:

   ```powershell
   $env:GLA_PERSISTENCE_BACKEND = 'supabase'
   $env:SUPABASE_URL = 'https://PROJECT_REF.supabase.co'
   $env:SUPABASE_SECRET_KEY = 'valor-secreto'
   npm start
   ```

4. Confirmar en el log `Cloud vacio: ... inicializo la clave ...` para las cuatro claves y detener el servidor. Esto migra los JSON existentes una sola vez. Si cloud ya tiene una fila, cloud gana y nunca es pisado por defaults locales.
5. Quitar las variables de la terminal si no se desea usar cloud localmente.

No pegar ni versionar la clave secreta. Las Secret keys actuales reemplazan gradualmente a las antiguas `service_role`; el servidor tambien acepta `SUPABASE_SERVICE_ROLE_KEY` solo por compatibilidad.

## Variables exactas en Render

Obligatorias:

```text
GLA_PERSISTENCE_BACKEND=supabase
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=<Secret key del proyecto>
```

Opcionales:

```text
GLA_PERSIST_DEBOUNCE_MS=500
GLA_PERSIST_TIMEOUT_MS=5000
```

`PORT` no se configura manualmente: Render lo inyecta y el servidor conserva `0.0.0.0`.

## Fallas y recuperacion

- Si cloud falla al arrancar, se carga el ultimo JSON local util o los defaults solo cuando no existe ningun snapshot.
- Si cloud falla durante una transmision, la edicion queda inmediatamente en memoria y se intenta escribir el fallback local. El servidor no se detiene ni reemplaza datos por defaults.
- El error queda en consola y en `GET /api/persistence/status`, que responde HTTP 503 mientras el backend esta degradado. No expone URL ni credenciales.
- Una escritura posterior vuelve a intentar cloud. Para recuperar corrupcion se puede copiar `previous_value` sobre `value` en Supabase, o un archivo `data/backups/*.previous.json`/snapshot timestamped sobre su JSON local con el servidor detenido.

El filesystem local de Render sigue siendo efimero; alli los JSON solo son cache durante la vida del contenedor. La supervivencia entre deploys depende de que Supabase este configurado.
