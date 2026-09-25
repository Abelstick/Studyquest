import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { today } from '@/core/dates';
import { logFor } from '@/core/game';
import { CHAIN_BONUS_XP, chainState } from '@/core/chains';
import type { HabitChain } from '@/core/domain';
import { Bar, Button, Tag, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { HabitAction } from './HabitAction';

/** Lista vacía estable: un `?? []` dentro del selector crea un array nuevo en cada render y provoca un bucle. */
const NO_CHAINS: HabitChain[] = [];

/**
 * Una cadena de hábitos: la rutina en orden, con el eslabón que toca ahora destacado.
 * Nunca bloquea nada: cualquier eslabón se puede registrar desde aquí cuando quieras.
 */
export function Chain({ chain }: { chain: HabitChain }) {
  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const openModal = useUi((s) => s.openModal);
  const now = today();
  const st = chainState(chain, habits, logs, now);

  return (
    <section className={cx('chain', st.complete && 'is-complete')}>
      <div className="split">
        <div>
          <p className="kicker">// Cadena de hábitos</p>
          <h2 className="panel__title">{chain.name}</h2>
        </div>
        <div className="chain__head">
          <Tag tone={st.complete ? 'green' : 'plain'}>
            {st.doneCount}/{st.dueCount} hoy
          </Tag>
          <Button small onClick={() => openModal({ type: 'chain', id: chain.id })} aria-label={`Editar la cadena ${chain.name}`}>
            Editar
          </Button>
        </div>
      </div>

      <Bar pct={st.pct} tone={st.complete ? 'green' : 'yellow'} label={`Progreso de ${chain.name}`} />

      <ol className="chain__links">
        {st.links.map((l) => (
          <li key={l.habit.id} className={cx('chlink', l.done && 'is-done', l.isNext && 'is-next', !l.due && 'is-off')}>
            <span className="chlink__mark" aria-hidden="true">
              {l.done ? '✔' : l.due ? '▸' : '·'}
            </span>
            <span className="chlink__text">
              <span className="chlink__title">{l.habit.title}</span>
              {/* Cada eslabón enseña SU conexión: de eso va la cadena. */}
              <span className="muted small">
                {l.after ? `Después de ${l.after.title}` : 'Empieza la rutina'}
                {!l.due ? ' · hoy no toca' : l.done ? ' · hecho' : l.isNext ? ' · te toca ahora' : ' · pendiente'}
              </span>
            </span>
            {l.due && !l.done && <HabitAction habit={l.habit} log={logFor(logs, l.habit.id, now)} />}
          </li>
        ))}
      </ol>

      <p className="muted small">
        {st.complete ? (
          <>
            <b>¡Cadena completa!</b> Tus hábitos están conectados: hoy cobraste +{CHAIN_BONUS_XP} XP extra.
          </>
        ) : st.next ? (
          <>
            Cada eslabón es la señal del siguiente. Ahora te toca <b>{st.next.title}</b>. Complétala entera hoy y ganas <b>+{CHAIN_BONUS_XP} XP</b>.
          </>
        ) : (
          'Hoy no toca ningún eslabón de esta cadena.'
        )}
      </p>
    </section>
  );
}

/** Todas las cadenas, encima de la lista de hábitos sueltos. */
export function Chains() {
  const chains = useData((s) => s.profile.chains) ?? NO_CHAINS;
  const habits = useData((s) => s.habits);
  const openModal = useUi((s) => s.openModal);

  if (chains.length === 0) {
    // Con menos de dos hábitos no hay nada que encadenar todavía.
    if (habits.length < 2) return null;
    return (
      <section className="panel chain__empty">
        <div className="split">
          <div>
            <p className="kicker">// Cadena de hábitos</p>
            <h2 className="panel__title">Conecta tus hábitos</h2>
          </div>
          <Sprite name="fire" size={26} />
        </div>
        <p className="muted small">
          Encadena una rutina en orden —dormir temprano → levantarse → ejercicio → estudio— y cada hábito te recordará el siguiente. No bloquea nada: es una guía, y completarla entera en un día da <b>+{CHAIN_BONUS_XP} XP</b>.
        </p>
        <Button variant="primary" small onClick={() => openModal({ type: 'chain' })}>
          ＋ Crear una cadena
        </Button>
      </section>
    );
  }

  return (
    <>
      {chains.map((c) => (
        <Chain key={c.id} chain={c} />
      ))}
      <Button small onClick={() => openModal({ type: 'chain' })}>
        ＋ Nueva cadena
      </Button>
    </>
  );
}
