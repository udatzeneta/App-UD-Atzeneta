import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const email = `test2-${Date.now()}@atzeneta.com`;
  const password = 'password123';

  console.log('0. Creating dummy player...');
  const { data: player, error: playerError } = await supabaseAdmin.from('players').insert({
    full_name: 'Test Player',
    nickname: 'Test'
  }).select().single();
  if (playerError) return console.error('Player Error:', playerError);

  console.log('1. Registering user...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Test User', role_id: 3 } }
  });
  if (signUpError) return console.error('SignUp Error:', signUpError);
  console.log('User registered:', signUpData.user.id);

  console.log('2. Linking player...');
  const { data: linkData, error: linkError } = await supabase.rpc('link_player_to_own_profile', { p_player_id: player.id });
  if (linkError) return console.error('Link Error:', linkError);
  console.log('Linked player successfully.');

  console.log('3. Logging out...');
  await supabase.auth.signOut();

  console.log('4. Logging in again...');
  const { error: login2Error } = await supabase.auth.signInWithPassword({ email, password });
  if (login2Error) return console.error('Login2 Error:', login2Error);
  console.log('Login 2 SUCCESS');

  console.log('Cleanup...');
  await supabaseAdmin.from('players').delete().eq('id', player.id);
  await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id);
}

test();
