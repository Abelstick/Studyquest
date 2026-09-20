import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { today, longDate, weekStart } from '@/core/dates';
import { WEEKLY_BONUS_XP, computeStreak, hoursInWeek, rankFor, levelFromXp, worldFor } from '@/core/game';
import { Avatar } from '@/ui/Avatar';
import { Bar, Button, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { NAV, navFor } from './nav';
import { Overlays } from './Overlays';
import { useOnline } from '@/pwa/hooks';

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

function Sidebar() {
  const profile = useData((s) => s.profile);
  const sessions = useData((s) => s.sessions);
  const claim = useData((s) => s.claimWeeklyBonus);
  const navOpen = useUi((s) => s.navOpen);
  const setNavOpen = useUi((s) => s.setNavOpen);
  const level = levelFromXp(profile.xp);

  const from = weekStart(today());
  const hours = hoursInWeek(sessions, from);
  const goal = Math.max(1, profile.weeklyGoalHours);
  const reached = hours >= goal;
  const claimed = profile.weeklyBonusClaimed === from;

  return (
    <>
      <div className={cx('scrim', navOpen && 'is-on')} onClick={() => setNavOpen(false)} />
      <aside className={cx('sidebar', navOpen && 'is-open')} aria-label="Menú principal">
        <div className="brand">
          <Sprite name="coin" size={26} className="brand__coin" />
          <div>
            <p className="brand__build">// build 0.5</p>
            <p className="brand__name">
              STUDY<span>QUEST</span>
            </p>
          </div>
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
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('nav__link', isActive && 'is-active')} onClick={() => setNavOpen(false)}>
              <Sprite name={n.sprite} size={20} />
              <span>{n.label}</span>
            </NavLink>
          ))}
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
          {claimed && <p className="challenge__meta">Bono reclamado ✔</p>}
        </div>
      </aside>
    </>
  );
}

function SearchBox() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { tasks, habits, courses } = useData();
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    const hit = (t: string) => t.toLowerCase().includes(n);
    return [
      ...courses.filter((c) => hit(c.title)).map((c) => ({ key: c.id, label: c.title, kind: 'Curso', to: `/cursos/${c.id}` })),
      ...tasks.filter((t) => hit(t.title)).map((t) => ({ key: t.id, label: t.title, kind: 'Tarea', to: '/tareas' })),
      ...habits.filter((h) => hit(h.title)).map((h) => ({ key: h.id, label: h.title, kind: 'Hábito', to: `/habitos/${h.id}` })),
    ].slice(0, 7);
  }, [q, tasks, habits, courses]);

  return (
    <div className="search">
      <Sprite name="ring" size={16} />
      <input
        className="search__input"
        type="search"
        placeholder="Buscar misión, curso o hábito…"
        aria-label="Buscar"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setQ('')}
      />
      {q.trim().length >= 2 && (
        <ul className="search__results">
          {results.length === 0 && <li className="search__empty">Nada por aquí… ¡el bloque estaba vacío!</li>}
          {results.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  navigate(r.to);
                }}
              >
                <span className="tag tag--plain">{r.kind}</span> {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Hud() {
  const { pathname } = useLocation();
  const item = navFor(pathname);
  const title = useRouteTitle();
  const profile = useData((s) => s.profile);
  const events = useData((s) => s.xpEvents);
  const unread = useData((s) => s.notifications.filter((n) => !n.read).length);
  const streak = useMemo(() => computeStreak(events, profile.frozenDates).current, [events, profile.frozenDates]);
  const { theme, sound, toggleTheme, toggleSound, setNotifOpen, setNavOpen, openModal } = useUi();
  const online = useOnline();

  const openNew = () => {
    const base = '/' + (pathname.split('/')[1] ?? '');
    if (base === '/habitos') openModal({ type: 'habit' });
    else if (base === '/cursos') openModal({ type: 'course' });
    else if (base === '/metas') openModal({ type: 'goal' });
    else if (base === '/proyectos') openModal({ type: 'project' });
    else openModal({ type: 'task' });
  };

  return (
    <header className="hud">
      <button type="button" className="icon-btn hud__menu" aria-label="Abrir menú" onClick={() => setNavOpen(true)}>
        <span aria-hidden="true">☰</span>
      </button>
      <div className="hud__title">
        <p className="kicker kicker--light">// {item.kicker}</p>
        <p className="hud__h">{title}</p>
      </div>
      <SearchBox />
      <div className="hud__stats" aria-label="Marcadores">
        <span className="stat" title="Puntos de experiencia totales">
          <span className="stat__k">XP</span>
          <span className="stat__v">{String(profile.xp).padStart(6, '0')}</span>
        </span>
        <span className="stat" title="Monedas">
          <Sprite name="coin" size={16} />
          <span className="stat__v">×{profile.credits.toLocaleString('en-US')}</span>
        </span>
        <span className="stat stat--fire" title="Racha de días">
          <Sprite name="fire" size={16} />
          <span className="stat__v">{streak}</span>
        </span>
      </div>
      {!online && <span className="tag tag--red" title="Sin conexión">OFFLINE</span>}
      <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Cambiar a modo día' : 'Cambiar a modo noche'} title="Día / noche">
        <Sprite name={theme === 'dark' ? 'star' : 'ghost'} size={18} />
      </button>
      <button type="button" className="icon-btn" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Silenciar efectos' : 'Activar efectos de sonido'} title="Sonido">
        <span aria-hidden="true">{sound ? '♪' : '✕'}</span>
      </button>
      <button type="button" className="icon-btn hud__bell" onClick={() => setNotifOpen(true)} aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`}>
        <Sprite name="heart" size={18} />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      <Button variant="primary" className="hud__new" onClick={openNew}>
        <span aria-hidden="true">＋</span> Nuevo
      </Button>
    </header>
  );
}

function MobileNav() {
  const openModal = useUi((s) => s.openModal);
  return (
    <>
      <button type="button" className="fab" aria-label="Crear o registrar" onClick={() => openModal({ type: 'quick' })}>
        <Sprite name="qblock" size={30} />
      </button>
      <nav className="bottom-nav" aria-label="Navegación rápida">
        {NAV.filter((n) => n.mobile).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('bottom-nav__link', isActive && 'is-active')}>
            <Sprite name={n.sprite} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export function AppShell() {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell__main">
        <Hud />
        <main className="page" id="contenido">
          <Outlet />
        </main>
        <footer className="ground" aria-hidden="true" />
      </div>
      <MobileNav />
      <Overlays />
    </div>
  );
}
