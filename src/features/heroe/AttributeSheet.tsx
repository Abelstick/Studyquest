import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { shortDate, today, weekdayAbbr, weekdayIndex } from '@/core/dates';
import type { AttributeId } from '@/core/domain';
import { FORMA, UNLOCKS, attributeHistory, feedersOf, recentOf, unlockKindLabel, xpToReach, type AttributeState, type Feeder, type FeederKind } from '@/core/progression';
import { AttrBadge, attrStyle } from '@/ui/Attribute';
import { Button, Segmented, cx } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

const fmt = (n: number) => n.toLocaleString('es');

const KIND_LABEL: Record<FeederKind, string> = { habit: 'Hábito', task: 'Tarea', course: 'Curso', goal: 'Meta', project: 'Proyecto' };

/** Cómo está el atributo, en tono de ánimo: nunca un reproche. */
function paceText(a: AttributeState): string {
  if (a.idleDays === null) return 'Sin estrenar: tu primera acción le da un +10 %.';
  if (a.formaLow) return 'En pausa. Vuelve cuando quieras: la Forma se recupera rápido.';
  if (a.idleDays === 0) return a.week > 0 ? `+${fmt(a.week)} XP esta semana.` : 'Activo.';
  if (a.idleDays >= 3) return `Hace ${a.idleDays + 1} días que no lo mueves: volver ahora da +20 %.`;
  return `+${fmt(a.week)} XP esta semana.`;
}

/** Barra con el color del atributo (el XP del nivel) o en tono neutro (la Forma). */
function Meter({ pct, label, tone, low }: Readonly<{ pct: number; label: string; tone: 'attr' | 'forma'; low?: boolean }>) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className={cx('bar', 'ameter', `ameter--${tone}`, low && 'is-low')} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="bar__fill" style={{ width: `${v}%` }} />
    </div>
  );
}

function FeederRow({ f }: Readonly<{ f: Feeder }>) {
  const openModal = useUi((s) => s.openModal);
  const share = `${Math.round(f.share * 100)} %`;
  const body = (
    <>
      <span className="feeder__kind">{KIND_LABEL[f.kind]}</span>
      <span className="feeder__title">{f.title}</span>
      <span className="feeder__share" aria-label={`le da el ${share} de su XP`}>
        {share}
      </span>
    </>
  );
  if (f.kind === 'task')
    return (
      <li>
        <button type="button" className="feeder" onClick={() => openModal({ type: 'task-detail', id: f.id })} aria-haspopup="dialog">
          {body}
        </button>
      </li>
    );
  if (f.kind === 'habit')
    return (
      <li>
        <button type="button" className="feeder" onClick={() => openModal({ type: 'habit-detail', id: f.id })} aria-haspopup="dialog">
          {body}
        </button>
      </li>
    );
  const to = f.kind === 'course' ? `/cursos/${f.id}` : f.kind === 'goal' ? '/metas' : '/proyectos';
  return (
    <li>
      <Link className="feeder" to={to}>
        {body}
      </Link>
    </li>
  );
}

/** El camino del atributo: el próximo título y los cuatro desbloqueos, con lo que ya ganaste marcado. */
function AttributeRoad({ a }: Readonly<{ a: AttributeState }>) {
  const inventory = useData((s) => s.profile.inventory);
  const steps = UNLOCKS.filter((u) => u.attribute === a.def.id);
  const next = a.title.next;
  const toNext = (level: number) => Math.max(0, xpToReach(level) - a.xp);
  return (
    <section className="aroad" aria-label={`Camino de ${a.def.name}`}>
      <p className="aroad__title small">
        Título: <b>{a.title.current.title}</b>
        {next ? ` · «${next.title}» en el nivel ${next.level} (faltan ${fmt(toNext(next.level))} XP)` : ' · el más alto'}
      </p>
      <ol className="aroad__steps">
        {steps.map((u) => {
          const got = inventory.includes(u.id);
          return (
            <li key={u.id} className={cx('aroad__step', got && 'is-got', !got && a.nextUnlock?.id === u.id && 'is-next')}>
              <span className="aroad__lv">Nv {u.level}</span>
              <span className="aroad__name">{u.title}</span>
              <span className="aroad__kind">{unlockKindLabel(u.kind)}</span>
              <span className="aroad__state">{got ? <Icon name="check" size={12} /> : <Icon name="lock" size={10} />}</span>
              <span className="sr-only">{got ? 'Desbloqueado' : `Se desbloquea al nivel ${u.level}`}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Lo que alimenta al atributo y su XP de los últimos días. */
function AttributeDetail({ a }: Readonly<{ a: AttributeState }>) {
  const events = useData((s) => s.xpEvents);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const courses = useData((s) => s.courses);
  const goals = useData((s) => s.goals);
  const projects = useData((s) => s.projects);
  const openModal = useUi((s) => s.openModal);
  const [days, setDays] = useState<7 | 30>(7);
  const now = today();
  const id = a.def.id;
  const feeders = useMemo(() => feedersOf(id, { tasks, habits, courses, goals, projects }), [id, tasks, habits, courses, goals, projects]);
  const history = useMemo(() => attributeHistory(events, id, days, now), [events, id, days, now]);
  const recent = useMemo(() => recentOf(events, id, 6), [events, id]);
  const total = history.reduce((s, d) => s + d.xp, 0);
  const peak = Math.max(1, ...history.map((d) => d.xp));
  const SHOWN = 8;

  return (
    <div className="adetail">
      <section className="adetail__part" aria-label={`Qué alimenta tu ${a.def.name}`}>
        <h4 className="adetail__title">Lo alimentan</h4>
        {feeders.length ? (
          <>
            <ul className="feeders">
              {feeders.slice(0, SHOWN).map((f) => (
                <FeederRow key={`${f.kind}-${f.id}`} f={f} />
              ))}
            </ul>
            {feeders.length > SHOWN && <p className="muted small">Y {feeders.length - SHOWN} más.</p>}
          </>
        ) : (
          <div className="adetail__empty">
            <p className="small">Todavía nada alimenta tu {a.def.name.toLowerCase()}. {a.def.hint}</p>
            <Button small variant="primary" onClick={() => openModal({ type: 'habit' })}>
              <Icon name="plus" size={12} /> Crear un hábito
            </Button>
          </div>
        )}
      </section>

      <section className="adetail__part" aria-label={`Historial de ${a.def.name}`}>
        <div className="adetail__head">
          <h4 className="adetail__title">
            {fmt(total)} XP en {days} días
          </h4>
          <Segmented label="Periodo" value={days} options={[{ value: 7, label: '7 días' }, { value: 30, label: '30 días' }]} onChange={(v) => setDays(v)} />
        </div>
        <ol className={cx('ahist', days === 30 && 'ahist--month')} aria-label={`XP por día de los últimos ${days} días`}>
          {history.map((d) => (
            <li key={d.date} className={cx('ahist__day', d.xp === 0 && 'is-zero', d.date === now && 'is-today')} style={{ '--h': `${(d.xp / peak) * 100}%` } as React.CSSProperties}>
              <span className="ahist__bar" aria-hidden="true" />
              {days === 7 && <span className="ahist__wd" aria-hidden="true">{weekdayAbbr(weekdayIndex(d.date))}</span>}
              <span className="sr-only">
                {shortDate(d.date)}: {d.xp} XP
              </span>
            </li>
          ))}
        </ol>
        {recent.length > 0 && (
          <ul className="arecent">
            {recent.map((e) => (
              <li key={e.id} className="arecent__item">
                <span className="arecent__label">{e.label || 'Bonus'}</span>
                <span className="arecent__date muted">{shortDate(e.date)}</span>
                <span className="arecent__xp">+{e.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AttributeRow({ a, open, onToggle }: Readonly<{ a: AttributeState; open: boolean; onToggle: () => void }>) {
  const panelId = `attr-${a.def.id}`;
  const lv = a.level;
  return (
    <li className={cx('arow', open && 'is-open', a.formaLow && 'is-resting')} style={attrStyle(a.def.id)}>
      <button type="button" className="arow__head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <AttrBadge id={a.def.id} size={22} className="arow__badge" />
        <span className="arow__name">
          <span className="arow__title">
            {a.def.name} <span className="arow__rank">{a.title.current.title}</span>
          </span>
          <span className="arow__pace small">{paceText(a)}</span>
        </span>
        <span className="arow__lv" aria-label={`Nivel ${lv.level}`}>
          <span className="arow__lvtag" aria-hidden="true">
            Nv
          </span>
          {lv.level}
        </span>
        <span className="arow__meters">
          <span className="arow__meter">
            <Meter tone="attr" pct={lv.pct} label={lv.maxed ? `${a.def.name} al máximo` : `${a.def.name}: ${lv.into} de ${lv.needed} XP para el nivel ${lv.level + 1}`} />
            <span className="arow__num">{lv.maxed ? 'Máx.' : `${fmt(lv.into)}/${fmt(lv.needed)}`}</span>
          </span>
          <span className="arow__meter">
            <Meter tone="forma" pct={a.forma} low={a.formaLow} label={`Forma de ${a.def.name}: ${a.forma} %`} />
            <span className="arow__num">Forma {a.forma} %</span>
          </span>
        </span>
        <Icon name="down" size={12} className="arow__chev" />
      </button>
      {open && (
        <div id={panelId} className="arow__body">
          {a.formaLow && <p className="arow__note small">Con la Forma por debajo del {FORMA.lowThreshold} % este atributo gana un poco menos. No pierdes nada de lo que ya tienes.</p>}
          <AttributeRoad a={a} />
          <AttributeDetail a={a} />
        </div>
      )}
    </li>
  );
}

/** La hoja del personaje: una fila por atributo; al tocarla se abre lo que la alimenta y su historial. */
export function AttributeSheet({ attributes }: Readonly<{ attributes: AttributeState[] }>) {
  const [open, setOpen] = useState<AttributeId | null>(null);
  return (
    <ol className="asheet">
      {attributes.map((a) => (
        <AttributeRow key={a.def.id} a={a} open={open === a.def.id} onToggle={() => setOpen((cur) => (cur === a.def.id ? null : a.def.id))} />
      ))}
    </ol>
  );
}
