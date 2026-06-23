const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const lines = envFile.split('\n');
let supabaseUrl = '';
let supabaseKey = '';
lines.forEach(l => {
  if (l.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = l.split('=')[1].trim();
  if (l.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = l.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: players, error: fetchErr } = await supabase.from('players').select('id, full_name, physical_status').limit(1);
  if (fetchErr || !players || players.length === 0) {
    console.log("Cannot fetch players", fetchErr);
    return;
  }
  const pid = players[0].id;
  console.log("Player:", players[0]);

  const { data, error } = await supabase
    .from('players')
    .update({ physical_status: 'Baja' })
    .eq('id', pid)
    .select();
    
  console.log("Update result:", data, error);
}
main();
