/**
 * Categorías de actividad: cada una decide a qué atributos va el XP (primario 70 %, secundario 30 %).
 * Las palabras clave sirven para sugerir la categoría a partir del título (ver suggest.ts). Se escriben
 * en minúsculas y sin tildes; `strong` pesa el doble que `weak` (un sustantivo concreto dice más que un verbo).
 */
import type { AttributeMapping, CategoryId } from '../domain';

export interface CategoryDef {
  id: CategoryId;
  label: string;
  mapping: AttributeMapping;
  strong: readonly string[];
  weak: readonly string[];
}

const m = (primary: AttributeMapping['primary'], secondary: AttributeMapping['secondary'] = null): AttributeMapping => ({ primary, secondary });

/** El orden importa: con el mismo puntaje gana la que va antes. */
export const CATEGORIES: readonly CategoryDef[] = [
  // Fuerza
  { id: 'gimnasio', label: 'Gimnasio y ejercicio', mapping: m('fue', 'vit'), strong: ['gimnasio', 'gym', 'pesas', 'crossfit', 'calistenia', 'flexiones', 'sentadillas', 'abdominales', 'plancha', 'dominadas', 'rutina de fuerza'], weak: ['ejercicio', 'entrenar', 'entreno', 'entrenamiento', 'musculo'] },
  { id: 'deporte', label: 'Deporte', mapping: m('fue', 'dis'), strong: ['futbol', 'basquet', 'baloncesto', 'voley', 'natacion', 'nadar', 'tenis', 'padel', 'correr', 'running', 'trotar', 'ciclismo', 'bici', 'boxeo', 'artes marciales', 'escalada', 'maraton'], weak: ['deporte', 'partido', 'cardio'] },
  { id: 'caminar', label: 'Caminar y movilidad', mapping: m('fue', 'esp'), strong: ['caminar', 'caminata', 'pasos', 'estiramiento', 'estirar', 'yoga', 'movilidad', 'senderismo'], weak: ['pasear', 'paseo', 'postura'] },
  // Vitalidad
  { id: 'hidratacion', label: 'Hidratación', mapping: m('vit', 'dis'), strong: ['agua', 'vasos', 'hidratar', 'hidratacion', 'litros'], weak: ['beber', 'tomar', 'vaso'] },
  { id: 'sueno', label: 'Dormir bien', mapping: m('vit', 'esp'), strong: ['dormir', 'sueno', 'acostarme', 'acostarse', 'siesta', 'madrugar'], weak: ['levantarme', 'despertar', 'noche', 'pantallas'] },
  { id: 'alimentacion', label: 'Comer sano', mapping: m('vit', 'dis'), strong: ['fruta', 'frutas', 'verdura', 'verduras', 'ensalada', 'dieta', 'proteina', 'azucar', 'comida sana', 'cocinar', 'meal prep'], weak: ['comer', 'desayuno', 'desayunar', 'almuerzo', 'cena', 'cenar', 'comida'] },
  { id: 'descanso', label: 'Descanso y cuidado', mapping: m('vit', 'esp'), strong: ['descansar', 'descanso', 'vitaminas', 'medicina', 'pastilla', 'skincare', 'medico', 'dentista'], weak: ['pausa', 'ducha', 'relajar', 'cuidado', 'salud'] },
  // Intelecto
  { id: 'estudio', label: 'Estudio', mapping: m('int', 'dis'), strong: ['estudiar', 'estudio', 'examen', 'repasar', 'repaso', 'apuntes', 'universidad', 'tesis', 'parcial'], weak: ['clase', 'tarea', 'aprender', 'practicar', 'ejercicios'] },
  { id: 'curso', label: 'Cursos', mapping: m('int', 'dis'), strong: ['curso', 'udemy', 'coursera', 'platzi', 'edx', 'certificacion', 'bootcamp', 'leccion', 'modulo'], weak: ['capitulo', 'video', 'clases'] },
  { id: 'idiomas', label: 'Idiomas', mapping: m('int', 'dis'), strong: ['ingles', 'frances', 'aleman', 'portugues', 'italiano', 'japones', 'chino', 'idioma', 'idiomas', 'duolingo', 'vocabulario', 'speaking', 'listening'], weak: ['gramatica', 'pronunciacion'] },
  { id: 'lectura_tecnica', label: 'Lectura técnica', mapping: m('int', 'esp'), strong: ['documentacion', 'docs', 'paper', 'papers', 'manual', 'libro tecnico', 'investigacion', 'articulo tecnico'], weak: ['investigar', 'articulo'] },
  { id: 'codigo', label: 'Práctica de código', mapping: m('int', 'cre'), strong: ['programar', 'programacion', 'codigo', 'leetcode', 'hackerrank', 'kata', 'sql', 'python', 'javascript', 'typescript', 'java', 'react', 'node', 'git', 'api', 'backend', 'frontend', 'algoritmo', 'algoritmos', 'docker', 'excel', 'power bi', 'debug'], weak: ['code', 'script', 'base de datos', 'datos'] },
  // Disciplina
  { id: 'trabajo', label: 'Trabajo y pendientes', mapping: m('dis', 'int'), strong: ['trabajo', 'reunion', 'informe', 'reporte', 'correo', 'correos', 'email', 'tramite', 'factura', 'entregar', 'entrega', 'cliente', 'oficina'], weak: ['pagar', 'llamar', 'enviar', 'revisar', 'ordenar', 'limpiar', 'organizar', 'planificar', 'agenda'] },
  { id: 'finanzas', label: 'Finanzas', mapping: m('dis', 'int'), strong: ['ahorro', 'ahorrar', 'presupuesto', 'gastos', 'invertir', 'inversion', 'deuda', 'deudas', 'finanzas'], weak: ['banco', 'dinero', 'cuentas'] },
  // Espíritu
  { id: 'meditacion', label: 'Meditación', mapping: m('esp', 'vit'), strong: ['meditar', 'meditacion', 'mindfulness', 'respiracion', 'respirar', 'orar', 'oracion', 'rezar'], weak: ['calma', 'silencio'] },
  { id: 'journaling', label: 'Diario personal', mapping: m('esp', 'cre'), strong: ['diario', 'journal', 'journaling', 'gratitud', 'agradecer', 'reflexion', 'reflexionar'], weak: ['emociones', 'sentimientos'] },
  { id: 'lectura', label: 'Lectura recreativa', mapping: m('esp', 'int'), strong: ['novela', 'libro', 'libros', 'comic', 'manga', 'poesia'], weak: ['leer', 'lectura', 'paginas'] },
  { id: 'ocio', label: 'Ocio sano', mapping: m('esp', 'vit'), strong: ['amigos', 'familia', 'juego de mesa', 'pelicula', 'serie', 'naturaleza', 'hobby', 'jardin', 'jardineria', 'mascota', 'voluntariado'], weak: ['jugar', 'salir', 'visitar', 'disfrutar', 'llamada'] },
  // Creatividad
  { id: 'proyecto', label: 'Proyectos personales', mapping: m('cre', 'dis'), strong: ['proyecto', 'side project', 'emprendimiento', 'portafolio', 'portfolio', 'startup', 'prototipo', 'mvp'], weak: ['app', 'web', 'lanzar', 'construir', 'crear'] },
  { id: 'arte', label: 'Dibujo y música', mapping: m('cre', 'esp'), strong: ['dibujar', 'dibujo', 'pintar', 'pintura', 'guitarra', 'piano', 'bateria', 'ukelele', 'musica', 'cantar', 'ilustracion', 'fotografia', 'acuarela', 'diseno', 'componer', 'sketch'], weak: ['arte', 'instrumento', 'foto'] },
  { id: 'escritura', label: 'Escritura', mapping: m('cre', 'int'), strong: ['escribir', 'escritura', 'cuento', 'poema', 'guion', 'blog', 'redactar', 'newsletter'], weak: ['texto', 'historia'] },
  // Comodín
  { id: 'general', label: 'General', mapping: m('dis'), strong: [], weak: [] },
];

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id);

export const isCategoryId = (v: unknown): v is CategoryId => typeof v === 'string' && (CATEGORY_IDS as readonly string[]).includes(v);

export const categoryOf = (id: CategoryId): CategoryDef => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const DEFAULT_CATEGORY: CategoryId = 'general';
