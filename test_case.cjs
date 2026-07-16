import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const email = `Test3-${Date.now()}@Atzeneta.com`;
  const password = 'password123';

  console.log('1. Registering user with MixedCase email...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: 'Test User', role_id: 3 } }
  });
  if (signUpError) return console.error('SignUp Error:', signUpError);
  console.log('User registered:', signUpData.user.id);

  console.log('2. Logging out...');
  await supabase.auth.signOut();

  console.log('3. Logging in with EXACT SAME MixedCase email...');
  const { error: login2Error } = await supabase.auth.signInWithPassword({ email, password });
  if (login2Error) return console.error('Login2 Error:', login2Error);
  console.log('Login 2 SUCCESS');

  console.log('4. Logging out...');
  await supabase.auth.signOut();

  console.log('5. Logging in with LOWERCASE email...');
  const { error: login3Error } = await supabase.auth.signInWithPassword({ email: email.toLowerCase(), password });
  if (login3Error) return console.error('Login3 Error:', login3Error);
  console.log('Login 3 SUCCESS');

  console.log('Cleanup...');
  await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id);
}

test();
