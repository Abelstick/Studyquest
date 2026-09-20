/**
 * Único punto donde se decide qué base de datos usa la app.
 * Para añadir otro backend: crea `data/<nombre>/index.ts` que devuelva un `DataLayer`
 * y añade una rama aquí. El resto del código solo importa `dataLayer`.
 */
import type { DataLayer } from './ports';
import { createLocalDataLayer } from './local';
import { createSupabaseDataLayer } from './supabase';

export type { AuthPort, AuthUser, DataLayer, Repository } from './ports';

function build(): DataLayer {
  const env = import.meta.env;
  const provider = (env.VITE_DATA_PROVIDER as string | undefined) ?? 'local';

  if (provider === 'supabase') {
    const url = env.VITE_SUPABASE_URL as string | undefined;
    const key = env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (url && key) return createSupabaseDataLayer(url, key);
    console.warn('[StudyQuest] VITE_DATA_PROVIDER=supabase pero faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Usando modo local.');
  }
  return createLocalDataLayer();
}

export const dataLayer: DataLayer = build();
