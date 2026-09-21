import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { Bar, Button, Empty, PageHead, Panel, Tag, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { CONCEPTS } from '@/core/concepts';
import { GuideButton } from '@/features/help/ConceptGuide';

export default function Metas() {
  const goals = useData((s) => s.goals);
  const { toggleSkill, setMilestoneDone, deleteGoal } = useData();
  const openModal = useUi((s) => s.openModal);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const goal = goals.find((g) => g.id === pickedId) ?? goals[0];

  if (!goal) {
    return (
      <div className="stack">
        <PageHead kicker="// Árbol de habilidades" title="Metas" sprite="flag" hint={CONCEPTS.meta.hint} right={<GuideButton />} />
        <div className="panel">
          <Empty sprite="flag" title="Ninguna bandera a la vista">
            <p>Una meta es lo que quieres lograr a largo plazo, por ejemplo «aprender análisis de datos». Se divide en hitos (Excel, SQL, Python…): cada uno da XP y te acerca a la recompensa final.</p>
            <p className="muted small">Las metas se cumplen avanzando con tareas y hábitos. ¿Dudas? Pulsa «¿Cuál uso?».</p>
            <div className="row">
              <Link className="btn btn--primary" to="/planificador">
                ✨ Planificar con el asistente
              </Link>
              <Button onClick={() => openModal({ type: 'goal' })}>Crear a mano</Button>
            </div>
          </Empty>
        </div>
      </div>
    );
  }

  const done = goal.milestones.filter((m) => m.done).length;
  const totalXp = goal.milestones.reduce((a, m) => a + m.xp, 0);
  const earnedXp = goal.milestones.filter((m) => m.done).reduce((a, m) => a + m.xp, 0);
  const activeIdx = goal.milestones.findIndex((m) => !m.done);
  const complete = activeIdx === -1;

  return (
    <div className="stack">
      <PageHead
        kicker="// Árbol de habilidades"
        title={goal.title}
        sprite="flag"
        hint="Tu meta: lo que quieres lograr a largo plazo. Avanzas cumpliendo sus hitos."
        right={
          <>
            <GuideButton />
            <div className="big-stat">
              <span className="big-num">
                {done} / {goal.milestones.length}
              </span>
              <span className="kicker">
                {earnedXp.toLocaleString('en-US')} / {totalXp.toLocaleString('en-US')} XP
              </span>
            </div>
            <Button variant="primary" onClick={() => openModal({ type: 'goal' })}>
              ＋ Nueva meta
            </Button>
          </>
        }
      />
      {goals.length > 1 && (
        <div className="chips" role="tablist" aria-label="Metas">
          {goals.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={g.id === goal.id} className={cx('chip', g.id === goal.id && 'is-on')} onClick={() => setPickedId(g.id)}>
              {g.title}
            </button>
          ))}
        </div>
      )}

      <div className="cols cols--side">
        <ol className="path">
          {goal.milestones.map((m, i) => {
            const state = m.done ? 'done' : i === activeIdx ? 'active' : 'locked';
            const skillsDone = m.skills.filter((k) => k.done).length;
            return (
              <li key={m.id} className={cx('path__item', `path__item--${state}`)}>
                <div className="path__node" aria-hidden="true">
                  {m.done ? '✔' : i + 1}
                </div>
                <div className="path__card">
                  <div className="split split--top">
                    <div>
                      <p className="kicker">{state === 'done' ? 'Conquistado' : state === 'active' ? 'En curso' : 'Bloqueado'}</p>
                      <h2 className="path__title">{m.title}</h2>
                      {m.summary && <p className="muted small">{m.summary}</p>}
                    </div>
                    <Tag tone={state === 'active' ? 'xp' : 'plain'}>{m.xp} XP</Tag>
                  </div>
                  {state === 'active' && (
                    <div className="path__body">
                      {m.skills.length > 0 && (
                        <>
                          <Bar pct={(skillsDone / m.skills.length) * 100} tone="green" label="Habilidades del hito" />
                          <div className="chips">
                            {m.skills.map((k) => (
                              <button key={k.id} type="button" aria-pressed={k.done} className={cx('chip chip--sm', k.done && 'is-on')} onClick={() => toggleSkill(goal.id, m.id, k.id)}>
                                {k.label} {k.done ? '✔' : ''}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <Button variant="green" small onClick={() => setMilestoneDone(goal.id, m.id, true)}>
                        Conquistar hito (+{m.xp} XP)
                      </Button>
                    </div>
                  )}
                  {state === 'done' && (
                    <Button small onClick={() => setMilestoneDone(goal.id, m.id, false)}>
                      Deshacer
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <aside className="stack">
          <Panel tone="yellow" kicker="// Recompensa final">
            <div className="reward-final">
              <Sprite name="trophy" size={48} className={cx(!complete && 'is-locked')} />
              <h2 className="panel__title">{goal.rewardTitle}</h2>
            </div>
            {goal.rewardDescription && <p className="muted">{goal.rewardDescription}</p>}
            <p className="kicker">{complete ? '¡Meta conquistada! Reclama tu título.' : `${goal.milestones.length - done} ${goal.milestones.length - done === 1 ? 'hito' : 'hitos'} para conseguirla`}</p>
          </Panel>
          <Button
            variant="danger"
            small
            onClick={() => openModal({ type: 'confirm', title: 'Borrar meta', body: `Se eliminará "${goal.title}" y sus hitos.`, confirmLabel: 'Borrar', onConfirm: () => deleteGoal(goal.id) })}
          >
            Borrar meta
          </Button>
        </aside>
      </div>
    </div>
  );
}
