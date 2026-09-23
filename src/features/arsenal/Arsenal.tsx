import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { SHOP, type ShopItem } from '@/core/catalog';
import { ACHIEVEMENTS } from '@/core/achievements';
import { shortDate } from '@/core/dates';
import type { Equipped } from '@/core/domain';
import { Bar, Button, Empty, PageHead, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const EQUIP_KEY: Partial<Record<ShopItem['kind'], keyof Equipped>> = { avatar: 'avatar', frame: 'frame', world: 'world' };

function ShopCard({ item }: { item: ShopItem }) {
  const profile = useData((s) => s.profile);
  const { buy, equip } = useData();
  const owned = profile.inventory.includes(item.id);
  const slot = EQUIP_KEY[item.kind];
  const equipped = slot ? profile.equipped[slot] === item.id : false;
  const missing = item.price - profile.credits;
  const unavailable = !!item.locked || (!owned && missing > 0);

  let cta: React.ReactNode;
  if (item.locked) cta = <Button small disabled>Bloqueado</Button>;
  else if (owned && !item.consumable && slot)
    cta = (
      <Button small variant={equipped ? 'green' : 'primary'} onClick={() => equip(slot, equipped ? null : item.id)} aria-pressed={equipped}>
        {equipped ? '✔ Equipado' : 'Equipar'}
      </Button>
    );
  else if (owned && !item.consumable) cta = <span className="tag tag--green">En tu colección</span>;
  else if (missing > 0) cta = <Button small disabled>Faltan {missing}</Button>;
  else
    cta = (
      <Button small variant="coin" onClick={() => buy(item.id)}>
        Canjear
      </Button>
    );

  return (
    <article className={cx('shopcard', unavailable && 'is-dim', equipped && 'is-equipped')}>
      <div className="shopcard__art">
        {/* El personaje se mueve ya en la tienda: así ves su carácter antes de comprarlo. */}
        <span className={cx('idle', item.idle && `idle--${item.idle}`)}>
          <Sprite name={item.sprite} size={54} />
        </span>
      </div>
      <div>
        <p className="kicker">{item.category}</p>
        <h3 className="shopcard__title">{item.title}</h3>
      </div>
      <div className="split shopcard__foot">
        <span className="price">
          <Sprite name="coin" size={14} /> {item.price.toLocaleString('en-US')}
        </span>
        {cta}
      </div>
    </article>
  );
}

export default function Arsenal() {
  const profile = useData((s) => s.profile);
  const rewards = useData((s) => s.personalRewards);
  const { bumpReward, claimReward, deleteReward } = useData();
  const openModal = useUi((s) => s.openModal);
  const unlocked = new Map(profile.achievements.map((a) => [a.id, a.at]));

  return (
    <div className="stack">
      <PageHead
        kicker="// Tienda de Toad"
        title="Recompensas y logros"
        sprite="mushroom"
        right={
          <div className="wallet" aria-label={`${profile.credits} monedas`}>
            <Sprite name="coin" size={22} />
            <span className="wallet__n">{profile.credits.toLocaleString('en-US')}</span>
            {profile.streakFreezes > 0 && <span className="tag tag--blue">❄ ×{profile.streakFreezes}</span>}
          </div>
        }
      />

      <div className="grid grid--shop">
        {SHOP.map((i) => (
          <ShopCard key={i.id} item={i} />
        ))}
      </div>

      <div className="cols">
        <section aria-labelledby="logros">
          <h2 id="logros" className="section-title">
            // Logros — {unlocked.size} de {ACHIEVEMENTS.length}
          </h2>
          <div className="grid grid--badges">
            {ACHIEVEMENTS.map((a) => {
              const at = unlocked.get(a.id);
              return (
                <div key={a.id} className={cx('badge-card', !at && 'is-locked')}>
                  <div className="badge-card__icon">
                    <Sprite name={a.sprite} size={30} />
                  </div>
                  <p className="badge-card__title">{a.title}</p>
                  <p className="muted small">{at ? `Conseguido · ${shortDate(at.slice(0, 10))}` : a.hint}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="personales">
          <h2 id="personales" className="section-title">
            // Recompensas personales
          </h2>
          {rewards.length === 0 && (
            <Empty sprite="heart" title="Sin premios todavía">
              <p>Ponte un premio de la vida real: una peli, una cena, ese teclado…</p>
            </Empty>
          )}
          <ul className="rewards">
            {rewards.map((r) => {
              const ready = r.current >= r.target;
              return (
                <li key={r.id} className={cx('reward', r.claimed && 'is-claimed')}>
                  <div className="split split--top">
                    <div>
                      <p className="reward__title">{r.title}</p>
                      <p className="muted small">
                        {r.condition || 'Sin condición'} · {r.current}/{r.target}
                      </p>
                    </div>
                    <button type="button" className="icon-btn icon-btn--sm" aria-label={`Borrar ${r.title}`} onClick={() => deleteReward(r.id)}>
                      ✕
                    </button>
                  </div>
                  <Bar pct={(r.current / r.target) * 100} tone={ready ? 'green' : 'yellow'} label={`Avance de ${r.title}`} />
                  <div className="row">
                    {r.claimed ? (
                      <span className="tag tag--green">¡Disfrutado!</span>
                    ) : ready ? (
                      <Button small variant="coin" onClick={() => claimReward(r.id)}>
                        ¡Reclamar premio!
                      </Button>
                    ) : (
                      <>
                        <Button small onClick={() => bumpReward(r.id, 1)}>
                          +1 avance
                        </Button>
                        <Button small onClick={() => bumpReward(r.id, -1)} disabled={r.current === 0} aria-label="Restar avance">
                          −1
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Button onClick={() => openModal({ type: 'reward' })}>＋ Crear recompensa personal</Button>
        </section>
      </div>
    </div>
  );
}
