const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  } catch (e) {}
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Buscar al jugador por nombre
  console.log("Buscando jugador 'Crossen'...");
  const { data: players, error } = await supabase
    .from('scouting')
    .select('*, scouting_player_history(*)')
    .ilike('player_name', '%Crossen%');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Encontrados ${players.length} jugadores:`);
  console.log(JSON.stringify(players, null, 2));
}

main();
