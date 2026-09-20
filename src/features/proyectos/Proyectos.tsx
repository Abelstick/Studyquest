import { useData } from '@/state';
import { useUi } from '@/state/ui';
import type { Project } from '@/core/domain';
import { Bar, Button, Empty, PageHead, Tag, cx } from '@/ui/kit';

const progress = (p: Project) => {
  const total = p.checkpoints.reduce((a, c) => a + c.xp, 0);
  const done = p.checkpoints.filter((c) => c.done).reduce((a, c) => a + c.xp, 0);
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, count: p.checkpoints.filter((c) => c.done).length };
};

function Track({ project }: { project: Project }) {
  const toggle = useData((s) => s.toggleCheckpoint);
  const firstOpen = project.checkpoints.findIndex((c) => !c.done);
  return (
    <ol className="track">
      {project.checkpoints.map((c, i) => {
        const state = c.done ? 'done' : i === firstOpen ? 'active' : 'locked';
        return (
          <li key={c.id} className={cx('track__item', `track__item--${state}`)}>
            <button type="button" className="track__node" onClick={() => toggle(project.id, c.id)} aria-pressed={c.done} aria-label={`${c.done ? 'Desmarcar' : 'Completar'} checkpoint: ${c.title}`}>
              {c.done ? '✔' : i + 1}
            </button>
            <div className="track__line" aria-hidden="true" />
            <p className="track__title">{c.title}</p>
            {c.summary && <p className="muted small">{c.summary}</p>}
            <p className="track__xp">+{c.xp} XP</p>
          </li>
        );
      })}
    </ol>
  );
}

export default function Proyectos() {
  const projects = useData((s) => s.projects);
  const deleteProject = useData((s) => s.deleteProject);
  const openModal = useUi((s) => s.openModal);

  const main = projects.find((p) => p.kind === 'main');
  const others = projects.filter((p) => p !== main);
  const mp = main && progress(main);

  const remove = (p: Project) => openModal({ type: 'confirm', title: 'Borrar proyecto', body: `Se eliminará "${p.title}".`, confirmLabel: 'Borrar', onConfirm: () => deleteProject(p.id) });

  return (
    <div className="stack">
      <PageHead
        kicker="// Operaciones personales"
        title="Proyectos"
        sprite="chest"
        right={
          <Button variant="primary" onClick={() => openModal({ type: 'project' })}>
            ＋ Nuevo proyecto
          </Button>
        }
      />
      {projects.length === 0 && (
        <div className="panel">
          <Empty sprite="chest" title="Cofre vacío">
            <p>Un proyecto se divide en checkpoints con XP. Ideal para portafolios, tesis o apps.</p>
            <Button variant="primary" onClick={() => openModal({ type: 'project' })}>
              Crear primer proyecto
            </Button>
          </Empty>
        </div>
      )}

      {main && mp && (
        <section className="panel panel--yellow">
          <div className="split split--top">
            <div>
              <p className="kicker">
                Operación principal · {mp.count} de {main.checkpoints.length} checkpoints
              </p>
              <h2 className="panel__title panel__title--big">{main.title}</h2>
              {main.summary && <p className="muted">{main.summary}</p>}
            </div>
            <div className="big-stat">
              <span className="big-num big-num--red">{mp.pct}%</span>
              <span className="kicker">
                {mp.done.toLocaleString('en-US')} / {mp.total.toLocaleString('en-US')} XP
              </span>
            </div>
          </div>
          <Bar pct={mp.pct} tone="green" tall label={`Progreso de ${main.title}`} />
          <Track project={main} />
          <Button small variant="danger" onClick={() => remove(main)}>
            Borrar proyecto
          </Button>
        </section>
      )}

      <div className="grid grid--cards">
        {others.map((p) => {
          const pr = progress(p);
          return (
            <article key={p.id} className="card">
              <div className="card__bar" />
              <div className="card__body">
                <div className="split split--top">
                  <h2 className="card__title">{p.title}</h2>
                  <Tag tone={p.kind === 'main' ? 'xp' : 'blue'}>{p.kind === 'main' ? 'Principal' : 'Side quest'}</Tag>
                </div>
                {p.summary && <p className="muted">{p.summary}</p>}
                <div className="split">
                  <span className="kicker">
                    {pr.count} de {p.checkpoints.length} hitos
                  </span>
                  <b>{pr.pct}%</b>
                </div>
                <Bar pct={pr.pct} tone="green" label={`Progreso de ${p.title}`} />
                <Track project={p} />
                <Button small variant="danger" onClick={() => remove(p)}>
                  Borrar
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
