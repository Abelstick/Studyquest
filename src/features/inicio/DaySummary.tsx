import type { DayProgress } from '@/core/missions';
import { Bar, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import type { SpriteName } from '@/ui/sprites';

interface TileProps {
  tone: 'main' | 'habit' | 'task' | 'streak';
  sprite: SpriteName;
  label: string;
  value: string;
  note?: string;
  alert?: boolean;
  clear?: boolean;
  bar?: { pct: number; segments: number; tone: 'green' | 'yellow' | 'red' | 'blue' };
}

function Tile({ tone, sprite, label, value, note, alert, clear, bar }: Readonly<TileProps>) {
  return (
    <div className={cx('daysum__tile', `daysum__tile--${tone}`, clear && 'is-clear', alert && 'is-alert')} role="group" aria-label={`${label}: ${value}${note ? `. ${note}` : ''}`}>
      <Sprite name={sprite} size={tone === 'main' ? 32 : 24} className="daysum__sprite" />
      <div className="daysum__text">
        <p className="daysum__k">{label}</p>
        <p className="daysum__v">{value}</p>
        {note && <p className="daysum__note">{note}</p>}
      </div>
      {bar && <Bar className="daysum__bar" pct={bar.pct} segments={bar.segments} tone={bar.tone} label={label} />}
    </div>
  );
}

/** Resumen del día en cuatro casillas: avance general, hábitos, tareas y racha. Solo muestra datos que ya existen. */
export function DaySummary({ progress, streak, streakAlive }: Readonly<{ progress: DayProgress; streak: number; streakAlive: boolean }>) {
  const clear = progress.total > 0 && progress.done === progress.total;
  const streakNote = streak > 0 && !streakAlive ? 'Peligra hoy' : undefined;
  const mainNote = clear ? '¡Día completo!' : `${progress.xpLeft} XP en juego`;
  const taskNote = progress.late > 0 ? `${progress.late} ${progress.late === 1 ? 'vencida' : 'vencidas'}` : undefined;

  return (
    <section className="daysum" aria-label="Resumen del día">
      <Tile tone="main" sprite={clear ? 'trophy' : 'star'} label="Progreso del día" value={`${progress.done}/${progress.total} · ${progress.pct}%`} note={mainNote} clear={clear} bar={{ pct: progress.pct, segments: progress.total, tone: 'yellow' }} />
      <Tile tone="habit" sprite="flower" label="Hábitos" value={`${progress.habitsDone}/${progress.habitsTotal}`} clear={progress.habitsTotal > 0 && progress.habitsDone === progress.habitsTotal} />
      <Tile tone="task" sprite="qblock" label="Tareas" value={`${progress.tasksDone}/${progress.tasksTotal}`} note={taskNote} alert={progress.late > 0} clear={progress.tasksTotal > 0 && progress.tasksDone === progress.tasksTotal} />
      <Tile tone="streak" sprite="fire" label="Racha" value={`${streak} ${streak === 1 ? 'día' : 'días'}`} note={streakNote} alert={!!streakNote} />
    </section>
  );
}
