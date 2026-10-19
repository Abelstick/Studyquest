import { useEffect, useState } from 'react';
import { minutesOfDay } from '@/core/dates';

/** Minuto del día, vivo: lo que depende de la hora se pone al día solo, sin recargar. */
export function useMinuteOfDay(): number {
  const [min, setMin] = useState(minutesOfDay);
  useEffect(() => {
    const id = setInterval(() => setMin(minutesOfDay()), 60_000);
    return () => clearInterval(id);
  }, []);
  return min;
}
