import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { worldIdOf, worldTheme, worldTitle } from '@/core/themes';
import { sfx } from '@/audio/sfx';
import { Button, Segmented } from '@/ui/kit';

/** Apariencia, sonido y movimiento: todo lo que cambia cómo se siente la app, en un solo sitio. */
export function ExperiencePanel() {
  const { theme, sound, volume, motion, toggleTheme, toggleSound, setVolume, setMotion } = useUi();
  const equipped = useData((s) => s.profile.equipped.world);
  const world = worldTheme(worldIdOf(equipped));
  const pct = Math.round(volume * 100);

  return (
    <div className="experience">
      <div className="experience__row">
        <div>
          <p className="experience__label">Mundo</p>
          <p className="muted small">
            {worldTitle(world)} · {world.style}
          </p>
        </div>
        <Link className="btn btn--sm" to="/arsenal">
          Cambiar
        </Link>
      </div>

      <div className="experience__row">
        <p className="experience__label">Modo</p>
        <Button small onClick={toggleTheme} aria-label={`Modo ${theme === 'dark' ? 'noche' : 'día'}. Pulsa para cambiar a ${theme === 'dark' ? 'día' : 'noche'}`}>
          {theme === 'dark' ? 'Noche' : 'Día'}
        </Button>
      </div>

      <div className="experience__row">
        <p className="experience__label">Efectos de sonido</p>
        <Button small onClick={toggleSound} aria-label={`Efectos de sonido: ${sound ? 'activados' : 'apagados'}. Pulsa para ${sound ? 'apagarlos' : 'activarlos'}`}>
          {sound ? 'Activados' : 'Apagados'}
        </Button>
      </div>

      <label className="experience__vol">
        <span className="experience__label">Volumen</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          disabled={!sound}
          aria-valuetext={`${pct} %`}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          // Una muestra al soltar: oír el volumen elegido sin un pitido por cada paso.
          onPointerUp={() => sfx.coin()}
          onKeyUp={(e) => e.key.startsWith('Arrow') && sfx.coin()}
        />
        <span className="experience__pct">{pct} %</span>
      </label>
      <p className="muted small">El sonido de cada efecto cambia con el mundo equipado. Nunca suena nada al abrir la app.</p>

      <div className="experience__row experience__row--stack">
        <p className="experience__label">Animaciones</p>
        <Segmented
          label="Animaciones"
          value={motion}
          onChange={setMotion}
          options={[
            { value: 'system', label: 'Según el sistema' },
            { value: 'reduce', label: 'Reducidas' },
          ]}
        />
      </div>
    </div>
  );
}
