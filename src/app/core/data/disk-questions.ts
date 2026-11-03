import { DiskQuestion } from '../models';

/**
 * Banco inicial de preguntas sobre almacenamiento. Los jueces pueden editarlo
 * en la configuración de la prueba. `correct` es el índice de la opción buena
 * (las opciones se barajan para cada grupo).
 */
export const DEFAULT_DISK_QUESTIONS: readonly DiskQuestion[] = [
  {
    text: '¿Qué significan las siglas SSD?',
    options: ['Solid State Drive (unidad de estado sólido)', 'Super Speed Disk', 'System Storage Device', 'Serial Storage Drive'],
    correct: 0,
  },
  {
    text: 'En un disco duro mecánico (HDD), ¿qué pieza lee y escribe los datos?',
    options: ['El cabezal', 'La memoria caché', 'El ventilador', 'La pila CMOS'],
    correct: 0,
  },
  {
    text: '¿Por qué bus se comunica un SSD M.2 NVMe con la placa base?',
    options: ['PCI Express', 'SATA', 'USB', 'IDE'],
    correct: 0,
  },
  {
    text: '¿Cuál es la velocidad máxima teórica de SATA III?',
    options: ['6 Gb/s', '3 Gb/s', '12 Gb/s', '1,5 Gb/s'],
    correct: 0,
  },
  {
    text: '¿A qué velocidad gira un HDD de sobremesa típico?',
    options: ['7200 rpm', '720 rpm', '72 000 rpm', '1200 rpm'],
    correct: 0,
  },
  {
    text: '¿En qué tipo de memoria guarda los datos un SSD?',
    options: ['Memoria flash NAND', 'Memoria DRAM', 'Platos magnéticos', 'Cinta magnética'],
    correct: 0,
  },
  {
    text: '¿Por qué un disco de "1 TB" aparece en Windows con unos 931 GB?',
    options: [
      'El fabricante cuenta 1 TB = 10¹² bytes y Windows divide entre potencias de 1024',
      'Windows ocupa el resto del espacio',
      'Vienen sectores defectuosos de fábrica',
      'El formateo comprime el disco',
    ],
    correct: 0,
  },
  {
    text: '¿Qué es la fragmentación de un archivo?',
    options: [
      'Que sus bloques quedan repartidos en zonas no contiguas del disco',
      'Que el archivo está dañado y no se puede abrir',
      'Que el archivo está comprimido en varios .zip',
      'Que el archivo está copiado en dos discos',
    ],
    correct: 0,
  },
  {
    text: '¿Conviene desfragmentar un SSD?',
    options: [
      'No: no tiene cabezal y solo gastaría ciclos de escritura',
      'Sí, una vez a la semana',
      'Sí, antes de formatearlo',
      'Solo si es NVMe',
    ],
    correct: 0,
  },
  {
    text: '¿Qué conector de alimentación usa un disco SATA?',
    options: ['SATA de 15 pines', 'Molex de 4 pines', 'PCIe de 8 pines', 'EPS de 8 pines'],
    correct: 0,
  },
  {
    text: '¿Cuántos pines tiene el conector de datos SATA?',
    options: ['7', '15', '40', '24'],
    correct: 0,
  },
  {
    text: '¿Qué tamaño tienen los discos SATA de portátil?',
    options: ['2,5 pulgadas', '3,5 pulgadas', '5,25 pulgadas', '1 pulgada'],
    correct: 0,
  },
  {
    text: 'En un SSD M.2 "2280", ¿qué indica ese número?',
    options: ['22 mm de ancho y 80 mm de largo', '2280 MB/s de lectura', 'El año del estándar', '2280 GB de capacidad'],
    correct: 0,
  },
  {
    text: '¿Qué esquema de particiones usan los equipos UEFI modernos?',
    options: ['GPT', 'FAT', 'NTFS', 'BIOS'],
    correct: 0,
  },
  {
    text: '¿Cuál es el tamaño máximo de un archivo en FAT32?',
    options: ['4 GB', '2 TB', '32 GB', 'No tiene límite'],
    correct: 0,
  },
  {
    text: '¿Qué sistema de archivos usa Windows por defecto en el disco del sistema?',
    options: ['NTFS', 'ext4', 'APFS', 'FAT16'],
    correct: 0,
  },
  {
    text: '¿Qué hace un RAID 1?',
    options: [
      'Copia los mismos datos en dos discos (espejo)',
      'Reparte los datos entre discos sin copia de seguridad',
      'Comprime los datos para que ocupen menos',
      'Cifra el disco con contraseña',
    ],
    correct: 0,
  },
  {
    text: 'Si falla uno de los discos de un RAID 0, ¿qué pasa?',
    options: [
      'Se pierden los datos de todo el conjunto',
      'Nada: el otro disco tiene una copia',
      'Solo va más lento',
      'Se reconstruye solo al cambiar el disco',
    ],
    correct: 0,
  },
  {
    text: '¿Cuántos bytes tiene un KiB (kibibyte)?',
    options: ['1024', '1000', '1048', '8192'],
    correct: 0,
  },
  {
    text: '¿Qué orden avisa al SSD de qué bloques ya no se usan tras borrar archivos?',
    options: ['TRIM', 'SMART', 'AHCI', 'DMA'],
    correct: 0,
  },
  {
    text: '¿Para qué sirve S.M.A.R.T. en un disco?',
    options: [
      'Para que el disco se autodiagnostique y avise de fallos',
      'Para acelerar el arranque de Windows',
      'Para cifrar los datos',
      'Para conectar el disco por wifi',
    ],
    correct: 0,
  },
  {
    text: 'En los discos con "Advanced Format", ¿cuánto ocupa un sector físico?',
    options: ['4096 bytes', '512 bits', '1 MiB', '64 bytes'],
    correct: 0,
  },
  {
    text: '¿Cuál de estas unidades suele ser la más rápida?',
    options: ['SSD NVMe', 'SSD SATA', 'HDD a 7200 rpm', 'HDD a 5400 rpm'],
    correct: 0,
  },
  {
    text: '¿Qué modo de la controladora SATA activa NCQ y la conexión en caliente?',
    options: ['AHCI', 'IDE', 'Legacy', 'CSM'],
    correct: 0,
  },
  {
    text: 'En el sistema de archivos FAT, ¿dónde se apunta qué bloques forman cada archivo?',
    options: ['En la tabla de asignación de archivos', 'En la BIOS', 'En la memoria RAM', 'En la caché del disco'],
    correct: 0,
  },
];
