// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useData } from '@/state';
import type { Course } from '@/core/domain';
import { CourseGrades } from './CourseGrades';

const course = (extra: Partial<Course> = {}): Course => ({ id: 'c1', title: 'SQL', professor: '', field: '', mentor: null, modules: [], createdAt: '', ...extra });
const spies = { saveEvaluation: vi.fn(), removeEvaluation: vi.fn(), setGradeScale: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0, 0));
  Object.values(spies).forEach((s) => s.mockClear());
  useData.setState({ ...spies });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Evaluaciones del curso', () => {
  it('sin evaluaciones explica para qué sirve y deja añadir la primera con el 100 % de peso', () => {
    render(<CourseGrades course={course()} />);
    expect(screen.getByText(/cuánto necesitas sacar/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Nombre de la evaluación'), { target: { value: 'Parcial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(spies.saveEvaluation).toHaveBeenCalledWith('c1', { title: 'Parcial', weight: 100, date: undefined });
  });

  it('muestra el promedio, lo que falta para aprobar y la próxima evaluación', () => {
    const evaluations = [{ id: 'p1', title: 'Parcial', weight: 60, score: 9 }, { id: 'f', title: 'Final', weight: 40, date: '2026-11-15' }];
    render(<CourseGrades course={course({ evaluations })} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Promedio actual9 / 20');
    expect(screen.getByRole('status').textContent).toBe('Necesitas 14 de 20 de promedio en lo que falta para aprobar.');
    expect(text).toContain('60 % de la nota ya evaluado · Próxima: Final, en 3 días (15 nov)');
    expect(screen.getByRole('progressbar', { name: 'Parte de la nota ya evaluada' })).toBeTruthy();
  });

  it('poner una nota la guarda al salir de la casilla, y vaciarla la quita', () => {
    const evaluations = [{ id: 'p1', title: 'Parcial', weight: 60, score: 9 }, { id: 'f', title: 'Final', weight: 40 }];
    render(<CourseGrades course={course({ evaluations })} />);
    const final = screen.getByLabelText('Nota de Final, sobre 20');
    fireEvent.change(final, { target: { value: '15,5' } });
    fireEvent.blur(final);
    expect(spies.saveEvaluation).toHaveBeenLastCalledWith('c1', { id: 'f', title: 'Final', weight: 40, score: 15.5 });
    const parcial = screen.getByLabelText('Nota de Parcial, sobre 20');
    fireEvent.change(parcial, { target: { value: '' } });
    fireEvent.blur(parcial);
    expect(spies.saveEvaluation).toHaveBeenLastCalledWith('c1', { id: 'p1', title: 'Parcial', weight: 60, score: undefined });
  });

  it('editar carga la evaluación en el formulario y quitar la borra', () => {
    const evaluations = [{ id: 'p1', title: 'Parcial', weight: 60, score: 9 }];
    render(<CourseGrades course={course({ evaluations })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Parcial' }));
    fireEvent.change(screen.getByLabelText('Nombre de la evaluación'), { target: { value: 'Parcial 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(spies.saveEvaluation).toHaveBeenCalledWith('c1', { id: 'p1', title: 'Parcial 1', weight: 60, score: 9, date: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Parcial' }));
    expect(spies.removeEvaluation).toHaveBeenCalledWith('c1', 'p1');
  });

  it('cambiar de escala aplica la nota de aprobar de esa escala', () => {
    render(<CourseGrades course={course()} />);
    fireEvent.change(screen.getByLabelText('Escala'), { target: { value: '10' } });
    expect(spies.setGradeScale).toHaveBeenCalledWith('c1', { max: 10, pass: 6 });
  });
});
