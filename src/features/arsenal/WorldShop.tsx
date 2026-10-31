import { useEffect, useRef, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { shopItem } from '@/core/catalog';
import { WORLD_THEMES, worldIdOf, worldTitle, type WorldTheme } from '@/core/themes';
import { Button, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';

/**
 * Maqueta en miniatura de la app pintada con el CSS real del mundo (atributo data-world-preview): barra lateral,
 * HUD, un panel con su barra de progreso y la acción principal. Es decorativa: la ficha la describe con texto.
 */
export function WorldPreview({ world }: { world: string | null }) {
  return (
    <div className="wpreview" data-world-preview={world ?? 'classic'} aria-hidden="true">
      <div className="wpreview__side">
        <span className="wpreview__brand">SQ</span>
        <span className="wpreview__nav is-on" />
        <span className="wpreview__nav" />
        <span className="wpreview__nav" />
      </div>
      <div className="wpreview__main">
        <span className="wpreview__hud" />
        <div className="wpreview__panel">
          <span className="wpreview__title">Siguiente paso</span>
          <span className="wpreview__bar" />
          <span className="wpreview__row">
            <span className="wpreview__btn wpreview__btn--primary" />
            <span className="wpreview__btn" />
          </span>
        </div>
      </div>
    </div>
  );
}

type State = 'active' | 'preview' | 'owned' | 'locked';
const STATE_LABEL: Record<State, string> = { active: 'Activo', preview: 'Probándolo', owned: 'En tu colección', locked: 'Por desbloquear' };

function WorldCard({ theme }: { theme: WorldTheme }) {
  const profile = useData((s) => s.profile);
  const { buy, equip } = useData();
  const preview = useUi((s) => s.preview);
  const { startPreview, endPreview } = useUi();

  const item = shopItem(theme.itemId);
  const title = worldTitle(theme);
  const owned = !theme.itemId || profile.inventory.includes(theme.itemId);
  const active = worldIdOf(profile.equipped.world) === theme.world;
  const previewing = !!preview && preview.world === theme.world;
  const state: State = previewing ? 'preview' : active ? 'active' : owned ? 'owned' : 'locked';
  const missing = item ? item.price - profile.credits : 0;

  // Recién desbloqueado: la ficha celebra la compra un momento (la recompensa se ve, no solo se lee).
  const [fresh, setFresh] = useState(false);
  const wasOwned = useRef(owned);
  useEffect(() => {
    if (owned && !wasOwned.current) {
      setFresh(true);
      const t = setTimeout(() => setFresh(false), 1600);
      wasOwned.current = owned;
      return () => clearTimeout(t);
    }
    wasOwned.current = owned;
  }, [owned]);

  let main: React.ReactNode;
  if (active) main = null;
  else if (owned)
    main = (
      <Button small variant="primary" onClick={() => equip('world', theme.itemId)} aria-label={`Equipar ${title}`}>
        Equipar
      </Button>
    );
  else if (!item || item.locked) main = <Button small disabled>No disponible</Button>;
  else if (missing > 0)
    main = (
      <Button small disabled aria-label={`Te faltan ${missing} monedas para ${title}`}>
        Faltan {missing.toLocaleString('en-US')}
      </Button>
    );
  else
    main = (
      <Button small variant="coin" onClick={() => buy(item.id)} aria-label={`Canjear ${title} por ${item.price} monedas`}>
        Canjear
      </Button>
    );

  return (
    <article className={cx('worldcard', `worldcard--${state}`, fresh && 'is-fresh')} aria-labelledby={`wc-${theme.world ?? 'classic'}`}>
      <WorldPreview world={theme.world} />
      <div className="worldcard__body">
        <div className="split split--top">
          <div>
            <p className="kicker">{theme.style}</p>
            <h3 id={`wc-${theme.world ?? 'classic'}`} className="worldcard__title">
              {title}
            </h3>
          </div>
          <span className={cx('worldcard__state', `worldcard__state--${state}`)}>
            {state === 'locked' ? <Icon name="lock" size={12} /> : state === 'active' ? <Icon name="check" size={12} /> : null}
            {STATE_LABEL[state]}
          </span>
        </div>
        <p className="worldcard__desc">{theme.description}</p>
        <ul className="worldcard__traits" aria-label="Qué cambia">
          {theme.traits.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="worldcard__fx">
          <span className="sr-only">Efectos: </span>
          {theme.effects.join(' · ')}
        </p>
      </div>
      <div className="worldcard__foot">
        <span className="price">
          {item ? (
            <>
              <Sprite name="coin" size={14} /> {item.price.toLocaleString('en-US')}
            </>
          ) : (
            'Gratis'
          )}
        </span>
        <div className="row">
          {!active && (
            <Button small aria-pressed={previewing} onClick={() => (previewing ? endPreview() : startPreview(theme.world))} aria-label={previewing ? `Dejar de probar ${title}` : `Probar ${title} sin comprarlo`}>
              {previewing ? 'Dejar de probar' : 'Probar'}
            </Button>
          )}
          {main}
        </div>
      </div>
    </article>
  );
}

/** Los mundos visuales, con su ficha completa y vista previa. Compra y equipo usan las mismas acciones de siempre. */
export function WorldShop() {
  const worlds = [...WORLD_THEMES].sort((a, b) => (shopItem(a.itemId)?.price ?? 0) - (shopItem(b.itemId)?.price ?? 0));
  return (
    <section aria-labelledby="mundos" className="worldshop">
      <h2 id="mundos" className="section-title">
        Mundos visuales
      </h2>
      <p className="worldshop__hint">Cada mundo cambia toda la interfaz: colores, formas, letra, barra lateral, animaciones y sonido. Pruébalo gratis antes de canjearlo.</p>
      <div className="grid grid--worlds">
        {worlds.map((t) => (
          <WorldCard key={t.world ?? 'classic'} theme={t} />
        ))}
      </div>
    </section>
  );
}
