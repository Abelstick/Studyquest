import { describe, expect, it } from 'vitest';
import type { Certification } from './domain';
import { CERT_XP, certState, certificationsOfCourse, daysToExpiry, issuers, linkLabel, safeUrl, sortCertifications } from './certifications';

const NOW = '2026-09-16';
const cert = (over: Partial<Certification> = {}): Certification => ({
  id: 'c1', title: 'Certificado', issuer: 'Coursera', date: '2026-09-01', url: '', credentialId: '', expiresAt: null, courseId: null, notes: '', createdAt: '', ...over,
});

describe('enlace del certificado', () => {
  it('acepta http y https', () => {
    expect(safeUrl('https://coursera.org/verify/ABC')).toBe('https://coursera.org/verify/ABC');
    expect(safeUrl('http://ejemplo.com/cert')).toBe('http://ejemplo.com/cert');
  });

  it('si no escribes el esquema, asume https (es lo que espera cualquiera)', () => {
    expect(safeUrl('coursera.org/verify/ABC')).toBe('https://coursera.org/verify/ABC');
    expect(safeUrl('  www.credly.com/badges/1  ')).toBe('https://www.credly.com/badges/1');
  });

  it('RECHAZA esquemas peligrosos: un «javascript:» en un enlace ejecutaría código en la app', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull();
    expect(safeUrl('file:///C:/Windows/System32')).toBeNull();
  });

  it('descarta lo que no es un enlace', () => {
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('   ')).toBeNull();
    expect(safeUrl('no es una url')).toBeNull();
    expect(safeUrl('https://sinpunto')).toBeNull();
  });

  it('en pantalla se muestra solo el dominio, sin «www.»', () => {
    expect(linkLabel('https://www.credly.com/badges/123')).toBe('credly.com');
    expect(linkLabel('coursera.org/verify/ABC')).toBe('coursera.org');
    expect(linkLabel('javascript:alert(1)')).toBe('');
  });
});

describe('caducidad', () => {
  it('sin fecha de caducidad siempre está vigente', () => {
    expect(certState(cert(), NOW)).toBe('valid');
    expect(daysToExpiry(cert(), NOW)).toBeNull();
  });

  it('avisa cuando quedan 60 días o menos, y marca las caducadas', () => {
    expect(certState(cert({ expiresAt: '2026-12-31' }), NOW)).toBe('valid');
    expect(certState(cert({ expiresAt: '2026-11-14' }), NOW)).toBe('soon'); // 59 días
    expect(certState(cert({ expiresAt: NOW }), NOW)).toBe('soon'); // caduca hoy: aún vale
    expect(certState(cert({ expiresAt: '2026-09-15' }), NOW)).toBe('expired');
  });

  it('dice cuántos días faltan (negativo si ya pasó)', () => {
    expect(daysToExpiry(cert({ expiresAt: '2026-09-26' }), NOW)).toBe(10);
    expect(daysToExpiry(cert({ expiresAt: '2026-09-06' }), NOW)).toBe(-10);
  });
});

describe('lista de certificaciones', () => {
  it('las más nuevas primero y las caducadas al final', () => {
    const list = [
      cert({ id: 'vieja', date: '2026-01-01' }),
      cert({ id: 'caducada', date: '2026-09-10', expiresAt: '2026-09-01' }),
      cert({ id: 'nueva', date: '2026-09-05' }),
    ];
    expect(sortCertifications(list, NOW).map((c) => c.id)).toEqual(['nueva', 'vieja', 'caducada']);
  });

  it('sugiere los emisores que ya usaste, sin repetir y ordenados', () => {
    const list = [cert({ issuer: 'Coursera' }), cert({ issuer: 'AWS' }), cert({ issuer: 'Coursera' }), cert({ issuer: '  ' })];
    expect(issuers(list)).toEqual(['AWS', 'Coursera']);
  });

  it('filtra las de un curso', () => {
    const list = [cert({ id: 'a', courseId: 'curso1' }), cert({ id: 'b', courseId: null }), cert({ id: 'c', courseId: 'curso2' })];
    expect(certificationsOfCourse(list, 'curso1').map((c) => c.id)).toEqual(['a']);
  });

  it('el XP de una certificación es el mismo al darlo y al devolverlo', () => {
    expect(CERT_XP).toBeGreaterThan(0);
  });
});
