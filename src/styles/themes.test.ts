import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORLD_THEMES } from '@/core/themes';

/*
 * Lee tokens.css y themes.css, reproduce la cascada (base → noche → mundo → mundo de noche) y comprueba:
 * 1. que cada mundo redefine todo el contrato de tema (si faltara un token, se colaría el del mundo clásico);
 * 2. que los pares de texto y de controles cumplen WCAG 2.2 AA en todos los mundos, de día y de noche.
 */
const css = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type Decls = Record<string, string>;
interface Rule {
  selectors: string[];
  decls: Decls;
}

function parse(source: string): Rule[] {
  const rules: Rule[] = [];
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls: Decls = {};
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls[d[1]] = d[2].trim();
    rules.push({ selectors: m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')), decls });
  }
  return rules;
}

const rules = [...parse(css('tokens.css')), ...parse(css('themes.css'))];
const block = (selector: string): Decls => Object.assign({}, ...rules.filter((r) => r.selectors.includes(selector)).map((r) => r.decls));

const BASE = block(':root');
const DARK = block(":root[data-theme='dark']");
/** El contrato: todo lo que el mundo clásico declara como temable (bloque de día con vista previa + noche). */
const CONTRACT = new Set([...Object.keys(rules.find((r) => r.selectors.includes("[data-world-preview='classic']"))?.decls ?? {}), ...Object.keys(DARK)]);

const WORLDS = WORLD_THEMES.filter((t) => t.world).map((t) => t.world as string);
const lightOf = (w: string) => block(`:root[data-world='${w}']`);
const darkOf = (w: string) => block(`:root[data-theme='dark'][data-world='${w}']`);

function tokens(world: string | null, mode: 'light' | 'dark'): Decls {
  return { ...BASE, ...(mode === 'dark' ? DARK : {}), ...(world ? lightOf(world) : {}), ...(world && mode === 'dark' ? darkOf(world) : {}) };
}

function resolve(map: Decls, value: string, depth = 0): string {
  if (depth > 10) throw new Error(`Referencia circular en ${value}`);
  return value.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name: string, fallback?: string) => {
    const v = map[name] ?? fallback;
    if (v === undefined) throw new Error(`Token sin definir: ${name}`);
    return resolve(map, v, depth + 1);
  });
}

function hex(map: Decls, token: string): [number, number, number] {
  const v = resolve(map, map[`--${token}`] ?? `var(--${token})`).trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (!m) throw new Error(`--${token} no es un color hexadecimal: ${v}`);
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const luminance = ([r, g, b]: [number, number, number]) => {
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Texto normal: 4.5:1. */
const TEXT_PAIRS: [string, string][] = [
  ['text', 'panel'],
  ['text', 'panel-2'],
  ['text', 'panel-3'],
  ['text', 'field'],
  ['muted', 'panel'],
  ['muted', 'panel-2'],
  ['ink-soft', 'panel'],
  ['xp-text', 'panel'],
  ['red-text', 'panel'],
  ['green-text', 'panel'],
  ['on-green', 'green'],
  ['on-blue', 'blue'],
  ['on-primary', 'primary'],
  ['on-page', 'page'],
  ['on-page-muted', 'page'],
  ['hud-text', 'hud'],
  ['hud-text', 'hud-2'],
  ['on-page-muted', 'hud'],
  ['on-page-muted', 'hud-2'],
  ['side-text', 'side'],
  ['on-page-muted', 'side'],
  ['yellow', 'hud'],
  ['text', 'nav-active-bg'],
  ['muted', 'nav-active-bg'],
  ['on-red', 'alert'],
];
/** Texto grande e indicadores gráficos: 3:1. */
const UI_PAIRS: [string, string][] = [
  ['accent', 'side'],
  ['nav-mark', 'side'],
  ['field-edge', 'field'],
];
/** Elementos con dos tonos (foco, botón principal): basta con que UNO de los dos contraste 3:1 con el fondo. */
const EITHER: [string, string, string][] = [
  ['focus', 'focus-ink', 'panel'],
  ['focus', 'focus-ink', 'side'],
  ['focus', 'focus-ink', 'page'],
  ['primary', 'primary-edge', 'panel'],
  ['primary', 'primary-edge', 'page'],
];

describe('Mundos visuales', () => {
  it('cada mundo comprable tiene su bloque de tema', () => {
    expect(WORLDS.length).toBeGreaterThanOrEqual(6);
    for (const w of WORLDS) {
      expect(Object.keys(lightOf(w)).length, w).toBeGreaterThan(0);
      expect(Object.keys(darkOf(w)).length, w).toBeGreaterThan(0);
    }
  });

  it.each(WORLDS)('%s redefine todo el contrato de tema', (w) => {
    const defined = new Set([...Object.keys(lightOf(w)), ...Object.keys(darkOf(w))]);
    expect([...CONTRACT].filter((t) => !defined.has(t))).toEqual([]);
  });

  const cases = [null, ...WORLDS].flatMap((w) => (['light', 'dark'] as const).map((mode) => [w ?? 'clásico', w, mode] as const));

  it.each(cases)('%s (%s · %s) cumple WCAG AA', (_label, world, mode) => {
    const map = tokens(world, mode);
    const fails: string[] = [];
    for (const [fg, bg] of TEXT_PAIRS) {
      const c = contrast(hex(map, fg), hex(map, bg));
      if (c < 4.5) fails.push(`--${fg} sobre --${bg}: ${c.toFixed(2)}`);
    }
    for (const [fg, bg] of UI_PAIRS) {
      const c = contrast(hex(map, fg), hex(map, bg));
      if (c < 3) fails.push(`--${fg} sobre --${bg}: ${c.toFixed(2)}`);
    }
    for (const [a, b, bg] of EITHER) {
      const c = Math.max(contrast(hex(map, a), hex(map, bg)), contrast(hex(map, b), hex(map, bg)));
      if (c < 3) fails.push(`--${a}/--${b} sobre --${bg}: ${c.toFixed(2)}`);
    }
    expect(fails).toEqual([]);
  });
});
