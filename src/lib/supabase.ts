// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Use a SERVICE_KEY para operações de escrita (uploads)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Para operações de leitura pública, pode usar a ANON_KEY
export const supabasePublic = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);