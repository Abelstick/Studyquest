/**
 * Qué es cada cosa y cuándo usarla. Un solo lugar para los textos, de modo que la guía, las pantallas y los formularios
 * digan siempre lo mismo. Escritos sin jerga de videojuego: pensados para alguien que llega por primera vez.
 */
import type { SpriteName } from '@/ui/sprites';

export type ConceptId = 'tarea' | 'habito' | 'meta' | 'proyecto';

/** Algo que suele confundirse con este concepto, y qué es en realidad. */
export interface NotThis {
  text: string;
  instead: ConceptId;
  why: string;
}

export interface Concept {
  id: ConceptId;
  name: string;
  sprite: SpriteName;
  /** Una frase: qué es. */
  what: string;
  /** La pregunta que te haces para elegirlo. */
  question: string;
  /** Varios ejemplos de contextos distintos (estudio, trabajo, vida diaria). */
  examples: string[];
  /** Cómo se comporta y qué XP da. */
  how: string;
  /** Texto corto bajo el título de su pantalla. */
  hint: string;
  /** Lo que NO es (y qué es). */
  notThis: NotThis[];
}

export const CONCEPTS: Record<ConceptId, Concept> = {
  tarea: {
    id: 'tarea',
    name: 'Tarea',
    sprite: 'qblock',
    what: 'Algo concreto que haces una vez y se termina.',
    question: '¿Lo hago una sola vez (quizá con fecha límite)?',
    examples: [
      'Entregar el informe del viernes',
      'Resolver los 8 ejercicios de JOIN',
      'Pedir cita con el dentista',
      'Comprar el libro de estadística',
      'Preparar la presentación del lunes',
    ],
    how: 'Tiene un final: la marcas como hecha y sale de tu lista. Da XP al completarla.',
    hint: 'Cosas concretas que haces una vez y terminas, como entregar un trabajo. Si se repite cada día, es un hábito.',
    notThis: [
      { text: 'Leer todos los días', instead: 'habito', why: 'se repite: importa la constancia, no terminarlo.' },
      { text: 'Aprender inglés', instead: 'meta', why: 'es un resultado a largo plazo, con muchos pasos.' },
      { text: 'Hacer mi portafolio', instead: 'proyecto', why: 'es algo que se construye por partes.' },
    ],
  },
  habito: {
    id: 'habito',
    name: 'Hábito',
    sprite: 'flower',
    what: 'Algo que repites con regularidad y quieres hacer con constancia.',
    question: '¿Lo quiero repetir (cada día, cada semana…) y ver mi racha?',
    examples: [
      'Leer 20 minutos al día',
      'Estudiar inglés 30 min de lunes a viernes',
      'Hacer ejercicio tres veces por semana',
      'Repasar mis apuntes cada noche',
      'Dormir antes de las 11',
    ],
    how: 'Nunca «termina»: cuenta los días que cumples y tu racha. Da XP cada vez que lo cumples y puede avisarte con un recordatorio.',
    hint: 'Rutinas que repites: leer cada día, hacer ejercicio… Aquí importa la constancia y la racha, no terminarlas.',
    notThis: [
      { text: 'Entregar el informe', instead: 'tarea', why: 'se hace una vez y se acaba.' },
      { text: 'Bajar 5 kilos', instead: 'meta', why: 'es un resultado, no una rutina (el hábito sería «salir a caminar 30 min»).' },
    ],
  },
  meta: {
    id: 'meta',
    name: 'Meta',
    sprite: 'flag',
    what: 'Lo que quieres lograr a largo plazo, dividido en hitos.',
    question: '¿Es un resultado grande que me llevará semanas o meses?',
    examples: [
      'Aprender análisis de datos',
      'Sacar el B2 de inglés',
      'Ahorrar 2 000 € este año',
      'Correr una media maratón',
      'Aprobar el examen de admisión',
    ],
    how: 'No se hace «de golpe»: avanzas hito a hito, con tus tareas y hábitos. Da XP por cada hito y una recompensa al final.',
    hint: 'Lo que quieres lograr a largo plazo (aprender SQL, sacar un título). Se divide en hitos y avanzas con tareas y hábitos.',
    notThis: [
      { text: 'Estudiar 1 hora al día', instead: 'habito', why: 'es una rutina que repites, no un resultado.' },
      { text: 'Terminar el ejercicio 4', instead: 'tarea', why: 'es un paso pequeño y concreto.' },
    ],
  },
  proyecto: {
    id: 'proyecto',
    name: 'Proyecto',
    sprite: 'chest',
    what: 'Algo que construyes y entregas, hecho de varias partes.',
    question: '¿Voy a crear algo tangible que existirá al final?',
    examples: [
      'Mi portafolio web',
      'Mi tesis',
      'Crear una app de recetas',
      'Organizar el viaje de fin de curso',
      'Montar mi tienda online',
    ],
    how: 'Se divide en checkpoints (las partes que entregas). Da XP por cada checkpoint.',
    hint: 'Algo que construyes y entregas: un portafolio, una tesis, una app. Se divide en partes (checkpoints).',
    notThis: [
      { text: 'Aprender a programar', instead: 'meta', why: 'es lo que quieres lograr; el proyecto es lo que fabricas para lograrlo.' },
      { text: 'Subir el archivo al campus', instead: 'tarea', why: 'es un paso suelto (puede ser un checkpoint de un proyecto).' },
    ],
  },
};

export const CONCEPT_ORDER: ConceptId[] = ['tarea', 'habito', 'meta', 'proyecto'];

/** Ejemplos completos de cómo encajan las cuatro cosas en una misma ambición. */
export interface Chain {
  label: string;
  ambition: string;
  meta: string;
  habito: string;
  tarea: string;
  proyecto: string;
}

export const EXAMPLE_CHAINS: Chain[] = [
  {
    label: 'Estudiar datos',
    ambition: 'Quiero ser analista de datos',
    meta: 'Meta: «Ser analista de datos» con el hito «Aprender SQL»',
    habito: 'Hábito: «Practicar SQL 30 minutos al día»',
    tarea: 'Tarea: «Resolver los 8 ejercicios de JOIN» (para el viernes)',
    proyecto: 'Proyecto: «Dashboard de ventas» para mi portafolio',
  },
  {
    label: 'Sacar el B2 de inglés',
    ambition: 'Quiero certificar mi inglés B2 este año',
    meta: 'Meta: «Aprobar el examen B2» con hitos: gramática, listening, speaking',
    habito: 'Hábito: «Escuchar un podcast en inglés cada mañana»',
    tarea: 'Tarea: «Inscribirme al examen antes del 15 de marzo»',
    proyecto: 'Proyecto: «Cuaderno de vocabulario» con un checkpoint por unidad',
  },
  {
    label: 'Ponerme en forma',
    ambition: 'Quiero correr una media maratón',
    meta: 'Meta: «Correr 21 km» con hitos: 5 km, 10 km, 15 km, 21 km',
    habito: 'Hábito: «Salir a correr martes, jueves y sábado»',
    tarea: 'Tarea: «Comprar zapatillas de running» (esta semana)',
    proyecto: 'Proyecto: «Plan de entrenamiento de 12 semanas» con un checkpoint por mes',
  },
  {
    label: 'Lanzar mi negocio',
    ambition: 'Quiero vender mis pulseras por internet',
    meta: 'Meta: «Tener mis primeras 50 ventas» con hitos: tienda lista, primeras 10 ventas…',
    habito: 'Hábito: «Publicar en redes 5 días a la semana»',
    tarea: 'Tarea: «Fotografiar los 10 modelos» (para el domingo)',
    proyecto: 'Proyecto: «Tienda online» con checkpoints: diseño, catálogo, pagos, lanzamiento',
  },
];

/** Casos que suelen confundir. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: '¿Y una tarea que se repite (pagar el alquiler cada mes)?',
    a: 'Sigue siendo una tarea: cada vez es una entrega con fecha, y al completarla nace la siguiente («Repetir» en el formulario). Si lo importante es la constancia y la racha, mejor un hábito.',
  },
  {
    q: '¿Meta o proyecto?',
    a: 'La meta es lo que quieres lograr o aprender («ser analista»); el proyecto es lo que fabricas («mi portafolio»). Un proyecto puede ayudarte a cumplir una meta.',
  },
  {
    q: '¿Puedo tener una meta sin proyecto (o al revés)?',
    a: 'Sí. «Correr 21 km» es una meta sin proyecto; «organizar la fiesta de graduación» es un proyecto sin meta detrás. Úsalos solo cuando te ayuden.',
  },
  {
    q: '¿Y los cursos?',
    a: 'Un curso es una asignatura o programa con sus temas, para llevar el avance de lo que estudias. Las tareas y las sesiones de estudio se pueden asociar a un curso.',
  },
  {
    q: 'No sé por dónde empezar',
    a: 'Empieza por una meta que te importe y pregúntate: ¿qué hago cada día para acercarme? (hábito) ¿qué pasos concretos hay? (tareas) ¿qué voy a construir? (proyecto). O usa el Planificador: lo arma todo por ti a partir de un objetivo.',
  },
];

/** Mini test para practicar: ¿qué es cada cosa? */
export interface QuizItem {
  text: string;
  answer: ConceptId;
  why: string;
}

export const QUIZ: QuizItem[] = [
  { text: 'Entregar la tarea de Estadística el jueves', answer: 'tarea', why: 'Se hace una vez, tiene fecha y se acaba.' },
  { text: 'Meditar 10 minutos cada mañana', answer: 'habito', why: 'Se repite cada día: lo que importa es la constancia.' },
  { text: 'Ahorrar 2 000 € para el viaje', answer: 'meta', why: 'Es un resultado a largo plazo; se logra con hábitos (ahorrar cada mes) y tareas.' },
  { text: 'Construir mi sitio web personal', answer: 'proyecto', why: 'Es algo que se fabrica y se entrega, por partes.' },
  { text: 'Pedir la beca en la oficina de becas', answer: 'tarea', why: 'Un paso concreto que se hace una vez.' },
  { text: 'Ir al gimnasio lunes, miércoles y viernes', answer: 'habito', why: 'Se repite en días fijos y quieres ver tu racha.' },
  { text: 'Aprobar el examen de admisión', answer: 'meta', why: 'Es el resultado que quieres lograr; se divide en hitos por materia.' },
  { text: 'Escribir mi tesis', answer: 'proyecto', why: 'Es algo tangible con partes: capítulos, revisión, entrega.' },
  { text: 'Pagar la matrícula (cada semestre)', answer: 'tarea', why: 'Se repite, pero cada vez es una entrega con fecha: una tarea repetida.' },
  { text: 'Practicar guitarra 15 minutos al día', answer: 'habito', why: 'Es una rutina diaria; la meta sería «tocar una canción completa».' },
];
