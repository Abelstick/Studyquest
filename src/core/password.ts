/** Fuerza de una contraseña para el medidor del registro. Solo orienta: la validación real la hace el servidor. */
export interface Strength {
  /** 0 = vacía, 1 = débil … 4 = épica. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS: Record<Strength['score'], string> = { 0: '', 1: 'Débil', 2: 'Aceptable', 3: 'Fuerte', 4: 'Épica' };

export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: LABELS[0] };
  let score: Strength['score'] = 1;
  if (password.length >= 6) {
    const points =
      Number(password.length >= 8) +
      Number(password.length >= 12) +
      Number(/[a-z]/.test(password) && /[A-Z]/.test(password)) +
      Number(/\d/.test(password)) +
      Number(/[^A-Za-z0-9]/.test(password));
    score = points >= 4 ? 4 : points === 3 ? 3 : points === 2 ? 2 : 1;
  }
  return { score, label: LABELS[score] };
}
