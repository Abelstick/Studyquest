import { afterEach, describe, expect, it, vi } from 'vitest';
import { NAV, SECTIONS, navFor, newKindFor, rememberTab, sectionFor, sectionHref, tabsOf } from './nav';

/** localStorage mínimo en memoria: el entorno de pruebas es Node y no lo trae. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('navegación en secciones', () => {
  it('tiene exactamente cinco secciones', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(['Hoy', 'Estudiar', 'Planear', 'Lograr', 'Mi juego']);
  });

  it('conserva todas las rutas de antes', () => {
    const routes = ['/', '/cursos', '/apuntes', '/repaso', '/tareas', '/calendario', '/planificador', '/habitos', '/metas', '/proyectos', '/certificaciones', '/progreso', '/heroe', '/ciudad', '/arsenal', '/perfil', '/pomodoro'];
    expect(NAV.map((n) => n.to).sort()).toEqual([...routes].sort());
  });

  it('agrupa las pestañas como se pidió', () => {
    expect(tabsOf('hoy').map((t) => t.label)).toEqual(['Inicio']);
    expect(tabsOf('estudiar').map((t) => t.label)).toEqual(['Cursos', 'Apuntes', 'Repaso']);
    expect(tabsOf('planear').map((t) => t.label)).toEqual(['Tareas', 'Calendario', 'Planificador']);
    expect(tabsOf('lograr').map((t) => t.label)).toEqual(['Hábitos', 'Metas', 'Proyectos', 'Certificaciones']);
    expect(tabsOf('juego').map((t) => t.label)).toEqual(['Progreso', 'Héroe 3D', 'Ciudad', 'Arsenal', 'Perfil']);
  });

  it('deduce la sección de la ruta, también en rutas de detalle', () => {
    expect(sectionFor('/')).toBe('hoy');
    expect(sectionFor('/cursos/abc')).toBe('estudiar');
    expect(sectionFor('/habitos/xyz')).toBe('lograr');
    expect(sectionFor('/pomodoro')).toBe('hoy');
    expect(sectionFor('/no-existe')).toBe('hoy');
    expect(navFor('/cursos/abc').to).toBe('/cursos');
  });

  it('sin almacenamiento, una sección lleva a su primera pestaña', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(sectionHref('planear')).toBe('/tareas');
    expect(() => rememberTab('/calendario')).not.toThrow();
  });

  it('recuerda la última pestaña visitada de cada sección', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    rememberTab('/calendario');
    rememberTab('/cursos/abc');
    expect(sectionHref('planear')).toBe('/calendario');
    expect(sectionHref('estudiar')).toBe('/cursos');
    expect(sectionHref('lograr')).toBe('/habitos');
  });

  it('ignora un valor guardado que ya no es una pestaña de la sección', () => {
    const storage = fakeStorage();
    storage.setItem('sq.nav.last', JSON.stringify({ planear: '/metas' }));
    vi.stubGlobal('localStorage', storage);
    expect(sectionHref('planear')).toBe('/tareas');
  });

  it('no se rompe con datos corruptos', () => {
    const storage = fakeStorage();
    storage.setItem('sq.nav.last', '{no es json');
    vi.stubGlobal('localStorage', storage);
    expect(sectionHref('juego')).toBe('/progreso');
  });

  it('cada sección tiene una tecla de atajo distinta (una letra)', () => {
    const keys = SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(SECTIONS.length);
    expect(keys.every((k) => /^[a-z]$/.test(k))).toBe(true);
    // «g» abre el atajo y «n» crea: no pueden ser letra de sección.
    expect(keys).not.toContain('g');
    expect(keys).not.toContain('n');
  });

  it('«＋ Nuevo» crea lo propio de cada pantalla', () => {
    expect(newKindFor('/habitos/abc')).toBe('habit');
    expect(newKindFor('/cursos')).toBe('course');
    expect(newKindFor('/metas')).toBe('goal');
    expect(newKindFor('/proyectos')).toBe('project');
    expect(newKindFor('/')).toBe('task');
    expect(newKindFor('/calendario')).toBe('task');
  });
});
