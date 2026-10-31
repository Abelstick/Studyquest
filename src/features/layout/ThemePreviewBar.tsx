import { useEffect } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { shopItem } from '@/core/catalog';
import { worldTheme, worldTitle } from '@/core/themes';
import { Button } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/**
 * Aviso fijo mientras se prueba un mundo: deja claro que es una prueba (no cuesta ni se guarda) y ofrece
 * quedárselo o salir. Escape también sale, salvo que haya un modal abierto (entonces Escape es del modal).
 */
export function ThemePreviewBar() {
  const preview = useUi((s) => s.preview);
  const endPreview = useUi((s) => s.endPreview);
  const profile = useData((s) => s.profile);
  const { buy, equip } = useData();

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useUi.getState().modal) endPreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, endPreview]);

  if (!preview) return null;
  const theme = worldTheme(preview.world);
  const title = worldTitle(theme);
  const item = shopItem(theme.itemId);
  const owned = !theme.itemId || profile.inventory.includes(theme.itemId);
  const missing = item ? item.price - profile.credits : 0;

  return (
    <div className="pbar" role="region" aria-label="Vista previa de mundo">
      <p className="pbar__text" role="status">
        <span className="pbar__kicker">Vista previa</span>
        <b>{title}</b>
        <span className="pbar__note">Gratis y sin guardar</span>
      </p>
      <div className="pbar__actions">
        {owned ? (
          <Button small variant="primary" onClick={() => equip('world', theme.itemId)}>
            Equipar
          </Button>
        ) : item && missing > 0 ? (
          <Button small disabled>
            Faltan {missing.toLocaleString('en-US')}
          </Button>
        ) : item ? (
          <Button small variant="coin" onClick={() => buy(item.id)} aria-label={`Canjear ${title} por ${item.price} monedas`}>
            <Sprite name="coin" size={12} /> {item.price.toLocaleString('en-US')}
          </Button>
        ) : null}
        <Button small onClick={endPreview} aria-label="Salir de la vista previa (Escape)">
          Salir
        </Button>
      </div>
    </div>
  );
}
