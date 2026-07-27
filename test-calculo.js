/* Pruebas de la aritmetica oficial.  Correr con:  node test-calculo.js
 *
 * Los ejemplos A y B son los dos casos reales capturados de SIGA: si alguno se
 * rompe, el peso academico que muestra la app dejo de coincidir con el de la
 * facultad.
 */
'use strict';

var C = require('./calculo.js');
var fs = require('fs');
var path = require('path');

// plan.js es un script de navegador que declara globales con `var`.
var fuente = fs.readFileSync(path.join(__dirname, 'plan.js'), 'utf8');
var cargado = new Function(fuente + '\nreturn {PLAN_K23: PLAN_K23, ELECTIVAS_K23: ELECTIVAS_K23, ' +
  'CUPO_ELECTIVAS: CUPO_ELECTIVAS, ELECTIVAS_NIVEL5: ELECTIVAS_NIVEL5};')();
var PLAN_K23 = cargado.PLAN_K23;
var ELECTIVAS_K23 = cargado.ELECTIVAS_K23;
var CUPO_ELECTIVAS = cargado.CUPO_ELECTIVAS;
var ELECTIVAS_NIVEL5 = cargado.ELECTIVAS_NIVEL5;

var fallas = 0, corridas = 0;

function comprobar(nombre, real, esperado) {
  corridas++;
  var a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) console.log('  ok   ' + nombre);
  else {
    fallas++;
    console.log('  FALLA ' + nombre + '\n         esperado: ' + b + '\n         obtenido: ' + a);
  }
}
function seccion(t) { console.log('\n' + t); }

var HOY = new Date(2026, 6, 26); // 26/07/2026
var indice = {};
PLAN_K23.forEach(function (m) { indice[m.codigo] = m; });

function estadosDe(mapa) { return function (id) { return C.estadoDe(mapa[id]); }; }
function ap(anio, nota) { return { estado: 'aprobada', nota: nota, anio: anio }; }
function rg(anio) { return { estado: 'regularizada', nota: null, anio: anio }; }
function pr(anio, nota) { return { estado: 'promocionada', nota: nota, anio: anio }; }

// --------------------------------------------------------------- ciclo lectivo

seccion('Ciclo lectivo (corta el 15 de marzo)');
comprobar('14/03/2026 pertenece al ciclo 2025', C.cicloLectivo(new Date(2026, 2, 14)), 2025);
comprobar('15/03/2026 pertenece al ciclo 2026', C.cicloLectivo(new Date(2026, 2, 15)), 2026);
comprobar('05/01/2026 pertenece al ciclo 2025', C.cicloLectivo(new Date(2026, 0, 5)), 2025);
comprobar('26/07/2026 pertenece al ciclo 2026', C.cicloLectivo(HOY), 2026);

// ------------------------------------------------------------ Ordenanza 1549

seccion('Nota ponderada (Ordenanza 1549, solo ciclos anteriores a 2017)');
comprobar('un 4 de 2016 pondera 6', C.notaPonderada(2016, 4), 6);
comprobar('un 8 de 2016 pondera 8.67', C.notaPonderada(2016, 8), 8.67);
comprobar('un 6 de 2016 pondera 7.33', C.notaPonderada(2016, 6), 7.33);
comprobar('un 4 de 2017 no se altera', C.notaPonderada(2017, 4), 4);
comprobar('un 8 de 2026 no se altera', C.notaPonderada(2026, 8), 8);
comprobar('sin nota devuelve null', C.notaPonderada(2016, null), null);

// -------------------------------------------------------------------- estados

seccion('Estados');
comprobar('hay 6 estados', C.ESTADOS.length, 6);
comprobar('en el orden pedido', C.ESTADOS.map(function (e) { return e.id; }),
  ['sin-cursar', 'cursando', 'regularizada', 'aprobada', 'promocionada', 'abandonada']);
comprobar('sin registro es sin-cursar', C.estadoDe(null), 'sin-cursar');

// El nucleo del modelo: regularizada NO es aprobada.
comprobar('aprobada cuenta como materia aprobada', !!C.APROBADAS['aprobada'], true);
comprobar('promocionada cuenta como materia aprobada', !!C.APROBADAS['promocionada'], true);
comprobar('regularizada NO cuenta como materia aprobada', !!C.APROBADAS['regularizada'], false);
comprobar('cursando no cuenta como materia aprobada', !!C.APROBADAS['cursando'], false);
comprobar('pero regularizada si cuenta como cursada aprobada',
  !!C.TIENE_CURSADA['regularizada'], true);

var soloRegu = { materias: { '082021': rg(2025) } };
var mRegu = C.metricas(PLAN_K23, soloRegu, C.ajustesVacios(), HOY);
comprobar('una materia regularizada suma un final adeudado', mRegu.fAdTotal, 1);
comprobar('y no suma a las aprobadas', mRegu.mApTotal, 0);
comprobar('regularizada en un ciclo anterior: solo resta 7', mRegu.pesoNuevo, -7);

// Si la regularizaste en el ciclo actual, ademas suma 5 por MR_ciclo.
var reguHoy = { materias: { '082021': rg(2026) } };
var mReguHoy = C.metricas(PLAN_K23, reguHoy, C.ajustesVacios(), HOY);
comprobar('regularizada este ciclo: -7 del adeudado +5 de MR_ciclo', mReguHoy.pesoNuevo, -2);

// Y rendir el final la convierte en aprobada: se va el -7 y entra el +11.
var yaAprobada = { materias: { '082021': ap(2026, 7) } };
comprobar('aprobar el final da vuelta el signo',
  C.metricas(PLAN_K23, yaAprobada, C.ajustesVacios(), HOY).pesoNuevo, 11 + 5);

// --------------------------------------------------------------- correlativas

seccion('Correlativas del plan');

comprobar('el plan tiene 38 materias (37 obligatorias + Seminario Integrador)', PLAN_K23.length, 38);
comprobar('37 son obligatorias para el titulo de grado',
  PLAN_K23.filter(function (m) { return !m.opcional; }).length, 37);
comprobar('hay 85 correlativas',
  PLAN_K23.reduce(function (a, m) { return a + m.correlativas.length; }, 0), 85);
comprobar('toda correlativa apunta a una materia existente',
  PLAN_K23.every(function (m) {
    return m.correlativas.every(function (r) { return !!indice[r.de]; });
  }), true);
// Hay correlativas dentro del mismo nivel (materias cuatrimestrales que se
// cursan una despues de la otra), pero nunca de un nivel posterior.
comprobar('ninguna correlativa viene de un nivel posterior',
  PLAN_K23.every(function (m) {
    return m.correlativas.every(function (r) { return indice[r.de].nivel <= m.nivel; });
  }), true);

var vacio = estadosDe({});
var deEntrada = PLAN_K23.filter(function (m) { return C.puedeCursar(m, vacio); });
comprobar('sin nada cargado hay 9 materias para cursar', deEntrada.length, 9);
comprobar('son las 8 de nivel 1 mas Ingenieria y Sociedad',
  deEntrada.map(function (m) { return m.codigo; }).sort(),
  ['082021', '082022', '232010', '232011', '950605', '950701', '950702', '951602', '951604'].sort());

var una = estadosDe({ '082021': ap(2025, 7) });
comprobar('con una sola de sus dos correlativas, Sintaxis no se habilita',
  C.puedeCursar(indice['082025'], una), false);
comprobar('y falta exactamente 1', C.faltantes(indice['082025'], una).length, 1);

var dos = estadosDe({ '082021': ap(2025, 7), '232010': pr(2025, 9) });
comprobar('con las dos, Sintaxis se habilita', C.puedeCursar(indice['082025'], dos), true);

// Economia (950309) exige APROBAR Algebra (950701) y Analisis Matematico I (950702):
// tenerlas regularizadas no alcanza.
var mateRegu = estadosDe({ '950701': rg(2024), '950702': rg(2024) });
comprobar('regularizar las matematicas NO habilita Economia',
  C.puedeCursar(indice['950309'], mateRegu), false);
comprobar('y le faltan las 2 correlativas',
  C.faltantes(indice['950309'], mateRegu).length, 2);

var mateAp = estadosDe({ '950701': ap(2024, 6), '950702': pr(2024, 8) });
comprobar('aprobarlas (una por final, otra por promocion) si habilita Economia',
  C.puedeCursar(indice['950309'], mateAp), true);

// Sintaxis (082025) pide REGULARIZAR sus dos correlativas: ahi si alcanza.
var sintaxisRegu = estadosDe({ '082021': rg(2025), '232010': rg(2025) });
comprobar('para una correlativa de tipo Regularizar alcanza con regularizarla',
  C.puedeCursar(indice['082025'], sintaxisRegu), true);

var cursando = estadosDe({ '082021': { estado: 'cursando', anio: 2026 } });
comprobar('cursando no habilita a sus dependientes',
  C.puedeCursar(indice['082026'], cursando), false);
comprobar('una materia en curso no figura como cursable',
  C.puedeCursar(indice['082021'], cursando), false);

var abandonada = estadosDe({ '082021': { estado: 'abandonada', anio: 2025 } });
comprobar('una abandonada se puede volver a cursar',
  C.puedeCursar(indice['082021'], abandonada), true);

seccion('Cadena hacia atras y dependientes');
var cadenaDSI = C.cadenaPrevia(indice['232034'], indice).map(function (m) { return m.codigo; });
comprobar('Diseno de Sistemas arrastra 6 materias previas', cadenaDSI.length, 6);
comprobar('e incluye a Algoritmos, que esta dos niveles atras',
  cadenaDSI.indexOf('082021') >= 0, true);
comprobar('Algoritmos no tiene cadena previa',
  C.cadenaPrevia(indice['082021'], indice).length, 0);
comprobar('Analisis de Sistemas es correlativa de 5 materias',
  C.dependientes('232020', PLAN_K23).length, 5);
comprobar('Proyecto Final no destraba nada',
  C.dependientes('082037', PLAN_K23).length, 0);

// ------------------------------------------------------- ejemplo oficial A

seccion('Ejemplo oficial A — peso 133 (hasta CL2026) y 151 (desde CL2027)');

var datosA = { materias: {} };
for (var i = 0; i < 15; i++) datosA.materias[PLAN_K23[i].codigo] = ap(2023 + (i % 3), 8);
// Dos regularizadas: son los 2 finales adeudados del ejemplo, ahora derivados
// del estado en vez de cargados a mano.
datosA.materias[PLAN_K23[15].codigo] = rg(2024);
datosA.materias[PLAN_K23[16].codigo] = rg(2025);
var ajA = { anioInicio: 2023, finalesDesaprobados: 4, ausentesCiclo: 0 };

var mA = C.metricas(PLAN_K23, datosA, ajA, HOY);
comprobar('MAp_total = 15', mA.mApTotal, 15);
comprobar('FAd_total = 2, derivado de las regularizadas', mA.fAdTotal, 2);
comprobar('anios de carrera = 4 (desde 2023)', mA.aniosCarrera, 4);
comprobar('MR_ciclo = 0 (nada aprobado en 2026)', mA.mRCiclo, 0);
comprobar('MAb_ciclo = 0', mA.mAbCiclo, 0);
comprobar('peso academico hasta CL2026 = 133', mA.pesoViejo, 133);
comprobar('peso academico desde CL2027 = 151', mA.pesoNuevo, 151);

// ------------------------------------------------------- ejemplo oficial B

seccion('Ejemplo oficial B — peso 169 = 11x17 - 3x1 - 5x3');

var datosB = { materias: {} };
for (var j = 0; j < 17; j++) datosB.materias[PLAN_K23[j].codigo] = ap(2024, 7);
var ajB = { anioInicio: 2024, finalesDesaprobados: 1, ausentesCiclo: 0 };

var mB = C.metricas(PLAN_K23, datosB, ajB, HOY);
comprobar('MAp_total = 17', mB.mApTotal, 17);
comprobar('anios de carrera = 3 (desde 2024)', mB.aniosCarrera, 3);
comprobar('peso academico hasta CL2026 = 169', mB.pesoViejo, 169);

// ------------------------------------------------- terminos del ciclo actual

seccion('Terminos del ultimo ciclo lectivo (2026)');

var datosC = { materias: {
  '082021': ap(2026, 8),                          // aprobada este ciclo -> MR_ciclo
  '082022': { estado: 'abandonada', anio: 2026 },  // abandonada este ciclo -> MAb_ciclo
  '232010': { estado: 'abandonada', anio: 2025 },  // de otro ciclo, no cuenta
  '232011': { estado: 'cursando', anio: 2026 },
  '950701': rg(2024), '950702': rg(2024), '950605': rg(2025)  // tres finales adeudados
} };
var ajC = { anioInicio: 2024, finalesDesaprobados: 0, ausentesCiclo: 1 };

var mC = C.metricas(PLAN_K23, datosC, ajC, HOY);
comprobar('FAd_total = 3, derivado de las regularizadas', mC.fAdTotal, 3);
comprobar('MR_ciclo = 1 (las regularizadas son de ciclos anteriores)', mC.mRCiclo, 1);
comprobar('MAb_ciclo = 1 (la de 2025 no cuenta)', mC.mAbCiclo, 1);
comprobar('FAu_ciclo = 1 (viene de Ajustes)', mC.fAuCiclo, 1);
comprobar('cursando = 1', mC.cursando, 1);
comprobar('peso nuevo = 11x1 - 7x3 - 19x1 - 17x1 + 5x1 = -41', mC.pesoNuevo, -41);

// ------------------------------------------------------------------ promedios

seccion('Promedios');

var datosP = { materias: {
  '082021': ap(2025, 8),
  '082022': ap(2025, 10),
  '232010': pr(2026, 6),
  '232011': { estado: 'cursando', anio: 2026 },   // sin nota, no promedia
  '950701': ap(2025, null)                        // aprobada sin nota cargada
} };
var mP = C.metricas(PLAN_K23, datosP, C.ajustesVacios(), HOY);
comprobar('promedio = 8 ((8+10+6)/3)', mP.promedio, 8);
comprobar('una aprobada sin nota cuenta como aprobada pero no promedia', mP.mApTotal, 4);
comprobar('desde 2017 el ponderado coincide con el original', mP.promedioPonderado, mP.promedio);

var datosV = { materias: { '082021': ap(2015, 4) } };
var mV = C.metricas(PLAN_K23, datosV, C.ajustesVacios(), HOY);
comprobar('un 4 de 2015: original 4, ponderado 6', [mV.promedio, mV.promedioPonderado], [4, 6]);

// -------------------------------------------------------------- sin datos

seccion('Sin datos');
var m0 = C.metricas(PLAN_K23, { materias: {} }, C.ajustesVacios(), HOY);
comprobar('no inventa anios de carrera', m0.aniosCarrera, 0);
comprobar('no hay promedio', m0.promedio, null);
comprobar('hayDatos es false', m0.hayDatos, false);

var m1 = C.metricas(PLAN_K23, { materias: {} },
  { anioInicio: 2022, finalesDesaprobados: 0, ausentesCiclo: 0 }, HOY);
comprobar('con anio de inicio manual, 5 anios de carrera', m1.aniosCarrera, 5);
comprobar('y el peso viejo da -25', m1.pesoViejo, -25);

// ---------------------------------------------------------------- electivas

seccion('Electivas');
comprobar('hay 19 electivas en el listado', ELECTIVAS_K23.length, 19);

// ------------------------------------------------------- analisis del grafo

seccion('Impacto: cuanto destraba una materia');

comprobar('una materia de nivel 5 no destraba nada',
  C.descendientes('082037', PLAN_K23).length, 0);
var descAlg = C.descendientes('082021', PLAN_K23).map(function (m) { return m.codigo; });
comprobar('Algoritmos arrastra descendientes indirectos (Bases de Datos)',
  descAlg.indexOf('232030') >= 0, true);
comprobar('y tambien llega hasta Proyecto Final',
  descAlg.indexOf('082037') >= 0, true);

var impAlgVacio = C.impacto(indice['082021'], PLAN_K23, estadosDe({}));
comprobar('Algoritmos es correlativa de 7 materias', impAlgVacio.directas.length, 7);
comprobar('pero sin nada mas aprobado no destraba ninguna todavia',
  impAlgVacio.destrabaYa.length, 0);

var casiTodo = estadosDe({ '232010': ap(2025, 7), '232011': ap(2025, 7) });
var impAlg = C.impacto(indice['082021'], PLAN_K23, casiTodo);
comprobar('con Logica y Sistemas y Procesos ya aprobadas, Algoritmos destraba 3',
  impAlg.destrabaYa.length, 3);

seccion('Camino critico');

var critVacio = C.caminoCritico(PLAN_K23, estadosDe({}));
comprobar('sin nada aprobado la cadena tiene 5 materias', critVacio.largo, 5);
comprobar('y el camino tiene 5 materias', critVacio.camino.length, 5);
comprobar('cada eslabon es correlativa del siguiente',
  critVacio.camino.every(function (m, i) {
    if (i === 0) return true;
    return m.correlativas.some(function (r) { return r.de === critVacio.camino[i - 1].codigo; });
  }), true);
comprobar('el camino termina en una materia de nivel 5',
  critVacio.camino[critVacio.camino.length - 1].nivel, 5);

var todoAprobado = {};
PLAN_K23.forEach(function (m) { todoAprobado[m.codigo] = ap(2025, 7); });
comprobar('con todo aprobado no queda camino',
  C.caminoCritico(PLAN_K23, estadosDe(todoAprobado)).largo, 0);

// Sobre el plan real hay varias cadenas de largo 5 en paralelo, asi que aprobar
// un eslabon de una no baja el piso: solo garantiza que no sube.
var unPaso = {};
unPaso[critVacio.camino[0].codigo] = ap(2025, 7);
comprobar('aprobar un eslabon nunca alarga el camino',
  C.caminoCritico(PLAN_K23, estadosDe(unPaso)).largo <= critVacio.largo, true);

// Grafo chico para fijar el algoritmo sin ambiguedad.
var mini = [
  { codigo: 'A', nombre: 'A', nivel: 1, correlativas: [] },
  { codigo: 'B', nombre: 'B', nivel: 2, correlativas: [{ de: 'A', tipo: 'REGULARIZAR' }] },
  { codigo: 'C', nombre: 'C', nivel: 3, correlativas: [{ de: 'B', tipo: 'REGULARIZAR' }] },
  { codigo: 'D', nombre: 'D', nivel: 2, correlativas: [] }
];
comprobar('cadena A-B-C de cuatrimestrales: el piso es 3', C.caminoCritico(mini, estadosDe({})).cuatri, 3);
comprobar('y el camino es A, B, C',
  C.caminoCritico(mini, estadosDe({})).camino.map(function (m) { return m.codigo; }), ['A', 'B', 'C']);
comprobar('con A aprobada el piso baja a 2',
  C.caminoCritico(mini, estadosDe({ A: ap(2025, 7) })).cuatri, 2);
comprobar('con A y B aprobadas baja a 1',
  C.caminoCritico(mini, estadosDe({ A: ap(2025, 7), B: ap(2025, 7) })).cuatri, 1);

// Una materia anual ocupa dos cuatrimestres.
var miniAnual = [
  { codigo: 'A', nombre: 'A', nivel: 1, duracion: 'anual', correlativas: [] },
  { codigo: 'B', nombre: 'B', nivel: 2, duracion: 'cuatri', correlativas: [{ de: 'A', tipo: 'REGULARIZAR' }] }
];
var cAnual = C.caminoCritico(miniAnual, estadosDe({}));
comprobar('una anual mas una cuatrimestral son 3 cuatrimestres', cAnual.cuatri, 3);
comprobar('aunque la cadena tenga solo 2 materias', cAnual.largo, 2);
// Rendir un final no consume un cuatrimestre de cursada: una materia que ya
// cursaste traba la cadena pero no la alarga.
var miniRegu = [
  { codigo: 'A', nombre: 'A', nivel: 1, duracion: 'anual', correlativas: [] },
  { codigo: 'B', nombre: 'B', nivel: 2, duracion: 'cuatri', correlativas: [{ de: 'A', tipo: 'APROBAR' }] }
];
comprobar('con A sin cursar: 2 (anual) + 1 = 3 cuatrimestres',
  C.caminoCritico(miniRegu, estadosDe({})).cuatri, 3);
comprobar('con A regularizada el final no cuesta cuatrimestres, queda 1',
  C.caminoCritico(miniRegu, estadosDe({ A: rg(2025) })).cuatri, 1);
comprobar('pero A sigue en la cadena, porque traba',
  C.caminoCritico(miniRegu, estadosDe({ A: rg(2025) })).largo, 2);
comprobar('una materia en curso tampoco suma cuatrimestres',
  C.caminoCritico(miniRegu, estadosDe({ A: { estado: 'cursando', anio: 2026 } })).cuatri, 1);
comprobar('con A aprobada sale de la cadena',
  C.caminoCritico(miniRegu, estadosDe({ A: ap(2025, 7) })).largo, 1);


seccion('Simulador de inscripcion');

var datosS = { materias: { '232010': ap(2025, 7), '232011': ap(2025, 8) } };
var ajS = { anioInicio: 2025, finalesDesaprobados: 0, ausentesCiclo: 0 };

// Algoritmos esta habilitada; Sintaxis todavia no (le falta Algoritmos).
var s1 = C.simular(PLAN_K23, datosS, ajS, ['082021'], HOY);
comprobar('la simulacion no toca los datos originales',
  C.estadoDe(datosS.materias['082021']), 'sin-cursar');
comprobar('aprobar Algoritmos sube el peso viejo en 11',
  s1.despues.pesoViejo - s1.base.pesoViejo, 11);
comprobar('y el nuevo en 16 (11 por aprobada + 5 por regularizada del ciclo)',
  s1.despues.pesoNuevo - s1.base.pesoNuevo, 16);
comprobar('destraba 3 materias', s1.destrabadas.length, 3);
comprobar('y el combo es viable', s1.viable, true);

// Elegir una materia que todavia no se puede cursar.
var s2 = C.simular(PLAN_K23, datosS, ajS, ['082025'], HOY);
comprobar('elegir una materia no habilitada se marca', s2.noHabilitadas.length, 1);
comprobar('y el combo deja de ser viable', s2.viable, false);

// Elegir una materia y su propia correlativa en la misma tanda.
var s3 = C.simular(PLAN_K23, datosS, ajS, ['082021', '082026'], HOY);
comprobar('cursar una materia junto con su correlativa es un conflicto',
  s3.conflictos.length, 1);
comprobar('dos materias suman 22 al peso viejo',
  s3.despues.pesoViejo - s3.base.pesoViejo, 22);

// Abandonar y aprobar la misma materia en el mismo ciclo no puede pasar: la
// penalizacion de -17 tiene que seguir en pie despues de simular.
var datosAb = { materias: { '082021': { estado: 'abandonada', nota: null, anio: 2026 } } };
var ajAb = { anioInicio: 2024, finalesDesaprobados: 0, ausentesCiclo: 0 };
var sAb = C.simular(PLAN_K23, datosAb, ajAb, ['082021'], HOY);
comprobar('simular una materia abandonada este ciclo no borra su penalizacion',
  sAb.despues.pesoNuevo - sAb.base.pesoNuevo, 16);
comprobar('el conflicto nombra a la materia y a lo que requiere',
  [s3.conflictos[0].materia.codigo, s3.conflictos[0].requiere.codigo], ['082026', '082021']);
comprobar('y el combo no es viable', s3.viable, false);

// -------------------------------------------------- evolucion y proyeccion

seccion('Evolución del peso académico');

var datosH = { materias: {
  '082021': ap(2023, 8), '950702': ap(2023, 7),
  '232010': ap(2024, 9), '950701': ap(2024, 6),
  '082025': rg(2025)
} };
var ajH = { anioInicio: 2023, finalesDesaprobados: 0, ausentesCiclo: 0 };
var serie = C.historialPeso(PLAN_K23, datosH, ajH, HOY);

comprobar('la serie va de 2023 a 2026', serie.map(function (p) { return p.ciclo; }),
  [2023, 2024, 2025, 2026]);
comprobar('en 2023 habia 2 aprobadas', serie[0].aprobadas, 2);
comprobar('en 2024 ya son 4 (acumula)', serie[1].aprobadas, 4);
comprobar('peso viejo de 2023 = 11x2 - 5x1 = 17', serie[0].pesoViejo, 17);
comprobar('peso viejo de 2024 = 11x4 - 5x2 = 34', serie[1].pesoViejo, 34);
comprobar('la regularizada de 2025 resta 7 y suma 5 de MR: 11x4 - 7 + 5 = 42',
  serie[2].pesoNuevo, 42);
comprobar('y en 2026 ya no suma MR, solo resta el adeudado', serie[3].pesoNuevo, 11 * 4 - 7);
comprobar('sin datos no hay serie',
  C.historialPeso(PLAN_K23, { materias: {} }, C.ajustesVacios(), HOY).length, 0);

seccion('Proyección de egreso');

// Todo el plan por delante, sin nada aprobado.
var proyVacia = C.proyeccion(PLAN_K23.filter(function (m) { return !m.opcional; }), vacio, 4, HOY);
comprobar('faltan las 37 obligatorias', proyVacia.pendientes, 37);
comprobar('el ritmo nunca puede ganarle al camino critico',
  proyVacia.cuatrimestres >= proyVacia.critico, true);

// Con un ritmo altisimo, lo que limita son las correlativas.
var proyRapida = C.proyeccion(PLAN_K23.filter(function (m) { return !m.opcional; }), vacio, 50, HOY);
comprobar('con ritmo enorme manda el camino critico',
  proyRapida.cuatrimestres, proyRapida.critico);
comprobar('y lo dice', proyRapida.loLimita, 'correlativas');

// Con ritmo de a una, manda el ritmo.
var proyLenta = C.proyeccion(PLAN_K23.filter(function (m) { return !m.opcional; }), vacio, 1, HOY);
comprobar('de a una materia manda el ritmo', proyLenta.loLimita, 'ritmo');
comprobar('y son tantos cuatrimestres como cuatrimestres-materia',
  proyLenta.cuatrimestres, proyLenta.cuatriMateria);

// Una regularizada no vuelve a ocupar tiempo de cursada.
var unaRegu = {}; unaRegu[PLAN_K23[0].codigo] = rg(2025);
var proyRegu = C.proyeccion(PLAN_K23.filter(function (m) { return !m.opcional; }), estadosDe(unaRegu), 4, HOY);
comprobar('una regularizada sigue pendiente...', proyRegu.pendientes, 37);
comprobar('...pero ya no hay que cursarla', proyRegu.faltaCursar, 36);

var todo = {};
PLAN_K23.forEach(function (m) { todo[m.codigo] = ap(2025, 8); });
var proyFin = C.proyeccion(PLAN_K23, estadosDe(todo), 4, HOY);
comprobar('con todo aprobado no falta nada', proyFin.cuatrimestres, 0);

// -------------------------------------------------------- progreso de carrera

seccion('Progreso de la carrera');

var obligatorias = PLAN_K23.filter(function (m) { return !m.opcional; });
var TOTAL_CARRERA = obligatorias.length + CUPO_ELECTIVAS + ELECTIVAS_NIVEL5;
comprobar('la carrera completa son 45 materias', TOTAL_CARRERA, 45);

var progVacio = C.progresoCarrera(obligatorias, vacio, TOTAL_CARRERA);
comprobar('sin nada cargado el progreso es 0 de 45',
  [progVacio.aprobadas, progVacio.total, progVacio.porcentaje], [0, 45, 0]);

// 2 aprobadas + 1 regularizada + 1 cursando: solo las aprobadas avanzan la barra.
var progMezcla = C.progresoCarrera(obligatorias, estadosDe({
  '082021': ap(2025, 8), '950702': pr(2025, 9), '232011': rg(2025),
  '232010': { estado: 'cursando', nota: null, anio: 2026 }
}), TOTAL_CARRERA);
comprobar('aprobada y promocionada suman, regularizada y cursando no', progMezcla.aprobadas, 2);
comprobar('pero se informan aparte',
  [progMezcla.enCurso, progMezcla.regularizadas], [1, 1]);
comprobar('2 de 45 es 4.4%', progMezcla.porcentaje, 4.4);
comprobar('quedan 43 pendientes', progMezcla.pendientes, 43);

var progTodo = C.progresoCarrera(obligatorias, estadosDe(todo), obligatorias.length);
comprobar('con todo aprobado el porcentaje es 100', progTodo.porcentaje, 100);

// ------------------------------------------------------------ titulo intermedio

seccion('Título intermedio (Analista Universitario en Sistemas)');

var analistaVacio = C.tituloIntermedio(PLAN_K23, vacio);
comprobar('pide las 24 materias de 1.º a 3.º nivel (Seminario incluido)',
  analistaVacio.requeridas.length, 24);
comprobar('el Seminario Integrador esta entre las requeridas',
  analistaVacio.requeridas.some(function (m) { return m.codigo === 'SEM-INT'; }), true);
comprobar('sin nada cargado faltan las 24', analistaVacio.faltan.length, 24);
comprobar('y no esta logrado', analistaVacio.logrado, false);

// Aprobar una de nivel 4 no acerca al titulo intermedio.
var analistaN4 = C.tituloIntermedio(PLAN_K23, estadosDe({ '950310': ap(2025, 8) }));
comprobar('una de nivel 4 no cuenta para el Analista', analistaN4.aprobadas, 0);

// Regularizada no alcanza: el titulo pide el final aprobado.
var analistaRegu = C.tituloIntermedio(PLAN_K23, estadosDe({ '082021': rg(2025) }));
comprobar('regularizada no cuenta para el Analista', analistaRegu.aprobadas, 0);

var casiTodo = {};
PLAN_K23.forEach(function (m) {
  if (m.nivel <= 3 && m.codigo !== 'SEM-INT') casiTodo[m.codigo] = ap(2025, 8);
});
var analistaSinSem = C.tituloIntermedio(PLAN_K23, estadosDe(casiTodo));
comprobar('con los 3 niveles pero sin el Seminario, falta 1',
  analistaSinSem.faltan.map(function (m) { return m.codigo; }), ['SEM-INT']);

var analistaFin = C.tituloIntermedio(PLAN_K23, estadosDe(todo));
comprobar('con todo aprobado el titulo esta logrado', analistaFin.logrado, true);


console.log('\n' + (fallas === 0
  ? 'Todo en orden: ' + corridas + ' comprobaciones.'
  : fallas + ' de ' + corridas + ' comprobaciones fallaron.'));
process.exit(fallas === 0 ? 0 : 1);
