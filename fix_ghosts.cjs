
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixGhosts() {
  console.log("Buscando sustituciones fantasma en player_match_stats...");
  
  // Encontramos todos los stats que tienen un cambio asignado pero 0 minutos jugados
  // Esto indica que provienen de un acta borrada (que limpió los minutos pero no el cambio)
  const { data: stats, error: statsError } = await supabase
    .from('player_match_stats')
    .select('*')
    .eq('minutes_played', 0)
    .not('substituted_for', 'is', null);

  if (statsError) {
    console.error("Error al buscar:", statsError);
    return;
  }

  console.log(`Encontrados ${stats.length} registros fantasma.`);

  if (stats.length > 0) {
    for (const stat of stats) {
      console.log(`Limpiando registro ID ${stat.id} (Jugador: ${stat.player_id})`);
      await supabase
        .from('player_match_stats')
        .update({ substituted_for: null, substituted_minute: null })
        .eq('id', stat.id);
    }
    console.log("Sustituciones fantasma limpiadas con éxito.");
  } else {
    console.log("No se encontraron registros fantasma que limpiar.");
  }
}

fixGhosts();
