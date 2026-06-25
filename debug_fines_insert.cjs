const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim();
  }
});
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

async function debug() {
  const playersRes = await fetch(`${SUPABASE_URL}/rest/v1/players?full_name=ilike.*BACHERO*`, { headers });
  const players = await playersRes.json();
  const bachero = players[0];
  console.log("Bachero:", bachero);

  const finePayload = {
    user_id: bachero.profile_id || bachero.id,
    date: new Date().toISOString().split('T')[0],
    reason: "Test fine",
    amount: 1,
    status: 'Pendiente'
  };

  console.log("Inserting fine...", finePayload);
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/fines`, {
    method: 'POST',
    headers,
    body: JSON.stringify(finePayload)
  });
  
  if (!insertRes.ok) {
     console.error("Error inserting fine:", await insertRes.text());
  } else {
     console.log("Inserted fine successfully:", await insertRes.json());
  }
}
debug();
