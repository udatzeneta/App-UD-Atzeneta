-- Enlaces públicos de las presentaciones del Análisis Rival.
--
-- El token ES la credencial: quien lo tiene ve ESA presentación y nada más.
-- Ojo con el modelo de seguridad: aquí NO hay ninguna política pública. La
-- tabla la lee únicamente el endpoint /api/shared-presentation con la
-- service_role key (que salta RLS) y que solo devuelve la presentación
-- asociada al token. Así el enlace es "vivo" (siempre refleja los últimos
-- cambios) sin abrir lectura anónima sobre opponent_analysis, scouting, etc.
--
-- analysis_id se guarda como text (sin FK) para no depender del tipo de
-- opponent_analysis.id; al revocar o borrar se gestiona desde la app.

create table if not exists public.presentation_shares (
  token           text primary key,
  analysis_id     text not null,
  presentation_id text not null,
  title           text,
  opponent        text,
  revoked         boolean not null default false,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  last_viewed_at  timestamptz,
  view_count      integer not null default 0
);

create index if not exists presentation_shares_analysis_idx
  on public.presentation_shares (analysis_id, presentation_id);

alter table public.presentation_shares enable row level security;

-- El cuerpo técnico autenticado gestiona los enlaces desde la app (anon key).
drop policy if exists presentation_shares_select on public.presentation_shares;
create policy presentation_shares_select on public.presentation_shares
  for select to authenticated using (true);

drop policy if exists presentation_shares_insert on public.presentation_shares;
create policy presentation_shares_insert on public.presentation_shares
  for insert to authenticated with check (true);

drop policy if exists presentation_shares_update on public.presentation_shares;
create policy presentation_shares_update on public.presentation_shares
  for update to authenticated using (true) with check (true);

drop policy if exists presentation_shares_delete on public.presentation_shares;
create policy presentation_shares_delete on public.presentation_shares
  for delete to authenticated using (true);
