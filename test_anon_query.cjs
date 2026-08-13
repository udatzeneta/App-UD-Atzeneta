const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if(idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Iniciando sesión como admin...");
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@atzeneta.com',
    password: 'password123'
  });

  if (authError) {
    console.error("❌ Error de autenticación:", authError.message);
    return;
  }

  console.log("✅ Sesión iniciada. Ejecutando conteo...");
  const teamCategory = 'Primer Equipo';

  const { count, error: countError } = await supabase
    .from('scouting')
    .select('*', { count: 'exact', head: true })
    .eq('team_category', teamCategory);

  if (countError) {
    console.error("❌ Error en conteo:", countError.message);
    return;
  }

  console.log("Total jugadores encontrados en Supabase:", count);

  const pageSize = 1000;
  const pages = Math.ceil(count / pageSize);
  const promises = [];

  for (let i = 0; i < pages; i++) {
    const start = i * pageSize;
    const end = start + pageSize - 1;
    promises.push(
      supabase
        .from('scouting')
        .select('*, scouting_player_history(*)')
        .eq('team_category', teamCategory)
        .order('created_at', { ascending: false })
        .range(start, end)
    );
  }

  const results = await Promise.all(promises);
  const allData = [];
  for (const res of results) {
    if (res.error) {
      console.error("❌ Error en página:", res.error.message);
    } else if (res.data) {
      allData.push(...res.data);
    }
  }

  console.log("✅ Consulta de paginación exitosa. Total jugadores devueltos:", allData.length);
  
  // Contar cuántos jugadores pertenecen a cada temporada
  const seasonCounts = {};
  allData.forEach(p => {
    const s = p.season || 'sin-temporada';
    seasonCounts[s] = (seasonCounts[s] || 0) + 1;
  });
  console.log("Jugadores por temporada devueltos:", seasonCounts);

  // Contar equipos únicos por temporada
  const teamsBySeason = {};
  allData.forEach(p => {
    const s = p.season || 'sin-temporada';
    if (!teamsBySeason[s]) teamsBySeason[s] = new Set();
    if (p.team) teamsBySeason[s].add(p.team);
  });

  for (const s in teamsBySeason) {
    console.log(`Equipos en temporada ${s}:`, teamsBySeason[s].size);
  }
}

run();
