import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kkliwdphrdbguclsvxcw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OMXANLsZK98fPWygp8ZHfA_xzSpWgYb';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Retorna o usuário logado ou null
export async function getUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

// Salva dados extras do usuário no Supabase (tabela 'usuarios')
export async function salvarPerfil(user, extra = {}) {
  await supabase.from('usuarios').upsert({
    id: user.id,
    email: user.email,
    nome: user.user_metadata?.full_name || extra.nome || '',
    avatar: user.user_metadata?.avatar_url || '',
    ...extra
  });
}
