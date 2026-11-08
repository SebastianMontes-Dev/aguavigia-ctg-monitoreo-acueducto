// Los argumentos de `simulador <comando> [opciones]`. Se valida todo aquí, antes de tocar la API o la base.

const COMANDOS = ['iniciar', 'pausar', 'reanudar', 'velocidad', 'saltar', 'estado', 'reiniciar', 'datos', 'ayuda'];
const SIN_ARGUMENTOS = new Set(['pausar', 'reanudar', 'estado', 'reiniciar']);

function numeroPositivo(texto, que) {
  const numero = Number(String(texto ?? '').replace(/^x/i, '').replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) throw new Error(`${que} debe ser un número mayor que 0 (era '${texto}')`);
  return numero;
}

export function analizarArgumentos(argv) {
  const [comando, ...resto] = argv;
  if (comando === undefined || comando === 'ayuda' || comando === '--ayuda' || comando === '-h') return { comando: 'ayuda' };
  if (!COMANDOS.includes(comando)) throw new Error(`El comando '${comando}' no existe. Comandos: ${COMANDOS.join(', ')}`);
  if (SIN_ARGUMENTOS.has(comando)) return { comando };

  if (comando === 'velocidad') {
    if (resto.length === 0) throw new Error('Falta la velocidad: simulador velocidad <x> (p. ej. 60 o x60)');
    return { comando, velocidad: numeroPositivo(resto[0], 'La velocidad') };
  }
  if (comando === 'saltar') {
    if (resto.length === 0) throw new Error('Faltan las horas: simulador saltar <horas>');
    return { comando, horas: numeroPositivo(resto[0], 'Las horas a saltar') };
  }

  if (comando === 'datos') return analizarDatos(resto);

  // iniciar
  const opciones = { comando, velocidad: undefined, guion: undefined, reiniciar: false, detenerEnFallo: false };
  for (let i = 0; i < resto.length; i++) {
    const opcion = resto[i];
    if (opcion === '--reiniciar') opciones.reiniciar = true;
    else if (opcion === '--detener-en-fallo') opciones.detenerEnFallo = true;
    else if (opcion === '--velocidad' || opcion === '--guion') {
      if (i + 1 >= resto.length) throw new Error(`La opción ${opcion} necesita un valor`);
      const valor = resto[++i];
      if (opcion === '--velocidad') opciones.velocidad = numeroPositivo(valor, 'La velocidad');
      else opciones.guion = valor;
    } else throw new Error(`La opción '${opcion}' no existe para iniciar (--velocidad, --guion, --reiniciar, --detener-en-fallo)`);
  }
  return opciones;
}

const LIMITES_DE_DATOS = {
  '--reportes': { clave: 'reportes', minimo: 0, maximo: 200_000 },
  '--cortes': { clave: 'cortes', minimo: 0, maximo: 5_000 },
  '--dispositivos': { clave: 'dispositivos', minimo: 1, maximo: 50_000 },
  '--dias': { clave: 'dias', minimo: 1, maximo: 330 },
  '--semilla': { clave: 'semilla', minimo: -Number.MAX_SAFE_INTEGER, maximo: Number.MAX_SAFE_INTEGER },
};

/** `datos contar` o `datos generar [--reportes N] [--cortes N] [--dispositivos N] [--dias N] [--semilla N]` (ADR-111). */
function analizarDatos(resto) {
  const [accion, ...opciones] = resto;
  if (accion === 'contar') {
    if (opciones.length > 0) throw new Error("'datos contar' no recibe opciones");
    return { comando: 'datos', accion: 'contar' };
  }
  if (accion !== 'generar') throw new Error("Uso: simulador datos generar [--reportes N] [--cortes N] [--dispositivos N] [--dias N] [--semilla N] | datos contar");
  const plan = {};
  for (let i = 0; i < opciones.length; i++) {
    const limite = LIMITES_DE_DATOS[opciones[i]];
    if (!limite) throw new Error(`La opción '${opciones[i]}' no existe para datos generar (${Object.keys(LIMITES_DE_DATOS).join(', ')})`);
    if (i + 1 >= opciones.length) throw new Error(`La opción ${opciones[i]} necesita un valor`);
    const texto = opciones[++i];
    const numero = Number(texto);
    if (!Number.isInteger(numero) || numero < limite.minimo || numero > limite.maximo) {
      throw new Error(`${opciones[i - 1]} debe ser un entero entre ${limite.minimo} y ${limite.maximo} (era '${texto}')`);
    }
    plan[limite.clave] = numero;
  }
  if (!plan.reportes && !plan.cortes) throw new Error('Pide al menos --reportes o --cortes: sin ellos no hay nada que generar');
  return { comando: 'datos', accion: 'generar', plan };
}
