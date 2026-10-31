import { lazy, Suspense, useMemo, useState } from 'react';
import { useData, useTotalXp } from '@/state';
import type { Hero, HeroRace, HeroSlot } from '@/core/domain';
import { levelProgress, xpAtLevelStart } from '@/core/game';
import { today } from '@/core/dates';
import { attributeOf, attributeTotals, characterSheet, classFor, classOf, classPairText, isClassId } from '@/core/progression';
import {
  HERO_NAME_MAX, HERO_STAGES, RACES, SLOT_LABEL, canEvolve, describeHero, itemState, itemsFor, nextStage,
  paletteFor, raceOf, stageName, type HeroItem, type HeroLook,
} from '@/core/hero';
import { Bar, Button, Field, PageHead, Segmented, TextInput, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { ItemIcon, PaletteSwatch } from './ItemIcon';
import { AttributeRadar } from './AttributeRadar';
import { AttributeSheet } from './AttributeSheet';
import { Icon } from '@/ui/Icon';

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
          <legend className="kicker">Elige tu raza</legend>
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
        <p className="muted small">La raza es su aspecto. Lo que lo hace fuerte son tus hábitos y tareas: cada uno alimenta sus atributos.</p>
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
          ¡Evolucionar a {r.stageNames[hero.stage + 1]}!
        </Button>
      ) : next ? (
        <p className="small evo__next">
          Siguiente evolución al <strong>nivel {next.minLevel}</strong>: te faltan {coins(Math.max(0, xpAtLevelStart(next.minLevel) - xp))} XP, sumando todos tus atributos.
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
        <Icon name="check" size={12} /> Puesto
      </Button>
    );
  else if (state === 'owned')
    cta = (
      <Button small variant="primary" aria-pressed={false} onClick={() => equipHero(item.slot, item.id)}>
        Equipar
      </Button>
    );
  else if (state === 'earn' && item.unlock)
    cta = (
      <Button small disabled>
        <Icon name="lock" size={10} /> {attributeOf(item.unlock.attribute).name} nv. {item.unlock.level}
      </Button>
    );
  else if (state === 'locked')
    cta = (
      <Button small disabled>
        <Icon name="lock" size={10} /> {stageName(hero.race, item.stage)}
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

  return (
    <li className={cx('hitem', state === 'equipped' && 'is-equipped', (state === 'locked' || state === 'poor' || state === 'earn') && 'is-dim', previewing && 'is-preview')}>
      <span className="hitem__art">{item.slot === 'skin' ? <PaletteSwatch palette={paletteFor(hero.race, item.id)} /> : <ItemIcon item={item} />}</span>
      <div className="hitem__body">
        <p className="hitem__title">{item.title}</p>
        <p className="muted small">{item.blurb}</p>
        <p className="hitem__meta">
          {state !== 'equipped' && state !== 'owned' && state !== 'earn' && (
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
          {on ? (
                <>
                  <Icon name="check" size={12} /> Puesta
                </>
              ) : (
                'Usar'
              )}
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
  const xp = useTotalXp();
  const events = useData((s) => s.xpEvents);
  const sheet = useMemo(() => characterSheet(events, today()), [events]);
  const level = sheet.level.level;

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
          kicker="Tu personaje"
          title={hero ? 'Cambiar raza o nombre' : 'Crea tu héroe'}
          sprite="knight"
          right={wallet}
          hint="Tu héroe crece contigo: cada hábito y cada tarea alimenta uno de sus seis atributos, y con las monedas le compras armas, poderes y skins."
        />
        <RacePicker current={hero} onDone={() => setEditing(false)} />
      </div>
    );

  const r = raceOf(hero.race);
  // Lo que se ve: el héroe tal cual, o probándose algo de la tienda.
  const shown: Hero = preview ? { ...hero, [preview.slot]: preview.id } : hero;
  const lp = levelProgress(xp);
  // La clase guardada (con memoria); si aún no hay, la que dicen los números.
  const cls = classOf(isClassId(profile.characterClass) ? profile.characterClass : classFor(attributeTotals(events)));
  const toggle = (s: HeroSlot, id: string | null) => setPreview((p) => (p && p.slot === s && p.id === id ? null : { slot: s, id }));
  const previewTitle = preview ? (preview.id ? itemsFor(preview.slot).find((i) => i.id === preview.id)?.title : 'Original') : null;

  const evolve = () => {
    evolveHero();
    setPreview(null);
    setCelebrate((c) => c + 1);
  };

  return (
    <div className="stack">
      <PageHead kicker="Tu personaje" title="Personaje" sprite="knight" right={wallet} />

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
              <p className="charclass">
                <span className="charclass__name">{cls.name}</span>
                {cls.pair.length > 0 && <span className="charclass__pair">{classPairText(cls)}</span>}
              </p>
              <p className="small muted charclass__blurb">{cls.blurb}</p>
              <span className="tag tag--xp">
                Etapa {hero.stage + 1}/4 · {stageName(hero.race, hero.stage)}
              </span>
            </div>
            <Button small onClick={() => setEditing(true)}>
              Cambiar raza o nombre
            </Button>
          </div>
          <div className="charlevel">
            <p className="charlevel__n" aria-label={`Nivel de personaje ${lp.level}`}>
              <span className="charlevel__tag" aria-hidden="true">Nivel</span>
              {lp.level}
            </p>
            <div className="charlevel__bar">
              <Bar pct={lp.pct} tone="yellow" tall label={`${lp.into} de ${lp.needed} XP para el nivel ${lp.level + 1}`} />
              <p className="small muted">
                {coins(lp.left)} XP para el nivel {lp.level + 1} · {coins(sheet.totalXp)} XP entre los seis atributos
              </p>
            </div>
          </div>
          <Evolution hero={hero} level={level} xp={xp} onEvolve={evolve} />
        </section>

        <div className="stack">
          <section className="panel attrs" aria-labelledby="hero-attrs">
            <h2 id="hero-attrs" className="section-title">
              Tus atributos
            </h2>
            <p className="muted small attrs__lead">Cada hábito y cada tarea alimenta los atributos de su categoría. Toca uno para ver qué lo hace crecer.</p>
            <AttributeRadar attributes={sheet.attributes} />
            <AttributeSheet attributes={sheet.attributes} />
          </section>

          <section className="panel" aria-labelledby="hero-shop">
            <div className="split hero-shop__head">
              <h2 id="hero-shop" className="section-title">
                Tienda del héroe
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
