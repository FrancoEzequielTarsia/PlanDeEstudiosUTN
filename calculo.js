/* Plan K23 — la aritmetica oficial.
 *
 * Modulo puro: no toca el DOM. Las pruebas viven en test-calculo.js
 * (node test-calculo.js). Si algun resultado difiere de SIGA, es un bug de acá.
 *
 * Modelo simplificado a pedido del usuario:
 *   - 5 estados por materia, donde "Regularizada" significa materia aprobada
 *     (es el termino que usa el usuario). No se distingue final de cursada.
 *   - Los terminos de las formulas que no se derivan de un estado (finales
 *     adeudados, desaprobados y ausentes) se cargan a mano en Ajustes.
 */
(function (raiz, fabrica) {
  var api = fabrica();
  if (raiz) raiz.Calculo = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : null, function () {
  'use strict';

  // El ciclo lectivo arranca a mediados de marzo: una fecha anterior al 15/03
  // pertenece al ciclo lectivo del anio anterior.
  function cicloLectivo(fecha) {
    var corte = new Date(fecha.getFullYear(), 2, 15);
    return fecha >= corte ? fecha.getFullYear() : fecha.getFullYear() - 1;
  }

  // Ordenanza 1549: rige desde el ciclo lectivo 2017. Las notas de ciclos
  // anteriores se ponderan con esta tabla; desde 2017 la nota no se altera.
  var TABLA_1549 = { 1: 1, 2: 2.67, 3: 4.33, 4: 6, 5: 6.67, 6: 7.33, 7: 8, 8: 8.67, 9: 9.33, 10: 10 };

  function notaPonderada(ciclo, nota) {
    if (nota === null || nota === undefined) return null;
    if (ciclo && ciclo < 2017) return TABLA_1549[nota] !== undefined ? TABLA_1549[nota] : nota;
    return nota;
  }

  var ESTADOS = [
    { id: 'sin-cursar',   etiqueta: 'Sin cursar' },
    { id: 'cursando',     etiqueta: 'Cursando' },
    { id: 'regularizada', etiqueta: 'Regularizada' },
    { id: 'aprobada',     etiqueta: 'Aprobada' },
    { id: 'promocionada', etiqueta: 'Promocionada' },
    { id: 'abandonada',   etiqueta: 'Abandonada' }
  ];

  var ETIQUETA = {};
  ESTADOS.forEach(function (e) { ETIQUETA[e.id] = e.etiqueta; });

  // Materia aprobada: rendiste y aprobaste el final, o promocionaste.
  // Regularizada NO entra: aprobaste la cursada pero debes el final, y eso en el
  // peso academico resta (-7 por final adeudado) en vez de sumar.
  var APROBADAS = { aprobada: 1, promocionada: 1 };
  // Cursada aprobada: habilita las correlativas de tipo REGULARIZAR.
  var TIENE_CURSADA = { regularizada: 1, aprobada: 1, promocionada: 1 };
  // Estados desde los que se puede (volver a) cursar.
  var CURSABLES = { 'sin-cursar': 1, abandonada: 1 };

  function registroVacio() { return { estado: 'sin-cursar', nota: null, anio: null }; }

  function ajustesVacios() {
    return { anioInicio: null, finalesDesaprobados: 0, ausentesCiclo: 0 };
  }

  function estadoDe(rec) { return (rec && rec.estado) || 'sin-cursar'; }

  // --- correlativas -------------------------------------------------------
  // El mapa del plan distingue dos tipos de correlativa y la distincion es real:
  //   REGULARIZAR - alcanza con tener la cursada aprobada,
  //   APROBAR     - hace falta el final aprobado (o la promocion).

  function cumple(req, estadoPorId) {
    var e = estadoPorId(req.de);
    return req.tipo === 'REGULARIZAR' ? !!TIENE_CURSADA[e] : !!APROBADAS[e];
  }

  function faltantes(materia, estadoPorId) {
    return (materia.correlativas || []).filter(function (r) { return !cumple(r, estadoPorId); });
  }

  function puedeCursar(materia, estadoPorId) {
    return !!CURSABLES[estadoPorId(materia.codigo)] && faltantes(materia, estadoPorId).length === 0;
  }

  // Cadena completa hacia atras: todo lo que hay que tener antes, sin repetir.
  function cadenaPrevia(materia, indice) {
    var vistos = {}, orden = [];
    (function bajar(m) {
      (m.correlativas || []).forEach(function (r) {
        if (vistos[r.de]) return;
        vistos[r.de] = 1;
        var prev = indice[r.de];
        if (prev) { orden.push(prev); bajar(prev); }
      });
    })(materia);
    return orden;
  }

  // Materias que declaran a esta como correlativa directa.
  function dependientes(codigo, materias) {
    return materias.filter(function (m) {
      return (m.correlativas || []).some(function (r) { return r.de === codigo; });
    });
  }

  // --- analisis del grafo -------------------------------------------------

  function mapaHijos(materias) {
    var hijos = {};
    materias.forEach(function (m) {
      (m.correlativas || []).forEach(function (r) {
        (hijos[r.de] = hijos[r.de] || []).push(m);
      });
    });
    return hijos;
  }

  // Todo lo que depende de esta materia, directa o indirectamente.
  function descendientes(codigo, materias) {
    var hijos = mapaHijos(materias);
    var vistos = {}, salida = [];
    (function bajar(cod) {
      (hijos[cod] || []).forEach(function (m) {
        if (vistos[m.codigo]) return;
        vistos[m.codigo] = 1;
        salida.push(m);
        bajar(m.codigo);
      });
    })(codigo);
    return salida;
  }

  /**
   * Cuanto "destraba" una materia:
   *   directas     - materias que la declaran como correlativa,
   *   total        - todas las que dependen de ella en algun punto,
   *   destrabaYa   - las que quedarian habilitadas apenas la apruebes.
   */
  function impacto(materia, materias, estadoPorId) {
    var directas = dependientes(materia.codigo, materias);
    var total = descendientes(materia.codigo, materias);
    var comoSi = function (id) {
      return id === materia.codigo ? 'regularizada' : estadoPorId(id);
    };
    var destrabaYa = directas.filter(function (m) {
      return !puedeCursar(m, estadoPorId) && puedeCursar(m, comoSi);
    });
    return { directas: directas, total: total, destrabaYa: destrabaYa };
  }

  /**
   * La cadena mas larga de materias sin aprobar que todavia tenes por delante.
   * Como una correlativa hay que tenerla aprobada ANTES de cursar la siguiente,
   * el largo de esa cadena es el piso de cuatrimestres que te faltan.
   */
  function caminoCritico(materias, estadoPorId) {
    var indice = {};
    materias.forEach(function (m) { indice[m.codigo] = m; });

    // Cuantos cuatrimestres de CURSADA te faltan por esta materia.
    // Una anual ocupa dos y una cuatrimestral uno, pero solo si todavia tenes
    // que cursarla. Si ya la cursaste y debes el final, rendirlo no te consume
    // un cuatrimestre: te traba, pero no te cuesta tiempo de cursada. Lo mismo
    // si la estas cursando ahora: ya la estas haciendo.
    function cuatrimestres(m, estado) {
      if (estado === 'regularizada' || estado === 'cursando') return 0;
      return m.duracion === 'anual' ? 2 : 1;
    }

    var memo = {};
    function desde(m) {
      if (memo[m.codigo]) return memo[m.codigo];
      if (APROBADAS[estadoPorId(m.codigo)]) {
        return (memo[m.codigo] = { largo: 0, cuatri: 0, camino: [] });
      }
      var mejor = { largo: 0, cuatri: 0, camino: [] };
      (m.correlativas || []).forEach(function (r) {
        var prev = indice[r.de];
        if (!prev) return;
        var s = desde(prev);
        // Ante igual cantidad de cuatrimestres gana la cadena mas larga: una
        // materia que ya cursaste cuesta 0 pero sigue trabando, y tiene que
        // aparecer igual en la lista.
        if (s.cuatri > mejor.cuatri || (s.cuatri === mejor.cuatri && s.largo > mejor.largo)) mejor = s;
      });
      return (memo[m.codigo] = {
        largo: mejor.largo + 1,
        cuatri: mejor.cuatri + cuatrimestres(m, estadoPorId(m.codigo)),
        camino: mejor.camino.concat([m])
      });
    }

    var mejorGlobal = { largo: 0, cuatri: 0, camino: [] };
    materias.forEach(function (m) {
      var s = desde(m);
      if (s.cuatri > mejorGlobal.cuatri ||
          (s.cuatri === mejorGlobal.cuatri && s.largo > mejorGlobal.largo)) mejorGlobal = s;
    });
    return mejorGlobal;
  }

  // --- evolucion ----------------------------------------------------------

  /**
   * Reconstruye el peso academico ciclo por ciclo a partir del anio cargado en
   * cada materia.
   *
   * Es una reconstruccion, no un registro: de cada materia se guarda un solo
   * anio (el de su estado actual), asi que una materia aprobada en 2025 se
   * cuenta como aprobada desde 2025 aunque la hubieras regularizado antes. Los
   * finales desaprobados y ausentes no guardan fecha, asi que se aplican
   * constantes a toda la serie. Lo que la curva muestra bien es la TENDENCIA.
   */
  function historialPeso(materias, datos, ajustes, hoy) {
    var ahora = hoy || new Date();
    var cicloActual = cicloLectivo(ahora);
    var aj = ajustes || ajustesVacios();

    var anios = [];
    materias.forEach(function (m) {
      var r = datos.materias[m.codigo];
      if (r && r.anio) anios.push(r.anio);
    });
    var inicio = aj.anioInicio || (anios.length ? Math.min.apply(null, anios) : null);
    if (!inicio) return [];

    var desap = Math.max(0, aj.finalesDesaprobados || 0);
    var fAu = Math.max(0, aj.ausentesCiclo || 0);
    var serie = [];

    for (var y = inicio; y <= cicloActual; y++) {
      var mAp = 0, fAd = 0, mAb = 0, mR = 0;
      materias.forEach(function (m) {
        var r = datos.materias[m.codigo];
        if (!r || !r.anio || r.anio > y) return;
        var e = estadoDe(r);
        if (APROBADAS[e]) mAp++;
        if (e === 'regularizada') fAd++;
        if (r.anio === y) {
          if (e === 'abandonada') mAb++;
          if (TIENE_CURSADA[e]) mR++;
        }
      });
      var aniosCarrera = y - inicio + 1;
      serie.push({
        ciclo: y,
        aprobadas: mAp,
        pesoViejo: 11 * mAp - 5 * aniosCarrera - 3 * desap,
        pesoNuevo: 11 * mAp - 7 * fAd - 19 * (y === cicloActual ? fAu : 0) - 17 * mAb + 5 * mR
      });
    }
    return serie;
  }

  // --- proyeccion ---------------------------------------------------------

  /**
   * Cuanto te falta para recibirte, cursando `ritmo` materias por cuatrimestre.
   *
   * El piso nunca puede ser menor que el camino critico: por mas materias que
   * curses en paralelo, una cadena de correlativas no se puede acortar.
   */
  function proyeccion(materias, estadoPorId, ritmo, hoy) {
    var ahora = hoy || new Date();
    var cicloActual = cicloLectivo(ahora);
    var r = Math.max(1, ritmo || 1);

    var pendientes = materias.filter(function (m) {
      return !APROBADAS[estadoPorId(m.codigo)];
    });
    // Lo que ya cursaste (regularizada o cursando) no vuelve a ocupar tiempo de
    // cursada: solo te falta rendir.
    var faltaCursar = pendientes.filter(function (m) {
      var e = estadoPorId(m.codigo);
      return e !== 'regularizada' && e !== 'cursando';
    });
    var cuatriMateria = faltaCursar.reduce(function (a, m) {
      return a + (m.duracion === 'anual' ? 2 : 1);
    }, 0);

    var porRitmo = Math.ceil(cuatriMateria / r);
    var critico = caminoCritico(materias, estadoPorId).cuatri;
    var cuatrimestres = Math.max(porRitmo, critico);

    return {
      pendientes: pendientes.length,
      faltaCursar: faltaCursar.length,
      cuatriMateria: cuatriMateria,
      porRitmo: porRitmo,
      critico: critico,
      loLimita: porRitmo >= critico ? 'ritmo' : 'correlativas',
      cuatrimestres: cuatrimestres,
      anioEgreso: cuatrimestres > 0 ? cicloActual + Math.floor((cuatrimestres - 1) / 2) : cicloActual
    };
  }


  /**
   * Cuanto te destraba RENDIR el final de una materia que ya cursaste.
   *
   * Es distinto del impacto de cursarla: una regularizada ya habilita las
   * correlativas de tipo REGULARIZAR, asi que lo unico que sigue trabando son
   * las de tipo APROBAR. Y rendir no consume un cuatrimestre.
   *
   * En el peso academico el salto es grande y concreto: la materia pasa a
   * contar como aprobada (+11) y deja de ser un final adeudado (+7).
   */
  var GANANCIA_PESO_FINAL = 18;

  function impactoFinal(materia, materias, estadoPorId) {
    var comoSi = function (id) {
      return id === materia.codigo ? 'aprobada' : estadoPorId(id);
    };
    var directas = dependientes(materia.codigo, materias);
    var desbloqueaYa = directas.filter(function (m) {
      return !puedeCursar(m, estadoPorId) && puedeCursar(m, comoSi);
    });
    // Las que lo piden APROBADO son las que este final traba de verdad.
    var trabadas = directas.filter(function (m) {
      return (m.correlativas || []).some(function (r) {
        return r.de === materia.codigo && r.tipo === 'APROBAR';
      });
    });
    return {
      directas: directas,
      desbloqueaYa: desbloqueaYa,
      trabadas: trabadas,
      total: descendientes(materia.codigo, materias),
      ganaPeso: GANANCIA_PESO_FINAL
    };
  }


  /**
   * Cuantos cuatrimestres de carrera cuelgan DETRAS de esta materia: la cadena
   * mas larga que arranca despues de ella.
   *
   * Es la medida honesta de la urgencia de un final. Rendirlo no acorta el
   * camino critico (una regularizada ya cuesta cero cuatrimestres de cursada),
   * pero mientras no lo apruebes todo lo que viene atras queda bloqueado. Un
   * final con seis cuatrimestres detras es urgente; uno con cero, no.
   */
  function cuatrimestresDetras(codigo, materias, estadoPorId) {
    var hijos = mapaHijos(materias);
    var costo = function (m) {
      var e = estadoPorId(m.codigo);
      if (APROBADAS[e] || e === 'regularizada' || e === 'cursando') return 0;
      return m.duracion === 'anual' ? 2 : 1;
    };
    var memo = {};
    function desde(cod) {
      if (memo[cod] !== undefined) return memo[cod];
      memo[cod] = 0; // corta ciclos, aunque el plan no deberia tenerlos
      var mejor = 0;
      (hijos[cod] || []).forEach(function (h) {
        var v = costo(h) + desde(h.codigo);
        if (v > mejor) mejor = v;
      });
      return (memo[cod] = mejor);
    }
    return desde(codigo);
  }

  /**
   * Prioridad calculada de un final adeudado. No se le pregunta al usuario:
   * si la app tiene los datos para deducirla, pedirsela es trasladarle trabajo.
   */
  function prioridadFinal(materia, materias, estadoPorId) {
    var i = impactoFinal(materia, materias, estadoPorId);
    var detras = cuatrimestresDetras(materia.codigo, materias, estadoPorId);
    var nivel, motivo;

    if (i.desbloqueaYa.length) {
      nivel = 'alta';
      motivo = 'Aprobarlo te habilita ' + i.desbloqueaYa.length +
        (i.desbloqueaYa.length === 1 ? ' materia de inmediato' : ' materias de inmediato');
    } else if (detras >= 4) {
      nivel = 'alta';
      motivo = 'Tiene ' + detras + ' cuatrimestres de carrera colgando atrás';
    } else if (i.total.length) {
      nivel = 'media';
      motivo = 'Traba ' + i.total.length +
        (i.total.length === 1 ? ' materia' : ' materias') + ' más adelante' +
        (detras ? ', y ' + detras + (detras === 1 ? ' cuatrimestre' : ' cuatrimestres') + ' de carrera' : '');
    } else {
      nivel = 'baja';
      motivo = 'No traba ninguna materia: sólo suma al peso académico';
    }

    return {
      nivel: nivel,
      motivo: motivo,
      detras: detras,
      // Ordena de mayor a menor urgencia.
      puntaje: i.desbloqueaYa.length * 100 + detras * 10 + i.total.length,
      impacto: i
    };
  }

  // --- progreso -----------------------------------------------------------

  /**
   * Cuanto de la carrera esta hecho, contando materias.
   *
   * `total` viene de afuera: el plan pide mas electivas de las que la app
   * conoce (las 5 de 5.º nivel no estan cargadas), asi que el denominador no
   * puede deducirse de `materias`.
   */
  function progresoCarrera(materias, estadoPorId, total) {
    var aprobadas = 0, enCurso = 0, regularizadas = 0;
    materias.forEach(function (m) {
      var e = estadoPorId(m.codigo);
      if (APROBADAS[e]) aprobadas++;
      else if (e === 'cursando') enCurso++;
      else if (e === 'regularizada') regularizadas++;
    });
    var t = total || materias.length;
    return {
      total: t,
      aprobadas: aprobadas,
      enCurso: enCurso,
      regularizadas: regularizadas,
      pendientes: t - aprobadas,
      porcentaje: t ? Math.round(aprobadas / t * 1000) / 10 : 0
    };
  }

  /**
   * Titulo intermedio de Analista Universitario en Sistemas: todas las
   * materias de 1.º a 3.º nivel aprobadas, incluido el Seminario Integrador
   * (opcional para el grado, obligatorio para este titulo — por eso cuenta
   * aunque hayas dicho que no lo vas a cursar).
   */
  function tituloIntermedio(materias, estadoPorId) {
    var requeridas = materias.filter(function (m) { return m.nivel && m.nivel <= 3; });
    var faltan = requeridas.filter(function (m) { return !APROBADAS[estadoPorId(m.codigo)]; });
    return {
      requeridas: requeridas,
      faltan: faltan,
      aprobadas: requeridas.length - faltan.length,
      logrado: faltan.length === 0
    };
  }

  // --- simulacion ---------------------------------------------------------

  /**
   * "Si apruebo estas materias este ciclo, como quedo."
   * No modifica nada: trabaja sobre una copia.
   */
  function simular(materias, datos, ajustes, seleccion, hoy) {
    var ahora = hoy || new Date();
    var ciclo = cicloLectivo(ahora);
    var indice = {};
    materias.forEach(function (m) { indice[m.codigo] = m; });

    var estadoBase = function (id) { return estadoDe(datos.materias[id]); };

    var copia = { materias: {} };
    Object.keys(datos.materias).forEach(function (k) {
      copia.materias[k] = {
        estado: datos.materias[k].estado,
        nota: datos.materias[k].nota,
        anio: datos.materias[k].anio
      };
    });
    seleccion.forEach(function (id) {
      copia.materias[id] = { estado: 'aprobada', nota: null, anio: ciclo };
    });
    var estadoSim = function (id) { return estadoDe(copia.materias[id]); };

    // Materias elegidas que hoy no podes cursar. Las que ya estas cursando no
    // cuentan como problema: justamente las vas a terminar este ciclo.
    var noHabilitadas = seleccion.filter(function (id) {
      if (!indice[id]) return false;
      if (estadoBase(id) === 'cursando') return false;
      return !puedeCursar(indice[id], estadoBase);
    }).map(function (id) { return indice[id]; });

    // Dos materias de la misma tanda donde una es correlativa de la otra:
    // no se pueden cursar juntas.
    var enTanda = {};
    seleccion.forEach(function (id) { enTanda[id] = 1; });
    var conflictos = [];
    seleccion.forEach(function (id) {
      var m = indice[id];
      if (!m) return;
      (m.correlativas || []).forEach(function (r) {
        if (enTanda[r.de]) conflictos.push({ materia: m, requiere: indice[r.de] });
      });
    });

    var base = metricas(materias, datos, ajustes, ahora);
    var bruto = metricas(materias, copia, ajustes, ahora);

    // Los terminos derivados (aprobadas, finales adeudados, regularizadas del
    // ciclo) se toman del estado simulado. Los historicos se toman de la base:
    // haber abandonado o faltado a una mesa este ciclo ya ocurrio, y aprobar la
    // materia despues no lo borra. Los anios de carrera tampoco cambian.
    var despues = {
      mApTotal: bruto.mApTotal,
      fAdTotal: bruto.fAdTotal,
      mRCiclo: bruto.mRCiclo,
      pesoViejo: 11 * bruto.mApTotal - 5 * base.aniosCarrera - 3 * base.finalesDesaprobados,
      pesoNuevo: 11 * bruto.mApTotal - 7 * bruto.fAdTotal - 19 * base.fAuCiclo -
                 17 * base.mAbCiclo + 5 * bruto.mRCiclo
    };

    var destrabadas = materias.filter(function (m) {
      return !puedeCursar(m, estadoBase) && puedeCursar(m, estadoSim) &&
             seleccion.indexOf(m.codigo) < 0;
    });

    return {
      base: base,
      despues: despues,
      noHabilitadas: noHabilitadas,
      conflictos: conflictos,
      destrabadas: destrabadas,
      viable: noHabilitadas.length === 0 && conflictos.length === 0
    };
  }

  // --- metricas -----------------------------------------------------------

  function promedio(arr) {
    if (!arr.length) return null;
    var suma = arr.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(suma / arr.length * 100) / 100;
  }

  function metricas(materias, datos, ajustes, hoy) {
    var ahora = hoy || new Date();
    var cicloActual = cicloLectivo(ahora);
    var aj = ajustes || ajustesVacios();

    var mApTotal = 0, fAdTotal = 0, mAbCiclo = 0, mRCiclo = 0, cursando = 0;
    var anios = [];
    var notasOrig = [], notasPond = [];

    materias.forEach(function (m) {
      var rec = datos.materias[m.codigo];
      if (!rec) return;
      var e = estadoDe(rec);
      if (rec.anio) anios.push(rec.anio);

      if (APROBADAS[e]) {
        mApTotal++;
        // Solo promedian las materias con final aprobado o promocionadas.
        if (typeof rec.nota === 'number') {
          notasOrig.push(rec.nota);
          notasPond.push(notaPonderada(rec.anio, rec.nota));
        }
      }
      // Cursada aprobada sin final rendido = final adeudado. Se deriva del
      // estado, no se carga a mano.
      if (e === 'regularizada') fAdTotal++;
      // MR_ciclo cuenta cursadas aprobadas en el ultimo ciclo, hayan derivado o
      // no en final despues.
      if (TIENE_CURSADA[e] && rec.anio === cicloActual) mRCiclo++;
      if (e === 'cursando') cursando++;
      if (e === 'abandonada' && rec.anio === cicloActual) mAbCiclo++;
    });

    var fAuCiclo = Math.max(0, aj.ausentesCiclo || 0);
    var desaprobados = Math.max(0, aj.finalesDesaprobados || 0);

    var anioInicio = aj.anioInicio || (anios.length ? Math.min.apply(null, anios) : null);
    var hayDatos = anioInicio !== null && (anios.length > 0 || mApTotal > 0);
    var aniosCarrera = anioInicio ? (ahora.getFullYear() - anioInicio + 1) : 0;

    return {
      cicloActual: cicloActual,
      hayDatos: hayDatos,
      anioInicio: anioInicio,
      aniosCarrera: aniosCarrera,
      mApTotal: mApTotal,
      fAdTotal: fAdTotal,
      fAuCiclo: fAuCiclo,
      mAbCiclo: mAbCiclo,
      mRCiclo: mRCiclo,
      finalesDesaprobados: desaprobados,
      cursando: cursando,
      pesoViejo: 11 * mApTotal - 5 * aniosCarrera - 3 * desaprobados,
      pesoNuevo: 11 * mApTotal - 7 * fAdTotal - 19 * fAuCiclo - 17 * mAbCiclo + 5 * mRCiclo,
      promedio: promedio(notasOrig),
      promedioPonderado: promedio(notasPond)
    };
  }

  return {
    cicloLectivo: cicloLectivo,
    TABLA_1549: TABLA_1549,
    notaPonderada: notaPonderada,
    ESTADOS: ESTADOS,
    ETIQUETA: ETIQUETA,
    APROBADAS: APROBADAS,
    TIENE_CURSADA: TIENE_CURSADA,
    CURSABLES: CURSABLES,
    registroVacio: registroVacio,
    ajustesVacios: ajustesVacios,
    estadoDe: estadoDe,
    cumple: cumple,
    faltantes: faltantes,
    puedeCursar: puedeCursar,
    cadenaPrevia: cadenaPrevia,
    dependientes: dependientes,
    descendientes: descendientes,
    impacto: impacto,
    impactoFinal: impactoFinal,
    cuatrimestresDetras: cuatrimestresDetras,
    prioridadFinal: prioridadFinal,
    GANANCIA_PESO_FINAL: GANANCIA_PESO_FINAL,
    caminoCritico: caminoCritico,
    progresoCarrera: progresoCarrera,
    tituloIntermedio: tituloIntermedio,
    historialPeso: historialPeso,
    proyeccion: proyeccion,
    simular: simular,
    promedio: promedio,
    metricas: metricas
  };
});
