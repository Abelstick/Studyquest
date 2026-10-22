import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUi } from '@/state/ui';
import { SECTIONS, newKindFor, sectionHref } from './nav';

/** Tiempo para pulsar la segunda tecla de «g + letra». */
const CHORD_MS = 1200;

/** ¿El foco está en algo donde se escribe? Ahí las teclas son texto, no atajos. */
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

/**
 * Atajos de teclado globales:
 * «/» buscar · «n» crear (según la pantalla) · «g» + letra de sección · «[» ocultar o mostrar el menú · «?» ayuda.
 * Se ignoran al escribir, con un modal abierto o con Ctrl/Alt/Cmd, para no chocar con el navegador
 * ni con los atajos propios de cada pantalla (Repaso usa 1-3 y espacio).
 */
export function useShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    let chordUntil = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const ui = useUi.getState();
      if (ui.modal || ui.navOpen) return;
      const key = e.key.toLowerCase();

      if (Date.now() < chordUntil) {
        chordUntil = 0;
        const section = SECTIONS.find((s) => s.key === key);
        if (section) {
          e.preventDefault();
          navigate(sectionHref(section.id));
        }
        return;
      }
      if (key === 'g') {
        chordUntil = Date.now() + CHORD_MS;
      } else if (e.key === '/') {
        const box = document.getElementById('busqueda');
        e.preventDefault();
        // En móvil la búsqueda de la barra está oculta: se usa la del menú «＋».
        if (box && box.offsetParent !== null) box.focus();
        else ui.openModal({ type: 'quick' });
      } else if (key === 'n') {
        e.preventDefault();
        ui.openModal({ type: newKindFor(pathname) });
      } else if (e.key === '[') {
        // Oculta o muestra la barra lateral (en pantallas anchas).
        e.preventDefault();
        ui.toggleSide();
      } else if (e.key === '?') {
        e.preventDefault();
        ui.openModal({ type: 'shortcuts' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate, pathname]);
}
