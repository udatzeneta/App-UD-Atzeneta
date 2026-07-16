import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const email = `test-${Date.now()}@atzeneta.com`;
  const password = 'password123';

  console.log('1. Registering user...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Test User', role_id: 3 } }
  });
  if (signUpError) return console.error('SignUp Error:', signUpError);
  console.log('User registered:', signUpData.user.id);

  console.log('2. Logging in immediately...');
  const { error: login1Error } = await supabase.auth.signInWithPassword({ email, password });
  if (login1Error) return console.error('Login1 Error:', login1Error);
  console.log('Login 1 SUCCESS');

  console.log('3. Logging out...');
  await supabase.auth.signOut();

  console.log('4. Logging in again...');
  const { error: login2Error } = await supabase.auth.signInWithPassword({ email, password });
  if (login2Error) return console.error('Login2 Error:', login2Error);
  console.log('Login 2 SUCCESS');
}

test();
