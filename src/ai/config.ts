import { useUi } from '@/state/ui';
import type { AiConfig } from './gemini';
import { modelName } from './models';
import { useAi } from './store';

const WHY = { quota: 'agotó su cuota', unavailable: 'no está disponible para tu clave', overloaded: 'está saturado' } as const;

/**
 * Configuración lista para llamar a la IA con los ajustes del usuario: su clave, el modelo principal y los de reserva
 * (si activó el cambio automático). Avisa con un mensaje cuando cambia de modelo y anota cuál respondió. Null si no hay clave.
 */
export function aiConfig(signal?: AbortSignal): AiConfig | null {
  const s = useAi.getState();
  if (!s.apiKey) return null;
  return {
    apiKey: s.apiKey,
    model: s.model,
    fallbackModels: s.fallbackEnabled ? s.fallbackModels : [],
    signal,
    onSwitch: ({ from, to, reason }) =>
      useUi.getState().toast({ kind: 'info', title: 'Cambié de modelo', body: `${modelName(from)} ${WHY[reason]}. Sigo con ${modelName(to)}.` }),
    onUsed: (model) => useAi.getState().setLastUsed(model),
  };
}
