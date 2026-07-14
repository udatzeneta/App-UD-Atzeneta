import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.includes('=')).map(l => l.split('='))
);

const url = env.VITE_SUPABASE_URL.trim();
const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY.trim();

const supabase = createClient(url, key);

async function run() {
  console.log("Checking player_match_stats...");
  const { data, error } = await supabase.from('player_match_stats').select('*');
  if (error) {
     console.error("Error:", error);
  } else {
     console.log("Stats count:", data.length);
     if (data.length > 0) {
        console.log("First 3:", data.slice(0, 3));
     }
  }
}

run();
