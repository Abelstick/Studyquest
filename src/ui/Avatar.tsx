import type { Profile } from '@/core/domain';
import { initials } from '@/core/game';
import { shopItem } from '@/core/catalog';
import { Sprite } from './Sprite';
import { cx } from './kit';

/**
 * Avatar del jugador: sprite equipado o, si no hay, sus iniciales sobre un bloque.
 * Cada personaje tiene su propio movimiento de reposo (el fantasma flota, el slime se aplasta…),
 * así que el avatar nunca está del todo quieto. Se detiene con «reducir movimiento».
 */
export function Avatar({ profile, size = 48, className, still }: { profile: Pick<Profile, 'displayName' | 'equipped'>; size?: number; className?: string; still?: boolean }) {
  const avatar = shopItem(profile.equipped.avatar);
  const frame = profile.equipped.frame?.replace('frame-', '');
  return (
    <div className={cx('avatar', frame && `avatar--${frame}`, className)} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}>
      {avatar ? (
        <span className={cx('idle', !still && avatar.idle && `idle--${avatar.idle}`)}>
          <Sprite name={avatar.sprite} size={Math.round(size * 0.66)} />
        </span>
      ) : (
        <span aria-hidden="true">{initials(profile.displayName)}</span>
      )}
    </div>
  );
}
