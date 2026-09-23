import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { agoLabel } from '@/core/dates';
import type { AppNotification } from '@/core/domain';
import { Button, ConfirmModal, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import type { SpriteName } from '@/ui/sprites';
import { TaskModal } from '../modals/TaskModal';
import { HabitModal } from '../modals/HabitModal';
import { CourseModal, GoalModal, ProjectModal, RewardModal } from '../modals/EntityModals';
import { SessionModal } from '../modals/SessionModal';
import { QuickSheet, WelcomeModal } from '../modals/QuickAndWelcome';
import { CardsModal } from '../modals/CardsModal';
import { CertificationModal } from '../modals/CertificationModal';
import { ChainModal } from '../modals/ChainModal';
import { AiKeyModal } from '../modals/AiKeyModal';
import { ConceptGuide } from '../help/ConceptGuide';

const CATEGORY: Record<AppNotification['category'], { sprite: SpriteName; label: string }> = {
  mentor: { sprite: 'cap', label: 'Mentor' },
  mission: { sprite: 'qblock', label: 'Misión' },
  streak: { sprite: 'fire', label: 'Racha' },
  achievement: { sprite: 'trophy', label: 'Logro' },
  alert: { sprite: 'ghost', label: 'Alerta' },
  shop: { sprite: 'coin', label: 'Tienda' },
};

function ModalHost() {
  const modal = useUi((s) => s.modal);
  if (!modal) return null;
  switch (modal.type) {
    case 'task':
      return <TaskModal key={`${modal.id ?? 'new'}${modal.dueDate ?? ''}`} id={modal.id} dueDate={modal.dueDate} />;
    case 'ai':
      return <AiKeyModal />;
    case 'guide':
      return <ConceptGuide />;
    case 'cards':
      return <CardsModal key={modal.topicId} courseId={modal.courseId} topicId={modal.topicId} />;
    case 'habit':
      return <HabitModal key={modal.id ?? 'new'} id={modal.id} />;
    case 'course':
      return <CourseModal key={modal.id ?? 'new'} id={modal.id} />;
    case 'goal':
      return <GoalModal />;
    case 'project':
      return <ProjectModal />;
    case 'reward':
      return <RewardModal />;
    case 'certification':
      return <CertificationModal key={modal.id ?? 'new'} id={modal.id} />;
    case 'chain':
      return <ChainModal key={modal.id ?? 'new'} id={modal.id} />;
    case 'session':
      return <SessionModal courseId={modal.courseId} minutes={modal.minutes} />;
    case 'quick':
      return <QuickSheet />;
    case 'welcome':
      return <WelcomeModal />;
    case 'confirm':
      return <ConfirmModal title={modal.title} body={modal.body} confirmLabel={modal.confirmLabel} onConfirm={modal.onConfirm} />;
    default:
      return null;
  }
}

function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  const navigate = useNavigate();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={cx('toast', `toast--${t.kind}`)} onClick={() => {
            dismiss(t.id);
            if (t.to) navigate(t.to);
          }}
        >
          {t.kind === 'xp' && <span className="toast__xp">+{t.xp}</span>}
          {t.kind === 'unlock' && <Sprite name="trophy" size={30} />}
          {t.kind === 'error' && <Sprite name="skull" size={28} />}
          {t.kind === 'info' && <Sprite name="mushroom" size={28} />}
          {t.kind === 'reminder' && <Sprite name="fire" size={30} className="toast__shake" />}
          <span className="toast__text">
            <span className="toast__title">{t.title}</span>
            {t.body && <span className="toast__body">{t.body}</span>}
          </span>
          {!!t.coins && (
            <span className="toast__coins">
              <Sprite name="coin" size={14} />+{t.coins}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function CoinRain() {
  const coins = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ left: (i * 37 + 11) % 100, delay: ((i * 13) % 20) / 10, dur: 1.8 + ((i * 7) % 12) / 10, size: 16 + ((i * 5) % 3) * 6 })), []);
  return (
    <div className="coin-rain" aria-hidden="true">
      {coins.map((c, i) => (
        <span key={i} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }}>
          <Sprite name="coin" size={c.size} />
        </span>
      ))}
    </div>
  );
}

function LevelUp() {
  const levelUp = useUi((s) => s.levelUp);
  // Si a la vez se derrota a un jefe, primero la victoria y después la subida de nivel.
  const waiting = useUi((s) => s.victory !== null);
  const info = waiting ? null : levelUp;
  const show = useUi((s) => s.showLevelUp);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!info) return;
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && show(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [info, show]);
  if (!info) return null;
  return (
    <div className="levelup" role="alertdialog" aria-modal="true" aria-labelledby="lu-title">
      <CoinRain />
      <div className="levelup__card">
        <p className="levelup__blink">★ ¡Subida de nivel! ★</p>
        <h2 id="lu-title" className="levelup__level">
          Nivel {info.level}
        </h2>
        <p className="levelup__rank">{info.rank}</p>
        <ul className="levelup__list">
          <li>
            <Sprite name="flag" size={26} />
            <div>
              <b>Mundo {info.world} desbloqueado</b>
              <span>Sigue avanzando, jugador</span>
            </div>
          </li>
          <li>
            <Sprite name="coin" size={26} />
            <div>
              <b>+{info.bonus.toLocaleString('en-US')} monedas</b>
              <span>Ya sabes en qué gastarlas: visita el Arsenal</span>
            </div>
          </li>
          <li>
            <Sprite name="star" size={26} />
            <div>
              <b>Nuevo rango: {info.rank}</b>
              <span>Presúmelo en tu perfil</span>
            </div>
          </li>
        </ul>
        <button ref={btn} type="button" className="btn btn--ink" onClick={() => show(null)}>
          Reclamar y seguir
        </button>
      </div>
    </div>
  );
}

function Victory() {
  const info = useUi((s) => s.victory);
  const show = useUi((s) => s.showVictory);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!info) return;
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && show(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [info, show]);
  if (!info) return null;
  return (
    <div className="levelup victory" role="alertdialog" aria-modal="true" aria-labelledby="vic-title">
      <CoinRain />
      <div className="levelup__card victory__card">
        <p className="levelup__blink">★ ¡Victoria! ★</p>
        <div className="victory__stage" aria-hidden="true">
          <span className="victory__boss">
            <Sprite name="boss" size={84} />
          </span>
          <span className="victory__hero">
            <Sprite name="runnerB" size={84} />
          </span>
          <span className="victory__flag">
            <Sprite name="flag" size={60} />
          </span>
        </div>
        <h2 id="vic-title" className="levelup__level victory__title">
          ¡Jefe derrotado!
        </h2>
        <p className="levelup__rank">{info.title}</p>
        <ul className="levelup__list">
          <li>
            <Sprite name="star" size={26} />
            <div>
              <b>+{info.xp.toLocaleString('en-US')} XP</b>
              <span>Incluye el botín de jefe</span>
            </div>
          </li>
          <li>
            <Sprite name="coin" size={26} />
            <div>
              <b>+{info.coins.toLocaleString('en-US')} monedas</b>
              <span>Gástalas en el Arsenal</span>
            </div>
          </li>
          {info.hits > 0 && (
            <li>
              <Sprite name="sword" size={26} />
              <div>
                <b>{info.hits} {info.hits === 1 ? 'golpe' : 'golpes'} certeros</b>
                <span>Una subtarea por golpe</span>
              </div>
            </li>
          )}
        </ul>
        <button ref={btn} type="button" className="btn btn--ink" onClick={() => show(null)}>
          Reclamar y seguir
        </button>
      </div>
    </div>
  );
}

function NotificationsDrawer() {
  const open = useUi((s) => s.notifOpen);
  const setOpen = useUi((s) => s.setNotifOpen);
  const notifications = useData((s) => s.notifications);
  const markAllRead = useData((s) => s.markAllRead);
  const sorted = useMemo(() => [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40), [notifications]);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="drawer-root">
      <div className="modal-backdrop" onClick={() => setOpen(false)} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Notificaciones">
        <div className="modal__head">
          <div>
            <p className="kicker">// {unread} sin leer</p>
            <h2 className="modal__title">Mensajes</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {unread > 0 && (
          <div className="drawer__bar">
            <Button small onClick={markAllRead}>
              Marcar todo como leído
            </Button>
          </div>
        )}
        {sorted.length === 0 && <p className="muted drawer__empty">Sin mensajes. Un Toad te avisará cuando pase algo.</p>}
        <ul className="notifs">
          {sorted.map((n) => (
            <li key={n.id} className={cx('notif', !n.read && 'is-unread')}>
              <Sprite name={CATEGORY[n.category].sprite} size={26} />
              <div>
                <p className="kicker">
                  {CATEGORY[n.category].label} · {agoLabel(n.createdAt)}
                </p>
                <p className="notif__title">{n.title}</p>
                <p className="muted small">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export function Overlays() {
  return (
    <>
      <ModalHost />
      <NotificationsDrawer />
      <Toasts />
      <LevelUp />
      <Victory />
    </>
  );
}
