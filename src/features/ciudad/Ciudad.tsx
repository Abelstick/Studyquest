import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CITY_MAX, MAX_LEVEL, LEVEL_REWARD, type BuildingId, type BuildingState } from '@/core/city';
import { buildingRows } from '@/ui/city-art';
import { Bar, PageHead, Panel, cx } from '@/ui/kit';
import { PixelArt } from '@/ui/PixelArt';
import { Sprite } from '@/ui/Sprite';
import { useCity } from './useCity';

const SEEN_KEY = 'sq:city-seen';

/** Niveles que ya viste: los edificios que subieron desde tu última visita se animan al entrar. */
function useNewBuildings(states: BuildingState[]): Set<BuildingId> {
  const [fresh, setFresh] = useState<Set<BuildingId>>(new Set());
  const key = states.map((s) => s.level).join(',');
  useEffect(() => {
    let seen: Partial<Record<BuildingId, number>> = {};
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as typeof seen;
    } catch {
      /* primera visita */
    }
    const up = new Set(states.filter((s) => s.level > (seen[s.building.id] ?? s.level)).map((s) => s.building.id));
    setFresh(up);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(states.map((s) => [s.building.id, s.level]))));
    } catch {
      /* modo privado */
    }
    if (!up.size) return;
    const t = setTimeout(() => setFresh(new Set()), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return fresh;
}

/** Un solar con su edificio, su nombre y sus estrellas. */
export function Plot({ state, selected, fresh, onSelect, size = 132 }: { state: BuildingState; selected?: boolean; fresh?: boolean; onSelect?: () => void; size?: number }) {
  const { building: b, level } = state;
  const name = level === 0 ? 'Solar en obras' : b.levelNames[level - 1];
  return (
    <button type="button" className={cx('plot', selected && 'is-selected', fresh && 'is-new')} onClick={onSelect} aria-pressed={selected} aria-label={`${b.name}: ${name}, nivel ${level} de ${MAX_LEVEL}`}>
      <PixelArt rows={buildingRows(b.id, level)} size={size} />
      <span className="plot__plate">
        <b>{b.name}</b>
        <span className="plot__stars" aria-hidden="true">
          {Array.from({ length: MAX_LEVEL }, (_, i) => (
            <i key={i} className={i < level ? 'is-on' : undefined}>
              ★
            </i>
          ))}
        </span>
      </span>
    </button>
  );
}

function Detail({ state }: { state: BuildingState }) {
  const { building: b, level, value, next, pct, left } = state;
  return (
    <Panel kicker={`// ${b.area}`} title={`${b.name} · ${level === 0 ? 'Solar en obras' : b.levelNames[level - 1]}`} tone="yellow">
      <p>{b.what}</p>
      <div className="citybar">
        <Bar pct={pct} tone="yellow" tall label={`Progreso de ${b.name}`} />
        <p className="muted small">
          {next === null ? (
            <>
              ¡Nivel máximo! <b>{value.toLocaleString('en-US')}</b> {b.unit}.
            </>
          ) : (
            <>
              <b>{value.toLocaleString('en-US')}</b> de <b>{next.toLocaleString('en-US')}</b> {b.unit} — te {left === 1 ? 'falta' : 'faltan'} <b>{left}</b> para «{b.levelNames[level]}».
            </>
          )}
        </p>
      </div>

      <h3 className="guide__h">Los 5 niveles</h3>
      <ol className="ladder">
        {b.levelNames.map((n, i) => (
          <li key={n} className={cx(i + 1 <= level && 'is-done', i + 1 === level + 1 && 'is-next')}>
            <span className="ladder__mark" aria-hidden="true">
              {i + 1 <= level ? '✔' : i + 1}
            </span>
            <span className="ladder__name">{n}</span>
            <span className="muted small">{b.thresholds[i].toLocaleString('en-US')} {b.unit}</span>
            <span className="ladder__coins">
              <Sprite name="coin" size={12} /> +{LEVEL_REWARD[i + 1]}
            </span>
          </li>
        ))}
      </ol>

      <h3 className="guide__h">Cómo se ganan los puntos</h3>
      <ul className="citylist">
        {b.scoring.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="muted small">💡 {b.tip}</p>
      <Link className="btn btn--primary" to={b.to}>
        {b.cta}
      </Link>
    </Panel>
  );
}

export default function Ciudad() {
  const city = useCity();
  const fresh = useNewBuildings(city.states);
  const [picked, setPicked] = useState<BuildingId | null>(null);
  const selected = city.states.find((s) => s.building.id === (picked ?? city.closest?.building.id)) ?? city.states[0];
  const decor = city.decor;
  const trees = useMemo(() => Array.from({ length: decor.trees }, (_, i) => i), [decor.trees]);

  return (
    <div className="stack">
      <PageHead kicker="// Progreso visual" title="Tu ciudad" sprite="house" hint="Cada área de estudio es un edificio que crece con lo que haces de verdad: hábitos, cursos, proyectos, retos y logros. No hay que registrar nada más." />

      <Panel kicker={`// ${city.total} de ${CITY_MAX} mejoras`} title={city.title.name} right={<span className="tag tag--xp">👥 {city.people.toLocaleString('en-US')} habitantes</span>}>
        <Bar pct={(city.total / CITY_MAX) * 100} tone="green" tall label="Progreso total de la ciudad" />
        <p className="muted small">
          {city.title.next ? (
            <>
              Te faltan <b>{city.title.next.at - city.total}</b> {city.title.next.at - city.total === 1 ? 'mejora' : 'mejoras'} para ser una <b>{city.title.next.name}</b>.
            </>
          ) : (
            '¡Tu ciudad es una capital legendaria!'
          )}{' '}
          {city.closest && (
            <>
              La más cerca de mejorar: <button type="button" className="link" onClick={() => setPicked(city.closest!.building.id)}>{city.closest.building.name}</button> ({city.closest.pct}%).
            </>
          )}
        </p>
      </Panel>

      <div className="cols cols--side">
        <div className="cityscene" aria-label="Mapa de tu ciudad">
          <div className="cityscene__sky" aria-hidden="true" />
          <div className="cityscene__grid">
            {city.states.map((s) => (
              <Plot key={s.building.id} state={s} selected={selected.building.id === s.building.id} fresh={fresh.has(s.building.id)} onSelect={() => setPicked(s.building.id)} />
            ))}
          </div>
          <div className="cityscene__decor" aria-hidden="true">
            {decor.flags && <Sprite name="flag" size={30} />}
            {trees.map((i) => (
              <Sprite key={i} name="tree" size={30} />
            ))}
            {decor.fountain && (
              <span className="fountain">
                <Sprite name="drop" size={20} className="fountain__drop" />
                <span className="fountain__basin" />
              </span>
            )}
            {decor.lamps && <span className="lamp" />}
            {decor.lamps && <span className="lamp" />}
          </div>
          <div className="cityscene__road" aria-hidden="true" />
        </div>
        <Detail state={selected} />
      </div>
    </div>
  );
}
