import { DiskQuestion } from '../models';

/**
 * Banco inicial de preguntas de cultura general (fáciles): el disco guarda
 * información y el grupo tiene que "leerla". Los jueces pueden editarlo en la
 * configuración de la prueba. `correct` es el índice de la opción buena
 * (las opciones se barajan para cada grupo).
 */
export const DEFAULT_DISK_QUESTIONS: readonly DiskQuestion[] = [
  { text: '¿De qué país es típica la tortilla de patata?', options: ['España', 'Italia', 'México', 'Francia'], correct: 0 },
  { text: '¿Cuál es la capital de Francia?', options: ['París', 'Lyon', 'Marsella', 'Niza'], correct: 0 },
  { text: '¿Cuál es la capital de Italia?', options: ['Roma', 'Milán', 'Venecia', 'Florencia'], correct: 0 },
  { text: '¿Cuál es la capital de Portugal?', options: ['Lisboa', 'Oporto', 'Coímbra', 'Faro'], correct: 0 },
  { text: '¿Cuántos días tiene un año bisiesto?', options: ['366', '365', '364', '360'], correct: 0 },
  { text: '¿Cuál es el planeta más grande del sistema solar?', options: ['Júpiter', 'Saturno', 'La Tierra', 'Marte'], correct: 0 },
  { text: '¿Cuántos jugadores de cada equipo hay en el campo en un partido de fútbol?', options: ['11', '10', '9', '12'], correct: 0 },
  { text: '¿Qué color sale al mezclar azul y amarillo?', options: ['Verde', 'Morado', 'Naranja', 'Marrón'], correct: 0 },
  { text: '¿Qué animal es conocido como "el rey de la selva"?', options: ['El león', 'El tigre', 'El elefante', 'El gorila'], correct: 0 },
  {
    text: '¿Quién escribió "Don Quijote de la Mancha"?',
    options: ['Miguel de Cervantes', 'Lope de Vega', 'Federico García Lorca', 'Calderón de la Barca'],
    correct: 0,
  },
  { text: '¿Cuál es el océano más grande del mundo?', options: ['El Pacífico', 'El Atlántico', 'El Índico', 'El Ártico'], correct: 0 },
  { text: '¿En qué ciudad está la Sagrada Familia?', options: ['Barcelona', 'Madrid', 'Sevilla', 'Valencia'], correct: 0 },
  { text: '¿Cuántas patas tiene una araña?', options: ['8', '6', '10', '4'], correct: 0 },
  { text: '¿Qué gas necesitamos respirar para vivir?', options: ['Oxígeno', 'Helio', 'Hidrógeno', 'Dióxido de carbono'], correct: 0 },
  { text: '¿Cuál es la moneda actual de España?', options: ['El euro', 'La peseta', 'El dólar', 'La libra'], correct: 0 },
  { text: '¿Cuántos minutos tiene una hora?', options: ['60', '100', '30', '90'], correct: 0 },
  { text: '¿Quién pintó "Las Meninas"?', options: ['Velázquez', 'Goya', 'Picasso', 'Dalí'], correct: 0 },
  { text: '¿Cuál es el animal terrestre más rápido?', options: ['El guepardo', 'El león', 'El caballo', 'El avestruz'], correct: 0 },
  { text: '¿En qué continente está Egipto?', options: ['África', 'Asia', 'Europa', 'Oceanía'], correct: 0 },
  { text: '¿Cuántos lados tiene un hexágono?', options: ['6', '5', '7', '8'], correct: 0 },
  { text: '¿A qué temperatura hierve el agua (a nivel del mar)?', options: ['100 °C', '90 °C', '50 °C', '200 °C'], correct: 0 },
  { text: '¿Qué instrumento tiene teclas blancas y negras?', options: ['El piano', 'El violín', 'La guitarra', 'La trompeta'], correct: 0 },
  { text: '¿Cuál es el satélite natural de la Tierra?', options: ['La Luna', 'El Sol', 'Marte', 'Venus'], correct: 0 },
  { text: '¿Cuántas comunidades autónomas tiene España?', options: ['17', '15', '19', '21'], correct: 0 },
  { text: '¿Qué día es Navidad?', options: ['El 25 de diciembre', 'El 6 de enero', 'El 31 de diciembre', 'El 1 de noviembre'], correct: 0 },
  { text: '¿Qué se comen en España con las campanadas de Nochevieja?', options: ['Uvas', 'Manzanas', 'Aceitunas', 'Fresas'], correct: 0 },
  { text: '¿Qué metal precioso es de color amarillo?', options: ['El oro', 'La plata', 'El hierro', 'El aluminio'], correct: 0 },
  { text: '¿Qué órgano bombea la sangre por el cuerpo?', options: ['El corazón', 'Los pulmones', 'El hígado', 'Los riñones'], correct: 0 },
  { text: '¿Cuál es la montaña más alta del mundo?', options: ['El Everest', 'El K2', 'El Mont Blanc', 'El Teide'], correct: 0 },
  { text: '¿Cuál es el ingrediente principal de la paella?', options: ['El arroz', 'La pasta', 'La patata', 'El pan'], correct: 0 },
  { text: '¿Cuántos colores tiene el arcoíris?', options: ['7', '5', '6', '9'], correct: 0 },
];
