-- Ejecutar una sola vez en Supabase > SQL Editor.
-- La clave secreta se usa exclusivamente en el servidor Node/Render.

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  previous_value jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- No se crean policies publicas. La Secret key del backend omite RLS;
-- anon/publishable no pueden leer ni modificar estos datos.

