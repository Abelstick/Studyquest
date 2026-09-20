import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { dataLayer, readCache, useData } from '@/state';
import type { AuthUser } from '@/data';
import { AppShell } from '@/features/layout/AppShell';
import Inicio from '@/features/inicio/Inicio';
import Login from '@/features/auth/Login';
import { Button } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const Cursos = lazy(() => import('@/features/cursos/Cursos'));
const CursoDetalle = lazy(() => import('@/features/cursos/CursoDetalle'));
const Tareas = lazy(() => import('@/features/tareas/Tareas'));
const Habitos = lazy(() => import('@/features/habitos/Habitos'));
const HabitoDetalle = lazy(() => import('@/features/habitos/HabitoDetalle'));
const Metas = lazy(() => import('@/features/metas/Metas'));
const Proyectos = lazy(() => import('@/features/proyectos/Proyectos'));
const Progreso = lazy(() => import('@/features/progreso/Progreso'));
const Arsenal = lazy(() => import('@/features/arsenal/Arsenal'));
const Perfil = lazy(() => import('@/features/perfil/Perfil'));

function Splash({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="splash" role="status">
      <Sprite name="pacman" size={44} className="splash__pac" />
      <p className="splash__text">{text}</p>
    </div>
  );
}

function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="alert">
      <Sprite name="mushroom" size={22} />
      <span>¡Hay una versión nueva!</span>
      <Button small variant="coin" onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </Button>
    </div>
  );
}

function AuthGate() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const status = useData((s) => s.status);
  const error = useData((s) => s.error);
  const load = useData((s) => s.load);
  const clear = useData((s) => s.clear);

  useEffect(() => {
    let alive = true;
    void dataLayer.auth.getUser().then((u) => alive && setUser(u));
    const off = dataLayer.auth.onChange((u) => alive && setUser(u));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) void load(userId, readCache(userId));
    else if (user === null) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user === null]);

  if (user === undefined) return <Splash />;
  if (user === null) return <Login />;
  if (status === 'error')
    return (
      <div className="splash">
        <Sprite name="skull" size={44} />
        <p className="splash__text">No se pudo cargar tu partida</p>
        <p className="muted small">{error}</p>
        <Button variant="primary" onClick={() => void load(user.id, null)}>
          Reintentar
        </Button>
      </div>
    );
  if (status !== 'ready') return <Splash />;

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Inicio />} />
          <Route path="cursos" element={<Cursos />} />
          <Route path="cursos/:id" element={<CursoDetalle />} />
          <Route path="tareas" element={<Tareas />} />
          <Route path="habitos" element={<Habitos />} />
          <Route path="habitos/:id" element={<HabitoDetalle />} />
          <Route path="metas" element={<Metas />} />
          <Route path="proyectos" element={<Proyectos />} />
          <Route path="progreso" element={<Progreso />} />
          <Route path="arsenal" element={<Arsenal />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <AuthGate />
      <UpdateBanner />
    </BrowserRouter>
  );
}
