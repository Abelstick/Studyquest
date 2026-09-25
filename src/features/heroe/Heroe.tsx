import { lazy, Suspense, useState } from 'react';
import { useData } from '@/state';
import type { Hero, HeroRace, HeroSlot } from '@/core/domain';
import { levelFromXp, xpAtLevelStart } from '@/core/game';
import {
  HERO_NAME_MAX, HERO_STAGES, RACES, SLOT_LABEL, STAT_KEYS, STAT_LABEL, bonusText, canEvolve, describeHero, heroStats, itemState, itemsFor, nextStage,
  paletteFor, raceOf, stageName, type HeroItem, type HeroLook, type StatKey,
} from '@/core/hero';
import { Bar, Button, Field, PageHead, Segmented, TextInput, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { ItemIcon, PaletteSwatch } from './ItemIcon';

// three.js pesa: solo se descarga al abrir esta pantalla.
const HeroViewer = lazy(() => import('./HeroViewer'));

function Viewer({ look, label, celebrate }: { look: HeroLook; label: string; celebrate?: number }) {
  return (
    <Suspense
      fallback={
        <div className="hero3d hero3d--off" role="status">
          <p className="hero3d__off">Cargando 3D…</p>
        </div>
      }
    >
      <HeroViewer look={look} label={label} celebrate={celebrate} />
    </Suspense>
  );
}

const STAT_TONE: Record<StatKey, 'red' | 'blue' | 'green' | 'yellow'> = { fuerza: 'red', defensa: 'blue', velocidad: 'green', energia: 'yellow' };
const coins = (n: number) => n.toLocaleString('en-US');

/* ---------- Elegir raza (al crear o al cambiar) ---------- */

function RacePicker({ current, onDone }: { current?: Hero; onDone: () => void }) {
  const { createHero, updateHero } = useData();
  const [race, setRace] = useState<HeroRace>(current?.race ?? 'saiyajin');
  const [name, setName] = useState(current?.name ?? '');
  // Al elegir se puede mirar cómo será cada raza en cualquier etapa.
  const [peek, setPeek] = useState(current?.stage ?? 0);
  const r = raceOf(race);
  const look: HeroLook = { race, stage: peek, weapon: current?.weapon ?? null, power: current?.power ?? null, skin: current?.skin ?? null };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (current) updateHero({ race, name });
    else createHero(race, name);
    onDone();
  };

  return (
    <form className="hero-pick" onSubmit={submit}>
      <section className="panel hero-pick__view">
        <Viewer look={look} label={`${r.name} en etapa ${stageName(race, peek)}`} />
        <Segmented
          label="Ver etapa"
          value={peek}
          options={HERO_STAGES.map((_, i) => ({ value: i, label: `${i + 1}` }))}
          onChange={setPeek}
        />
        <p className="small muted hero-pick__peek">
          Etapa {peek + 1}: <strong>{stageName(race, peek)}</strong> · {r.evolution}
        </p>
      </section>

      <section className="panel hero-pick__form">
        <fieldset className="races">
          <legend className="kicker">// Elige tu raza</legend>
          {RACES.map((x) => (
            <label key={x.id} className={cx('race', x.id === race && 'is-on')}>
              <input type="radio" name="race" value={x.id} checked={x.id === race} onChange={() => setRace(x.id)} />
              <span className="race__swatch" style={{ background: x.palette.primary, borderColor: x.palette.glow }} aria-hidden="true" />
              <span className="race__text">
                <span className="race__name">{x.name}</span>
                <span className="race__arch">{x.archetype}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="small">{r.blurb}</p>
        <dl className="hstats hstats--mini">
          {STAT_KEYS.map((k) => (
            <div key={k} className="hstat">
              <dt>{STAT_LABEL[k]}</dt>
              <dd>
                <Bar pct={(r.base[k] / 12) * 100} tone={STAT_TONE[k]} label={`${STAT_LABEL[k]} inicial de ${r.name}`} />
              </dd>
            </div>
          ))}
        </dl>
        <Field label="Nombre de tu héroe">
          {(fid) => <TextInput id={fid} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={r.defaultName} maxLength={HERO_NAME_MAX} />}
        </Field>
        <div className="row">
          <Button variant="primary" type="submit">
            {current ? 'Guardar cambios' : `¡Crear a ${name.trim() || r.defaultName}!`}
          </Button>
          {current && <Button onClick={onDone}>Cancelar</Button>}
        </div>
        {current && <p className="muted small">Cambiar de raza es gratis: conservas la etapa, las armas, los poderes y las skins.</p>}
      </section>
    </form>
  );
}

/* ---------- Evolución ---------- */

function Evolution({ hero, level, xp, onEvolve }: { hero: Hero; level: number; xp: number; onEvolve: () => void }) {
  const r = raceOf(hero.race);
  const ready = canEvolve(hero, level);
  const next = nextStage(hero);
  return (
    <div className="evo">
      <ol className="evo__track" aria-label="Etapas de evolución">
        {HERO_STAGES.map((st, i) => (
          <li
            key={i}
            className={cx('evo__step', i <= hero.stage && 'is-done', i === hero.stage && 'is-now', i === hero.stage + 1 && ready && 'is-ready')}
            aria-current={i === hero.stage ? 'step' : undefined}
          >
            <span className="evo__n">{i + 1}</span>
            <span className="evo__name">{r.stageNames[i]}</span>
            <span className="evo__lv">Nv. {st.minLevel}</span>
          </li>
        ))}
      </ol>
      {ready ? (
        <Button variant="coin" block className="evo__go" onClick={onEvolve}>
          ⚡ ¡Evolucionar a {r.stageNames[hero.stage + 1]}!
        </Button>
      ) : next ? (
        <p className="small evo__next">
          Siguiente evolución al <strong>nivel {next.minLevel}</strong>: te faltan {coins(Math.max(0, xpAtLevelStart(next.minLevel) - xp))} XP. Cada tarea, hábito y sesión cuenta.
        </p>
      ) : (
        <p className="small evo__next">
          <strong>Forma definitiva.</strong> Tu héroe no puede evolucionar más.
        </p>
      )}
    </div>
  );
}

/* ---------- Tienda ---------- */

function ItemCard({ item, hero, previewing, onPreview }: { item: HeroItem; hero: Hero; previewing: boolean; onPreview: () => void }) {
  const profile = useData((s) => s.profile);
  const { buyHeroItem, equipHero } = useData();
  const state = itemState(item, { inventory: profile.inventory, credits: profile.credits, hero });

  let cta: React.ReactNode;
  if (state === 'equipped')
    cta = (
      <Button small variant="green" aria-pressed onClick={() => equipHero(item.slot, null)}>
        ✔ Puesto
      </Button>
    );
  else if (state === 'owned')
    cta = (
      <Button small variant="primary" aria-pressed={false} onClick={() => equipHero(item.slot, item.id)}>
        Equipar
      </Button>
    );
  else if (state === 'locked')
    cta = (
      <Button small disabled>
        🔒 {stageName(hero.race, item.stage)}
      </Button>
    );
  else if (state === 'poor')
    cta = (
      <Button small disabled>
        Faltan {coins(item.price - profile.credits)}
      </Button>
    );
  else
    cta = (
      <Button small variant="coin" onClick={() => buyHeroItem(item.id)}>
        Comprar
      </Button>
    );

  const bonus = bonusText(item.bonus);
  return (
    <li className={cx('hitem', state === 'equipped' && 'is-equipped', (state === 'locked' || state === 'poor') && 'is-dim', previewing && 'is-preview')}>
      <span className="hitem__art">{item.slot === 'skin' ? <PaletteSwatch palette={paletteFor(hero.race, item.id)} /> : <ItemIcon item={item} />}</span>
      <div className="hitem__body">
        <p className="hitem__title">{item.title}</p>
        <p className="muted small">{item.blurb}</p>
        <p className="hitem__meta">
          {bonus && <span className="tag tag--green">{bonus}</span>}
          {state !== 'equipped' && state !== 'owned' && (
            <span className="price">
              <Sprite name="coin" size={12} /> {coins(item.price)}
            </span>
          )}
        </p>
      </div>
      <div className="hitem__cta">
        {state !== 'equipped' && (
          <Button small aria-pressed={previewing} onClick={onPreview}>
            {previewing ? 'Quitar' : 'Probar'}
          </Button>
        )}
        {cta}
      </div>
    </li>
  );
}

function OriginalSkin({ hero, previewing, onPreview }: { hero: Hero; previewing: boolean; onPreview: () => void }) {
  const equipHero = useData((s) => s.equipHero);
  const on = hero.skin === null;
  return (
    <li className={cx('hitem', on && 'is-equipped', previewing && 'is-preview')}>
      <span className="hitem__art">
        <PaletteSwatch palette={raceOf(hero.race).palette} />
      </span>
      <div className="hitem__body">
        <p className="hitem__title">Original</p>
        <p className="muted small">Los colores de siempre de los {raceOf(hero.race).name}.</p>
      </div>
      <div className="hitem__cta">
        {!on && (
          <Button small aria-pressed={previewing} onClick={onPreview}>
            {previewing ? 'Quitar' : 'Probar'}
          </Button>
        )}
        <Button small variant={on ? 'green' : 'primary'} aria-pressed={on} onClick={() => !on && equipHero('skin', null)}>
          {on ? '✔ Puesta' : 'Usar'}
        </Button>
      </div>
    </li>
  );
}

/* ---------- Pantalla ---------- */

type Preview = { slot: HeroSlot; id: string | null } | null;

export default function Heroe() {
  const profile = useData((s) => s.profile);
  const evolveHero = useData((s) => s.evolveHero);
  const [editing, setEditing] = useState(false);
  const [slot, setSlot] = useState<HeroSlot>('weapon');
  const [preview, setPreview] = useState<Preview>(null);
  const [celebrate, setCelebrate] = useState(0);
  const hero = profile.hero;
  const level = levelFromXp(profile.xp);

  const wallet = (
    <div className="wallet" aria-label={`${profile.credits} monedas`}>
      <Sprite name="coin" size={22} />
      <span className="wallet__n">{coins(profile.credits)}</span>
    </div>
  );

  if (!hero || editing)
    return (
      <div className="stack">
        <PageHead
          kicker="// Tu personaje"
          title={hero ? 'Cambiar raza o nombre' : 'Crea tu héroe'}
          sprite="knight"
          right={wallet}
          hint="Tu héroe crece contigo: cada nivel que subes estudiando lo hace más fuerte, y con las monedas le compras armas, poderes y skins."
        />
        <RacePicker current={hero} onDone={() => setEditing(false)} />
      </div>
    );

  const r = raceOf(hero.race);
  // Lo que se ve: el héroe tal cual, o probándose algo de la tienda.
  const shown: Hero = preview ? { ...hero, [preview.slot]: preview.id } : hero;
  const stats = heroStats(hero, level);
  const previewStats = preview ? heroStats(shown, level) : null;
  const scale = Math.max(...STAT_KEYS.map((k) => (previewStats ?? stats).total[k])) * 1.15;
  const toggle = (s: HeroSlot, id: string | null) => setPreview((p) => (p && p.slot === s && p.id === id ? null : { slot: s, id }));
  const previewTitle = preview ? (preview.id ? itemsFor(preview.slot).find((i) => i.id === preview.id)?.title : 'Original') : null;

  const evolve = () => {
    evolveHero();
    setPreview(null);
    setCelebrate((c) => c + 1);
  };

  return (
    <div className="stack">
      <PageHead kicker="// Tu personaje" title="Héroe 3D" sprite="knight" right={wallet} />

      <div className="hero-page">
        <section className="panel hero-card" aria-labelledby="hero-name">
          <div className="hero-card__view">
            {preview && (
              <p className="hero-preview" role="status">
                Probando: <strong>{previewTitle}</strong>
                <Button small onClick={() => setPreview(null)}>
                  Volver a lo mío
                </Button>
              </p>
            )}
            <Viewer look={shown} label={describeHero(shown)} celebrate={celebrate} />
          </div>
          <div className="hero-card__id">
            <div>
              <p className="kicker">
                {r.name} · {r.archetype}
              </p>
              <h2 id="hero-name" className="hero-card__name">
                {hero.name}
              </h2>
              <span className="tag tag--xp">
                Etapa {hero.stage + 1}/4 · {stageName(hero.race, hero.stage)}
              </span>
            </div>
            <Button small onClick={() => setEditing(true)}>
              Cambiar raza o nombre
            </Button>
          </div>
          <Evolution hero={hero} level={level} xp={profile.xp} onEvolve={evolve} />
        </section>

        <div className="stack">
          <section className="panel" aria-labelledby="hero-stats">
            <div className="split">
              <h2 id="hero-stats" className="section-title">
                // Estadísticas
              </h2>
              <p className="hpower">
                Poder <strong>{stats.power}</strong>
                {previewStats && previewStats.power !== stats.power && (
                  <span className={cx('hpower__delta', previewStats.power > stats.power ? 'is-up' : 'is-down')}>
                    {' '}
                    → {previewStats.power}
                  </span>
                )}
              </p>
            </div>
            <dl className="hstats">
              {STAT_KEYS.map((k) => {
                const v = (previewStats ?? stats).total[k];
                const extra = (previewStats ?? stats).bonus[k];
                return (
                  <div key={k} className="hstat">
                    <dt>{STAT_LABEL[k]}</dt>
                    <dd>
                      <Bar pct={(v / scale) * 100} tone={STAT_TONE[k]} label={`${STAT_LABEL[k]}: ${v}`} />
                      <span className="hstat__n">
                        {v}
                        {extra > 0 && <small className="hstat__bonus"> (+{extra})</small>}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="muted small">Suben con tu nivel (ahora {level}), se multiplican al evolucionar y el arma y el poder suman su extra.</p>
          </section>

          <section className="panel" aria-labelledby="hero-shop">
            <div className="split hero-shop__head">
              <h2 id="hero-shop" className="section-title">
                // Tienda del héroe
              </h2>
              <Segmented label="Tipo de objeto" value={slot} options={(['weapon', 'power', 'skin'] as HeroSlot[]).map((s) => ({ value: s, label: SLOT_LABEL[s] }))} onChange={setSlot} />
            </div>
            <ul className="hitems">
              {slot === 'skin' && <OriginalSkin hero={hero} previewing={preview?.slot === 'skin' && preview.id === null} onPreview={() => toggle('skin', null)} />}
              {itemsFor(slot).map((it) => (
                <ItemCard key={it.id} item={it} hero={hero} previewing={preview?.id === it.id} onPreview={() => toggle(it.slot, it.id)} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
