import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sfx } from '@/audio/sfx';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { dataLayer, useData } from '@/state';
import { useUi } from '@/state/ui';
import { today, longDate, weekStart } from '@/core/dates';
import { WEEKLY_BONUS_XP, computeStreak, hoursInWeek, isDueOn, isHabitDone, levelProgress, logFor, rankFor, worldFor } from '@/core/game';
import { Avatar } from '@/ui/Avatar';
import { Loader } from '@/ui/Loader';
import { Bar, Button, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';
import { Scramble } from '@/ui/motion';
import { WorldStage } from '@/ui/WorldStage';
import { SectionTabs, sectionTabId } from '@/ui/SectionTabs';
import { SECTIONS, navFor, newKindFor, rememberTab, sectionHref, tabsOf, type SectionId } from './nav';
import { useShortcuts } from './useShortcuts';
import { useTour } from '@/features/modals/TourModal';
import { Overlays } from './Overlays';
import { SearchBox } from './SearchBox';
import { useOnline, useSyncPending } from '@/pwa/hooks';
import { useHabitReminders } from '@/pwa/useHabitReminders';
import { usePomodoro } from '@/state/pomodoro';
import { useAiAccountSync } from '@/ai/useAiAccountSync';
import { usePomodoroEngine } from '@/features/pomodoro/usePomodoroEngine';
import { dueReviews } from '@/core/review';
import { PHASE_LABEL, formatClock } from '@/core/pomodoro';

function useRouteTitle(): string {
  const { pathname } = useLocation();
  const { courses, tasks, habits, goals, projects, profile } = useData();
  const id = pathname.split('/')[2];
  switch (navFor(pathname).to) {
    case '/':
      return longDate(today());
    case '/cursos':
      return id ? (courses.find((c) => c.id === id)?.title ?? 'Curso') : `${courses.length} ${courses.length === 1 ? 'curso activo' : 'cursos activos'}`;
    case '/tareas':
      return `${tasks.filter((t) => t.status !== 'done').length} contratos abiertos`;
    case '/ciudad':
      return 'Construye tu ciudad';
    case '/planificador':
      return 'Tu ruta con fechas';
    case '/calendario':
      return 'Fechas límite y repasos';
    case '/repaso':
      return 'Repaso espaciado';
    case '/pomodoro':
      return 'Enfócate y corre';
    case '/habitos':
      return id ? (habits.find((h) => h.id === id)?.title ?? 'Hábito') : `${habits.length} hábitos equipados`;
    case '/metas':
      return goals[0]?.title ?? 'Tus objetivos';
    case '/proyectos':
      return `${projects.length} ${projects.length === 1 ? 'proyecto' : 'proyectos'}`;
    case '/progreso':
      return 'Tu hoja de personaje';
    case '/arsenal':
      return 'Tienda y logros';
    default:
      return profile.displayName;
  }
}

interface SectionBadge {
  count: number;
  /** Qué cuenta, para el lector de pantalla y el `title`. */
  label: string;
  tone: 'plain' | 'warn';
}

/**
 * Insignias de las secciones: solo aparecen si hay algo que hacer hoy (tareas vencidas o de hoy,
 * hábitos pendientes, flashcards que tocan). Nada de contadores decorativos.
 */
function useSectionBadges(): Partial<Record<SectionId, SectionBadge>> {
  const courses = useData((s) => s.courses);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  return useMemo(() => {
    const day = today();
    const open = tasks.filter((t) => t.status !== 'done' && t.dueDate !== null && t.dueDate <= day);
    const late = open.some((t) => (t.dueDate as string) < day);
    const pendingHabits = habits.filter((h) => isDueOn(h, day, habitLogs) && !isHabitDone(h, logFor(habitLogs, h.id, day))).length;
    const reviews = dueReviews({ courses }).length;
    const out: Partial<Record<SectionId, SectionBadge>> = {};
    if (reviews > 0) out.estudiar = { count: reviews, label: `${reviews} ${reviews === 1 ? 'repaso para hoy' : 'repasos para hoy'}`, tone: 'plain' };
    if (open.length > 0) out.planear = { count: open.length, label: `${open.length} ${open.length === 1 ? 'tarea vencida o para hoy' : 'tareas vencidas o para hoy'}`, tone: late ? 'warn' : 'plain' };
    if (pendingHabits > 0) out.lograr = { count: pendingHabits, label: `${pendingHabits} ${pendingHabits === 1 ? 'hábito pendiente hoy' : 'hábitos pendientes hoy'}`, tone: 'plain' };
    return out;
  }, [courses, tasks, habits, habitLogs]);
}

/** Adónde lleva una sección: la pestaña actual si ya estás en ella, si no, la última visitada. */
function useSectionLinks() {
  const { pathname } = useLocation();
  const item = navFor(pathname);
  return {
    active: item.section,
    hrefFor: (id: SectionId) => (id === item.section && !item.hidden ? item.to : sectionHref(id)),
  };
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function Sidebar() {
  const profile = useData((s) => s.profile);
  const sessions = useData((s) => s.sessions);
  const claim = useData((s) => s.claimWeeklyBonus);
  const navOpen = useUi((s) => s.navOpen);
  const setNavOpen = useUi((s) => s.setNavOpen);
  const setSideHidden = useUi((s) => s.setSideHidden);
  const { level, into, needed, pct } = levelProgress(profile.xp);
  const sound = useUi((s) => s.sound);
  const toggleSound = useUi((s) => s.toggleSound);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const openModal = useUi((s) => s.openModal);
  const badges = useSectionBadges();
  const { active, hrefFor } = useSectionLinks();
  const asideRef = useRef<HTMLElement>(null);

  // Drawer móvil: Escape lo cierra, el foco no se escapa mientras está abierto y vuelve al botón ☰ al cerrarse.
  useEffect(() => {
    const aside = asideRef.current;
    if (!navOpen || !aside) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => Array.from(aside.querySelectorAll<HTMLElement>(FOCUSABLE));
    focusables()[0]?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setNavOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || !aside.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !aside.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [navOpen, setNavOpen]);

  const from = weekStart(today());
  const hours = hoursInWeek(sessions, from);
  const goal = Math.max(1, profile.weeklyGoalHours);
  const reached = hours >= goal;
  const claimed = profile.weeklyBonusClaimed === from;

  return (
    <>
      <div className={cx('scrim', navOpen && 'is-on')} onClick={() => setNavOpen(false)} />
      <aside ref={asideRef} id="menu-principal" className={cx('sidebar', navOpen && 'is-open')} aria-label="Menú principal" role={navOpen ? 'dialog' : undefined} aria-modal={navOpen || undefined}>
        <div className="brand">
          <Sprite name="coin" size={26} className="brand__coin" />
          <div>
            <p className="brand__name">
              Study<span>Quest</span>
            </p>
            <p className="brand__build">
              v{__APP_VERSION__} <span className="brand__beta">beta</span>
            </p>
          </div>
          <button type="button" className="icon-btn side__hide" onClick={() => setSideHidden(true)} aria-label="Ocultar el menú lateral" title="Ocultar el menú lateral ( [ )">
            <Icon name="back" size={14} />
          </button>
        </div>

        <div className="player">
          <Avatar profile={profile} size={44} />
          <div className="player__text">
            <p className="player__name">{profile.displayName}</p>
            <p className="player__rank">Mundo {worldFor(level)}</p>
            <p className="player__rank player__rank--sub">
              Nvl {level} · {rankFor(level)}
            </p>
          </div>
          <div className="player__xp">
            <Bar pct={pct} tone="yellow" label="Experiencia hacia el siguiente nivel" />
            <p className="player__xp-meta">
              {into.toLocaleString('en-US')} / {needed.toLocaleString('en-US')} XP
            </p>
          </div>
        </div>

        <nav className="nav" aria-label="Secciones">
          {SECTIONS.map((s) => {
            const b = badges[s.id];
            const on = s.id === active;
            return (
              <Link
                key={s.id}
                to={hrefFor(s.id)}
                className={cx('nav__link', on && 'is-active')}
                aria-current={on ? 'true' : undefined}
                onClick={() => {
                  sfx.select();
                  setNavOpen(false);
                }}
              >
                <Sprite name={s.sprite} size={20} />
                <span className="nav__text">
                  <span className="nav__label">{s.label}</span>
                  <span className="nav__sub">{tabsOf(s.id).map((t) => t.label).join(' · ')}</span>
                </span>
                {b && (
                  <span className={cx('nav__badge', `nav__badge--${b.tone}`)} title={b.label}>
                    <span aria-hidden="true">{b.count}</span>
                    <span className="sr-only">{b.label}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="challenge">
          <p className="kicker kicker--light">Reto semanal</p>
          <p className="challenge__title">
            Estudia {goal} h — <b>+{WEEKLY_BONUS_XP} XP</b>
          </p>
          <Bar pct={(hours / goal) * 100} tone="yellow" label="Progreso del reto semanal" />
          <p className="challenge__meta">
            {hours.toFixed(1)} / {goal} H {reached ? '· ¡META!' : `· ${(goal - hours).toFixed(1)} RESTANTES`}
          </p>
          {reached && !claimed && (
            <Button variant="coin" small block onClick={claim}>
              Reclamar bono
            </Button>
          )}
          {claimed && (
            <p className="challenge__meta">
              <Icon name="check" size={10} /> Bono reclamado
            </p>
          )}
        </div>

        <div className="sysbar">
          <span className="sysbar__label">Ajustes</span>
          <button type="button" className="icon-btn" onClick={() => openModal({ type: 'howto' })} aria-label="Guía de uso" title="Guía de uso: cómo empezar y qué hacer">
            <Icon name="help" />
          </button>
          <button type="button" className="icon-btn sysbar__keys" onClick={() => openModal({ type: 'shortcuts' })} aria-label="Atajos de teclado" title="Atajos de teclado (?)">
            <Icon name="keys" />
          </button>
          <button type="button" className="icon-btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Silenciar efectos' : 'Activar efectos de sonido'} title="Efectos de sonido">
            <Icon name={sound ? 'sound' : 'mute'} />
          </button>
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Cambiar a modo día' : 'Cambiar a modo noche'} title="Día / noche">
            <Sprite name={theme === 'dark' ? 'star' : 'ghost'} size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}

/** Acceso rápido al Pomodoro en la barra superior: un tomate en reposo, el reloj cuando está en marcha. */
function PomodoroChip() {
  const status = usePomodoro((s) => s.status);
  const phase = usePomodoro((s) => s.phase);
  const endsAt = usePomodoro((s) => s.endsAt);
  const remaining = usePomodoro((s) => s.remainingMs);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [status]);
  if (status === 'idle')
    return (
      <Link to="/pomodoro" className="icon-btn" aria-label="Pomodoro: modo enfoque" title="Pomodoro">
        <Sprite name="tomato" size={18} />
      </Link>
    );
  const left = status === 'running' && endsAt ? Math.max(0, endsAt - now) : remaining;
  return (
    <Link to="/pomodoro" className="tag tag--xp pomo-chip" title={`${PHASE_LABEL[phase]}${status === 'paused' ? ' (en pausa)' : ''}`}>
      <Sprite name="tomato" size={14} /> {formatClock(left)}
      {status === 'paused' && <Icon name="pause" size={10} />}
    </Link>
  );
}

/** ¿Pantalla estrecha, donde el menú es un cajón? En las anchas el botón oculta y muestra la barra lateral. */
const isNarrow = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 900px)').matches;

function Hud() {
  const { pathname } = useLocation();
  const item = navFor(pathname);
  const title = useRouteTitle();
  const profile = useData((s) => s.profile);
  const events = useData((s) => s.xpEvents);
  const unread = useData((s) => s.notifications.filter((n) => !n.read).length);
  const streak = useMemo(() => computeStreak(events, profile.frozenDates).current, [events, profile.frozenDates]);
  const { theme, sound, toggleTheme, toggleSound, setNotifOpen, setNavOpen, openModal, sideHidden, toggleSide } = useUi();
  const narrow = isNarrow();
  const online = useOnline();
  const pending = useSyncPending(dataLayer.sync);

  const openNew = () => openModal({ type: newKindFor(pathname) });

  return (
    <header className="hud">
      <button
        type="button"
        className="icon-btn hud__menu"
        aria-label={narrow ? 'Abrir menú' : sideHidden ? 'Mostrar el menú lateral' : 'Ocultar el menú lateral'}
        title={narrow ? undefined : 'Mostrar u ocultar el menú lateral ( [ )'}
        aria-controls="menu-principal"
        aria-expanded={narrow ? undefined : !sideHidden}
        onClick={() => (isNarrow() ? setNavOpen(true) : toggleSide())}
      >
        <Icon name="menu" size={16} />
      </button>
      <div className="hud__title">
        <p className="kicker kicker--light">{item.kicker}</p>
        <p className="hud__h">{title}</p>
      </div>
      <SearchBox id="busqueda" />
      <div className="hud__stats" aria-label="Marcadores">
        <span className="stat stat--desk stat--xp" title="Puntos de experiencia totales">
          <span className="stat__k">XP</span>
          <Scramble className="stat__v" value={String(profile.xp).padStart(6, '0')} />
        </span>
        <span className="stat stat--desk" title="Monedas">
          <Sprite name="coin" size={16} />
          <Scramble className="stat__v" value={profile.credits.toLocaleString('en-US')} />
        </span>
        <span className="stat stat--fire" title="Racha de días">
          <Sprite name="fire" size={16} />
          <span className="stat__v">{streak}</span>
        </span>
      </div>
      <PomodoroChip />
      {!online && <span className="tag tag--red" title="Sin conexión: tus cambios se guardan en el dispositivo y se enviarán al volver la red">OFFLINE</span>}
      {pending > 0 && (
        <button type="button" className="tag tag--xp tag--btn" onClick={() => void dataLayer.sync?.flush()} title="Cambios guardados en el dispositivo que aún no están en la nube. Pulsa para reintentar.">
          <Icon name="sync" size={12} /> {pending} {pending === 1 ? 'pendiente' : 'pendientes'}
        </button>
      )}
      <button type="button" className="icon-btn hud__pref" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Cambiar a modo día' : 'Cambiar a modo noche'} title="Día / noche">
        <Sprite name={theme === 'dark' ? 'star' : 'ghost'} size={18} />
      </button>
      <button type="button" className="icon-btn hud__pref" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Silenciar efectos' : 'Activar efectos de sonido'} title="Sonido">
        <Icon name={sound ? 'sound' : 'mute'} />
      </button>
      <button type="button" className="icon-btn hud__bell" onClick={() => setNotifOpen(true)} aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`}>
        <Sprite name="heart" size={18} />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      {/* En móvil, crear o registrar vive aquí (antes era un botón flotante que tapaba el contenido). */}
      <button type="button" className="icon-btn hud__quick" aria-label="Crear o registrar" title="Crear o registrar" onClick={() => openModal({ type: 'quick' })}>
        <Icon name="plus" size={16} />
      </button>
      <Button variant="primary" className="hud__new" onClick={openNew}>
        <Icon name="plus" size={12} /> Nuevo
      </Button>
    </header>
  );
}

function MobileNav() {
  const badges = useSectionBadges();
  const { active, hrefFor } = useSectionLinks();
  return (
    <>
      <nav className="bottom-nav" aria-label="Secciones">
        {SECTIONS.map((s) => {
          const b = badges[s.id];
          const on = s.id === active;
          return (
            <Link key={s.id} to={hrefFor(s.id)} className={cx('bottom-nav__link', on && 'is-active')} aria-current={on ? 'true' : undefined}>
              <span className="bottom-nav__icon">
                <Sprite name={s.sprite} size={22} />
                {b && (
                  <span className={cx('bottom-nav__badge', `bottom-nav__badge--${b.tone}`)} aria-hidden="true">
                    {b.count > 9 ? '9+' : b.count}
                  </span>
                )}
              </span>
              <span>{s.label}</span>
              {b && <span className="sr-only">, {b.label}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Pestañas de la sección actual, encima de cada pantalla. */
function useSectionTabs() {
  const { pathname } = useLocation();
  const courses = useData((s) => s.courses);
  const reviews = useMemo(() => dueReviews({ courses }).length, [courses]);
  const item = navFor(pathname);
  const section = SECTIONS.find((s) => s.id === item.section) ?? SECTIONS[0];
  const tabs = tabsOf(section.id).map((t) => (t.to === '/repaso' ? { to: t.to, label: t.label, count: reviews, countLabel: reviews === 1 ? 'tema para repasar hoy' : 'temas para repasar hoy' } : { to: t.to, label: t.label }));
  const showTabs = !item.hidden && tabs.length > 1;
  return { pathname, item, section, tabs, showTabs };
}

export function AppShell() {
  useHabitReminders();
  usePomodoroEngine();
  useAiAccountSync();
  useShortcuts();
  useTour();
  const sideHidden = useUi((s) => s.sideHidden);
  const { pathname, item, section, tabs, showTabs } = useSectionTabs();
  useEffect(() => {
    rememberTab(pathname);
  }, [pathname]);
  // Cada pantalla nueva empieza arriba (cambiar solo los parámetros, como ?nota=, no mueve nada).
  // Es de layout para ir antes que los efectos de la pantalla que quieran desplazarse a algo concreto.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className={cx('shell', sideHidden && 'shell--no-side')}>
      <Sidebar />
      <div className="shell__main">
        <Hud />
        <WorldStage tall={item.to === '/'} />
        <main className={cx('page', item.to === '/' && 'page--home')} id="contenido">
          {showTabs && <SectionTabs tabs={tabs} current={item.to} label={`Pestañas de ${section.label}`} panelId="contenido-panel" />}
          <div id="contenido-panel" role={showTabs ? 'tabpanel' : undefined} aria-labelledby={showTabs ? sectionTabId(item.to) : undefined}>
            <Suspense
              fallback={
                <div className="page-loader">
                  <Loader title="Cargando la pantalla" steps={['Preparando el nivel']} />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <MobileNav />
      <Overlays />
    </div>
  );
}
