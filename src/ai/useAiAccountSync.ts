import { useEffect } from 'react';
import { dataLayer } from '@/state';
import { useAi } from './store';
import { refreshFromAccount } from './sync';

/** Al entrar, mira si la cuenta guarda una clave de IA (en claro: se activa sola; cifrada: queda pendiente de la frase). */
export function useAiAccountSync() {
  useEffect(() => {
    const secrets = dataLayer.repo.secrets;
    if (secrets) void refreshFromAccount(secrets, useAi);
  }, []);
}
