import { useJukebox } from '@/state/jukebox';
import { useUi } from '@/state/ui';
import { TRACKS, TRACK_LIST } from '@/audio/music';
import { Button, Panel, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

/**
 * Reproductor de la música de fondo, sintetizada con Web Audio: no hay archivos que descargar,
 * así que también suena sin conexión. Varias pistas son canciones reales y conocidas, nota por
 * nota, todas de dominio público (Korobeiniki de Tetris, el Himno de la Alegría, Para Elisa,
 * Estrellita); el resto son composiciones originales de la app.
 */
export function Jukebox() {
  const { track, playing, volume, shuffle, play, toggle, next, prev, setVolume, toggleShuffle } = useJukebox();
  const sound = useUi((s) => s.sound);
  const toggleSound = useUi((s) => s.toggleSound);
  const now = TRACKS[track];

  return (
    <Panel kicker="// Banda sonora" title="Reproductor" right={<Sprite name="note" size={26} className={cx(playing && 'idle idle--bob')} />}>
      {!sound && (
        <p className="form__error" role="status">
          El sonido está apagado, así que no oirás nada.{' '}
          <button type="button" className="link" onClick={toggleSound}>
            Encender el sonido
          </button>
        </p>
      )}

      <div className="jb__now">
        <span className={cx('jb__disc', playing && 'is-spinning')} aria-hidden="true">
          <Sprite name="coin" size={34} />
        </span>
        <div className="grow">
          <p className="jb__title">{now.title}</p>
          <p className="muted small">
            {now.mood} · {now.bpm} BPM {playing ? '· sonando' : '· en pausa'}
          </p>
        </div>
      </div>

      <div className="jb__controls">
        <Button small onClick={prev} aria-label="Canción anterior">
          ⏮
        </Button>
        <Button variant="primary" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'} aria-pressed={playing}>
          {playing ? '⏸ Pausa' : '▶ Reproducir'}
        </Button>
        <Button small onClick={next} aria-label="Canción siguiente">
          ⏭
        </Button>
        <Button small onClick={toggleShuffle} aria-pressed={shuffle} aria-label="Orden aleatorio" className={cx(shuffle && 'is-on')}>
          🔀 {shuffle ? 'Aleatorio' : 'En orden'}
        </Button>
      </div>

      <label className="jb__vol">
        <span className="kicker">Volumen</span>
        <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={(e) => setVolume(Number(e.target.value) / 100)} aria-label="Volumen de la música" />
        <span className="muted small">{Math.round(volume * 100)}%</span>
      </label>

      <ol className="jb__list">
        {TRACK_LIST.map((id, i) => {
          const t = TRACKS[id];
          const active = id === track;
          return (
            <li key={id}>
              <button type="button" className={cx('jb__track', active && 'is-on')} onClick={() => play(id)} aria-current={active || undefined}>
                <span className="jb__n">{active && playing ? '♪' : i + 1}</span>
                <span className="grow">
                  <b>{t.title}</b>
                  <span className="muted small"> · {t.mood}</span>
                </span>
                <span className="muted small">{t.bpm}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="muted small">
        «Korobeiniki» (el tema de Tetris), el «Himno de la Alegría», «Para Elisa» y «Estrellita» son canciones reales, nota por nota — todas de dominio público, así que se pueden tocar sin infringir nada.
        Las demás son composiciones originales de StudyQuest. Todas se sintetizan en el momento, sin archivos de audio, por eso funciona también sin conexión. Durante una sesión de Pomodoro manda la música de
        la sesión y, al terminar, vuelve lo que estuvieras escuchando.
      </p>
    </Panel>
  );
}
