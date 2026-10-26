import { useState } from 'react';
import { useData } from '@/state';
import { monthName, today } from '@/core/dates';
import { CHALLENGES, challengeOption, challengeProgress, monthValue, newChallenge, targetText } from '@/core/challenge';
import type { ChallengeKind } from '@/core/domain';
import { Bar, Button, cx } from '@/ui/kit';
import { FoldPanel } from '@/ui/Fold';
import { Sprite } from '@/ui/Sprite';
import { RadioGroup } from '@/ui/RadioGroup';

const monthLabel = (month: string) => monthName(Number(month.slice(5, 7)) - 1);

/** Elegir el reto: qué medir, cuánto y cuánto premio da. Un solo reto por mes. */
function Picker() {
  const setChallenge = useData((s) => s.setChallenge);
  const sessions = useData((s) => s.sessions);
  const tasks = useData((s) => s.tasks);
  const xpEvents = useData((s) => s.xpEvents);
  const [kind, setKind] = useState<ChallengeKind>('studyDays');
  const opt = challengeOption(kind);
  const [target, setTarget] = useState(opt.presets[1]);
  const preview = newChallenge(kind, target);
  // Lo que ya llevas este mes no cuenta: el reto mide lo que logres desde hoy.
  const base = monthValue(kind, preview.month, { sessions, tasks, xpEvents });

  return (
    <div className="stack">
      <p className="muted small">
        Ponte una meta para {monthLabel(preview.month)}. Si la cumples, ganas monedas (una sola vez).{base > 0 && ' Lo que ya llevas este mes no cuenta: el reto mide lo que logres desde hoy.'}
      </p>
      <RadioGroup className="chips" aria-label="Qué medir">
        {CHALLENGES.map((c) => (
          <button
            key={c.kind}
            type="button"
            role="radio"
            aria-checked={c.kind === kind}
            className={cx('chip chip--sm', c.kind === kind && 'is-on')}
            onClick={() => {
              setKind(c.kind);
              setTarget(c.presets[1]);
            }}
          >
            {c.label}
          </button>
        ))}
      </RadioGroup>
      <RadioGroup className="chips" aria-label="Meta del mes">
        {opt.presets.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={p === target} className={cx('chip chip--sm', p === target && 'is-on')} onClick={() => setTarget(p)}>
            {p.toLocaleString('es')} {opt.unit}
          </button>
        ))}
      </RadioGroup>
      <Button variant="primary" small onClick={() => setChallenge(newChallenge(kind, target, today(), base))}>
        Empezar: {targetText(preview)} · +{preview.reward} monedas
      </Button>
    </div>
  );
}

/**
 * Reto del mes: una meta numérica que eliges (días o horas de estudio, tareas o XP) con premio en monedas. El avance
 * sale de tus datos; solo se guarda el reto y si ya cobraste. Uno por mes.
 */
export function MonthChallenge() {
  const challenge = useData((s) => s.profile.challenge);
  const sessions = useData((s) => s.sessions);
  const tasks = useData((s) => s.tasks);
  const xpEvents = useData((s) => s.xpEvents);
  const setChallenge = useData((s) => s.setChallenge);
  const claim = useData((s) => s.claimChallenge);
  const prog = challenge ? challengeProgress(challenge, { sessions, tasks, xpEvents }, today()) : null;

  let body;
  let badge: string | undefined;
  if (!challenge || !prog || !prog.current) {
    body = (
      <>
        {challenge && prog && (
          <p className="muted small">
            Reto de {monthLabel(challenge.month)}: {prog.done ? (challenge.claimed ? 'cumplido y cobrado' : 'cumplido, pero se pasó el mes sin cobrarlo') : `${prog.value.toLocaleString('es')} de ${targetText(challenge)}`}.
          </p>
        )}
        <Picker />
      </>
    );
  } else if (challenge.claimed) {
    badge = '✓';
    body = (
      <p className="muted small">
        <Sprite name="trophy" size={18} /> ¡Reto de {monthLabel(challenge.month)} cumplido! Ganaste {challenge.reward} monedas. El próximo reto empieza el mes que viene.
      </p>
    );
  } else {
    badge = `${prog.pct}%`;
    body = (
      <>
        <p className="list__title">{challengeOption(challenge.kind).label}</p>
        <Bar pct={prog.pct} tone={prog.done ? 'green' : 'yellow'} tall label="Progreso del reto del mes" />
        <p className="muted small">
          <b>{prog.value.toLocaleString('es')}</b> de {targetText(challenge)} · {prog.done ? '¡cumplido!' : `quedan ${prog.daysLeft} ${prog.daysLeft === 1 ? 'día' : 'días'} del mes`} · premio +{challenge.reward} monedas
        </p>
        <div className="row">
          {prog.claimable && (
            <Button variant="coin" small onClick={claim}>
              Cobrar +{challenge.reward}
            </Button>
          )}
          {!prog.done && (
            <button type="button" className="link" onClick={() => setChallenge(null)}>
              Cambiar reto
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <FoldPanel id="home-challenge" kicker="Tu meta de este mes" title="Reto del mes" badge={badge ?? (prog?.claimable ? '¡Cobra!' : undefined)} defaultOpen={!(challenge?.claimed && prog?.current)}>
      {body}
    </FoldPanel>
  );
}
