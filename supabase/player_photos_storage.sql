-- =====================================================================
-- Bucket de almacenamiento para fotos de perfil de jugadores
-- Ejecutar en el SQL Editor de Supabase (o crear el bucket manualmente
-- desde Storage > New bucket con el nombre "player-photos", público).
-- =====================================================================

-- 1. Crear el bucket público (si no existe)
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

-- 2. Política: cualquiera puede LEER las fotos (bucket público de avatares)
create policy "Lectura pública de fotos de jugadores"
on storage.objects for select
using ( bucket_id = 'player-photos' );

-- NOTA: Esta app no usa el sistema de Auth nativo de Supabase (el login es
-- propio, contra la tabla `users`), así que todas las peticiones desde el
-- navegador llegan a Postgres con el rol "anon" (igual que el resto de
-- tablas del proyecto, que tampoco tienen RLS activado). Por eso aquí se
-- permite subir/actualizar/borrar también al rol "anon", igual que ocurre
-- ya con el resto de la base de datos.

-- 3. Política: se puede SUBIR fotos (control de permisos vía la app, no vía RLS)
create policy "Subir fotos de jugadores"
on storage.objects for insert
to anon, authenticated
with check ( bucket_id = 'player-photos' );

-- 4. Política: se puede ACTUALIZAR/REEMPLAZAR fotos
create policy "Actualizar fotos de jugadores"
on storage.objects for update
to anon, authenticated
using ( bucket_id = 'player-photos' );

-- 5. Política: se puede BORRAR fotos
create policy "Borrar fotos de jugadores"
on storage.objects for delete
to anon, authenticated
using ( bucket_id = 'player-photos' );
