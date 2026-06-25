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

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function run() {
  console.log("Fetching players...");
  
  const playersRes = await fetch(`${SUPABASE_URL}/rest/v1/players?select=*`, { headers });
  if (!playersRes.ok) {
    console.error('Error fetching players:', await playersRes.text());
    return;
  }
  const players = await playersRes.json();

  const unlinkedPlayers = players.filter(p => !p.profile_id);
  console.log(`Found ${unlinkedPlayers.length} unlinked players.`);

  for (const player of unlinkedPlayers) {
    const dummyId = player.id; 

    const profilePayload = {
      id: dummyId,
      full_name: player.full_name,
      email: `${dummyId}@dummy.local`,
      role_id: 3,
      avatar_url: player.photo_url || null
    };

    console.log(`Creating dummy profile for ${player.full_name}...`);
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers,
      body: JSON.stringify(profilePayload)
    });
    
    if (!profileRes.ok) {
      const errText = await profileRes.text();
      if (errText.includes('23505') || errText.includes('duplicate key')) {
        console.log(`Profile already exists for ${dummyId}, skipping creation.`);
      } else {
        console.error(`Failed to create profile for ${player.full_name}:`, errText);
        continue;
      }
    }

    console.log(`Linking profile to player ${player.full_name}...`);
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${player.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ profile_id: dummyId })
    });
    
    if (!updateRes.ok) {
      console.error(`Failed to link profile for ${player.full_name}:`, await updateRes.text());
    } else {
      console.log(`Successfully linked ${player.full_name}!`);
    }
  }
  
  console.log("Done!");
}

run();
