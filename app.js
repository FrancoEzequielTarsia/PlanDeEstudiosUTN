/* Plan K23 — interfaz.
 *
 * Este archivo dibuja y edita. La aritmetica oficial vive en calculo.js, que no
 * toca el DOM y se prueba aparte con: node test-calculo.js
 */
(function () {
  'use strict';

  var C = window.Calculo;
  var ETIQUETA = C.ETIQUETA;
  var CICLO = C.cicloLectivo(new Date());

  var CLAVE = 'plank23.v3';
  var CLAVE_VIEJA = 'plank23.v2';
  var CLAVE_TEMA = 'plank23.tema';

  var datos = { materias: {}, electivas: [], ajustes: C.ajustesVacios() };
  var persistencia = true;

  var seccion = 'plan';
  var abierta = null;      // materia expandida en la lista
  var enMapa = null;       // materia seleccionada en el mapa
  var soloPuedo = false;
  var seleccionSim = {};   // materias marcadas en el simulador
  var verTodas = false;    // el simulador muestra también las no habilitadas
  var simInicializado = false;
  var pila = [];           // estados anteriores, para deshacer
  var deshaciendo = false;
  var ultimoGuardado = null;

  // --------------------------------------------------------------- datos

  // Materias opcionales (hoy sólo el Seminario Integrador, que se cursa nada
  // más si querés el título intermedio). Mientras no digas que la vas a cursar,
  // queda anulada: se muestra en la grilla para que puedas decidir, pero no
  // participa de nada — ni del total, ni del peso, ni del camino crítico.
  function anulada(m) {
    if (!m.opcional) return false;
    var r = datos.materias[m.codigo];
    return !(r && r.cursare === true);
  }

  function todas() { return PLAN_K23.concat(datos.electivas); }

  // Lo que de verdad cuenta para tu carrera.
  function activas() {
    return PLAN_K23.filter(function (m) { return !anulada(m); }).concat(datos.electivas);
  }
  function obligatoriasActivas() {
    return PLAN_K23.filter(function (m) { return !anulada(m); });
  }

  var indice = {};
  function reindexar() {
    indice = {};
    todas().forEach(function (m) { indice[m.codigo] = m; });
  }

  function rec(id) {
    if (!datos.materias[id]) datos.materias[id] = C.registroVacio();
    return datos.materias[id];
  }

  function estadoDe(id) { return C.estadoDe(datos.materias[id]); }
  function puedeCursar(m) { return C.puedeCursar(m, estadoDe); }
  function faltantes(m) { return C.faltantes(m, estadoDe); }

  function adoptar(d) {
    datos = {
      materias: d.materias,
      electivas: d.electivas || [],
      ajustes: Object.assign(C.ajustesVacios(), d.ajustes || {})
    };
    // `finalesAdeudados` ya no se carga a mano: se deriva de las regularizadas.
    delete datos.ajustes.finalesAdeudados;
  }

  function cargar() {
    var crudo = null, viejo = null;
    try {
      crudo = localStorage.getItem(CLAVE);
      if (!crudo) viejo = localStorage.getItem(CLAVE_VIEJA);
    } catch (e) {
      persistencia = false;
      avisar('Este navegador no permite guardar datos en esta página, así que lo que cargues se ' +
             'pierde al cerrarla. Usá Exportar para guardar un respaldo.');
    }

    if (crudo) {
      try {
        var d = JSON.parse(crudo);
        if (d && d.materias) adoptar(d);
      } catch (e) {
        avisar('El estado guardado estaba dañado y no se pudo leer, así que la app arranca vacía. ' +
               'Si tenés un respaldo, usá Importar.');
      }
      return;
    }

    // Migración desde la versión anterior, donde "Regularizada" significaba
    // materia aprobada. Ahora significa cursada aprobada con final adeudado, así
    // que lo guardado entonces corresponde a "Aprobada".
    if (!viejo) return;
    try {
      var v = JSON.parse(viejo);
      if (!v || !v.materias) return;
      var convertidas = 0;
      Object.keys(v.materias).forEach(function (k) {
        if (v.materias[k] && v.materias[k].estado === 'regularizada') {
          v.materias[k].estado = 'aprobada';
          convertidas++;
        }
      });
      adoptar(v);
      guardar();
      if (convertidas) {
        avisar('«Regularizada» cambió de significado: ahora quiere decir que aprobaste la cursada ' +
               'y todavía debés el final. Las ' + convertidas + ' materias que tenías marcadas así ' +
               'pasaron a «Aprobada», que es lo que significaban antes. Si de alguna te falta ' +
               'rendir el final, marcala como Regularizada.');
      }
    } catch (e) { /* si no se puede migrar, arranca vacía */ }
  }

  function botonDeshacer() {
    var b = document.getElementById('btn-deshacer');
    if (b) b.hidden = pila.length === 0;
  }

  function deshacer() {
    if (!pila.length) return;
    var anterior = pila.pop();
    deshaciendo = true;
    try {
      adoptar(JSON.parse(anterior));
      guardar();
    } finally { deshaciendo = false; }
    botonDeshacer();
    abierta = null;
    pintarAjustes();
    pintarTodo();
  }

  function guardar() {
    var texto = JSON.stringify(datos, null, 2);

    // La pila guarda el estado ANTERIOR a este cambio. Al apilarlo acá y no en
    // cada punto de edición, no hay forma de olvidarse en una rama nueva.
    if (!deshaciendo && ultimoGuardado !== null && ultimoGuardado !== texto) {
      pila.push(ultimoGuardado);
      if (pila.length > 30) pila.shift();
      botonDeshacer();
    }
    ultimoGuardado = texto;

    if (persistencia) {
      try {
        localStorage.setItem(CLAVE, texto);
      } catch (e) {
        persistencia = false;
        avisar('No se pudo guardar el cambio. Exportá el JSON para no perder lo que cargaste.');
      }
    }
    // Copia adicional en el archivo del disco, si está configurada.
    if (window.Disco) window.Disco.escribir(texto);
  }

  function avisar(texto) {
    var el = document.getElementById('aviso');
    el.textContent = texto;
    el.hidden = false;
  }

  // ---------------------------------------------------------------- tema

  function aplicarTema(t) {
    document.documentElement.setAttribute('data-tema', t);
    Array.prototype.forEach.call(document.querySelectorAll('#seg-tema .seg__btn'), function (b) {
      b.setAttribute('aria-checked', String(b.dataset.tema === t));
    });
    try { localStorage.setItem(CLAVE_TEMA, t); } catch (e) { /* sin persistencia */ }
  }

  // -------------------------------------------------------------- helpers

  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined && texto !== null) n.textContent = texto;
    return n;
  }

  function esElectiva(id) { return id.indexOf('EL:') === 0; }

  function chip(estado, puede) {
    var c = el('span', 'chip' + (puede ? ' chip--puede' : ''));
    c.dataset.e = puede ? 'puede' : estado;
    var pt = el('i', 'chip__pt');
    pt.setAttribute('aria-hidden', 'true');
    c.appendChild(pt);
    c.appendChild(document.createTextNode(puede ? 'Podés cursarla' : ETIQUETA[estado]));
    return c;
  }

  // ------------------------------------------------------------ resumen

  function pintarResumen() {
    var m = C.metricas(activas(), datos, datos.ajustes, new Date());
    var g = function (id) { return document.getElementById(id); };
    var n = function (v) { return v === null || v === undefined ? '—' : String(v); };

    g('peso-viejo').textContent = m.hayDatos ? String(m.pesoViejo) : '—';
    g('peso-nuevo').textContent = m.hayDatos ? String(m.pesoNuevo) : '—';
    g('promedio').textContent = m.promedio === null ? '—' : m.promedio.toFixed(2);
    g('promedio-pond').textContent = m.promedioPonderado === null ? '—' : m.promedioPonderado.toFixed(2);
    g('aprobadas').textContent = m.mApTotal + ' / ' + obligatoriasActivas().length;
    g('habilitadas').textContent = n(activas().filter(puedeCursar).length);

    g('formulas').textContent = m.hayDatos
      ? 'Hasta CL2026: 11×' + m.mApTotal + ' − 5×' + m.aniosCarrera + ' − 3×' + m.finalesDesaprobados +
        '.  Desde CL2027: 11×' + m.mApTotal + ' − 7×' + m.fAdTotal + ' − 19×' + m.fAuCiclo +
        ' − 17×' + m.mAbCiclo + ' + 5×' + m.mRCiclo + '.  Último ciclo lectivo: ' + m.cicloActual + '.'
      : 'Marcá tu primera materia y acá aparece el cálculo con cada término desarmado.';

    g('aj-ciclo-label').textContent = 'en ' + CICLO;
  }

  // ------------------------------------------------------------ materias

  function filaMateria(m) {
    var envoltorio = el('div', 'fila-wrap');
    var estado = estadoDe(m.codigo);
    var puede = puedeCursar(m);
    var r = datos.materias[m.codigo];

    var b = el('button', 'mat');
    b.type = 'button';
    b.dataset.id = m.codigo;
    b.setAttribute('aria-expanded', String(abierta === m.codigo));

    var id = el('span', 'mat__id');
    id.appendChild(el('span', 'mat__nombre', m.nombre));
    b.appendChild(id);

    var der = el('span', 'mat__der');
    if (r && typeof r.nota === 'number') der.appendChild(el('span', 'mat__nota', String(r.nota)));
    der.appendChild(chip(estado, puede));
    var fl = el('span', 'mat__flecha', '›');
    fl.setAttribute('aria-hidden', 'true');
    der.appendChild(fl);
    b.appendChild(der);

    b.setAttribute('aria-label', m.nombre + '. ' + ETIQUETA[estado] +
      (puede ? ', podés cursarla' : '') +
      (r && typeof r.nota === 'number' ? ', nota ' + r.nota : ''));

    envoltorio.appendChild(b);
    if (abierta === m.codigo) envoltorio.appendChild(editor(m));
    return envoltorio;
  }

  function editor(m) {
    var r = rec(m.codigo);
    var caja = el('div', 'edit');

    // Las opcionales se resuelven antes que nada: si no la vas a cursar, no hay
    // estado que cargar y la materia queda fuera de todo el cálculo.
    if (m.opcional) {
      caja.appendChild(el('span', 'edit__lab', '¿La vas a cursar?'));
      var sino = el('div', 'edit__estados');
      sino.setAttribute('role', 'radiogroup');
      sino.setAttribute('aria-label', '¿Vas a cursar ' + m.nombre + '?');
      [{ v: true, t: 'Sí, la voy a cursar' }, { v: false, t: 'No' }].forEach(function (o) {
        var b = el('button', 'opt');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String((r.cursare === true) === o.v));
        b.textContent = o.t;
        b.addEventListener('click', function () {
          r.cursare = o.v;
          // Al anularla se limpia lo cargado: no puede quedar una nota fantasma
          // sumando en un cálculo del que la materia ya no participa.
          if (!o.v) { r.estado = 'sin-cursar'; r.nota = null; r.anio = null; }
          guardar();
          pintarTodo();
        });
        sino.appendChild(b);
      });
      caja.appendChild(sino);

      var expl = el('p', 'edit__nota');
      expl.appendChild(el('b', null, 'Materia opcional. '));
      expl.appendChild(document.createTextNode(
        'Sólo hace falta si querés el título intermedio. Mientras digas que no, queda anulada: ' +
        'no cuenta en el total del plan, ni en el peso académico, ni en el camino crítico, y no ' +
        'aparece en el mapa ni en las herramientas.'));
      caja.appendChild(expl);

      if (anulada(m)) return caja;
    }

    caja.appendChild(el('span', 'edit__lab', 'Estado'));
    var ops = el('div', 'edit__estados');
    ops.setAttribute('role', 'radiogroup');
    ops.setAttribute('aria-label', 'Estado de ' + m.nombre);
    C.ESTADOS.forEach(function (e) {
      var o = el('button', 'opt');
      o.type = 'button';
      o.setAttribute('role', 'radio');
      o.setAttribute('aria-checked', String(r.estado === e.id));
      var pt = el('i', 'chip__pt');
      pt.setAttribute('aria-hidden', 'true');
      pt.style.background = colorDe(e.id);
      o.appendChild(pt);
      o.appendChild(document.createTextNode(e.etiqueta));
      o.addEventListener('click', function () {
        r.estado = e.id;
        if (e.id === 'sin-cursar') { r.nota = null; r.anio = null; }
        else if (!r.anio) r.anio = CICLO;
        guardar();
        pintarTodo();
      });
      ops.appendChild(o);
    });
    caja.appendChild(ops);

    if (r.estado !== 'sin-cursar') {
      var campos = el('div', 'edit__campos');
      campos.style.marginTop = '14px';

      var cNota = el('label', 'campito');
      cNota.appendChild(el('span', null, 'Nota'));
      var iNota = el('input', 'campo num');
      iNota.type = 'number'; iNota.min = '1'; iNota.max = '10'; iNota.step = '1';
      iNota.placeholder = '1 a 10';
      iNota.value = typeof r.nota === 'number' ? String(r.nota) : '';
      // La nota es la del final (o la de promoción). Una materia regularizada
      // todavía no tiene nota de final.
      iNota.disabled = !C.APROBADAS[r.estado];
      if (iNota.disabled) {
        iNota.placeholder = r.estado === 'regularizada' ? 'Falta rendir el final' : 'Sin nota todavía';
      }
      cNota.appendChild(iNota);
      campos.appendChild(cNota);

      var cAnio = el('label', 'campito');
      cAnio.appendChild(el('span', null, 'Año'));
      var iAnio = el('input', 'campo num');
      iAnio.type = 'number'; iAnio.min = '1990'; iAnio.max = String(CICLO + 1); iAnio.step = '1';
      iAnio.placeholder = String(CICLO);
      iAnio.value = r.anio ? String(r.anio) : '';
      cAnio.appendChild(iAnio);
      campos.appendChild(cAnio);

      caja.appendChild(campos);

      var err = el('p', 'edit__err');
      err.hidden = true;
      caja.appendChild(err);

      iNota.addEventListener('change', function () {
        var v = iNota.value === '' ? null : parseInt(iNota.value, 10);
        if (v !== null && (isNaN(v) || v < 1 || v > 10)) {
          err.textContent = 'La nota tiene que ser un número entero del 1 al 10.';
          err.hidden = false;
          return;
        }
        err.hidden = true;
        r.nota = v;
        guardar();
        pintarResumen();
        pintarGrilla();   // sólo la grilla: el editor no se rearma y no se pierde el foco
      });

      iAnio.addEventListener('change', function () {
        var v = iAnio.value === '' ? null : parseInt(iAnio.value, 10);
        if (v !== null && (isNaN(v) || v < 1990 || v > CICLO + 1)) {
          err.textContent = 'El año tiene que estar entre 1990 y ' + (CICLO + 1) + '.';
          err.hidden = false;
          return;
        }
        err.hidden = true;
        r.anio = v;
        guardar();
        pintarResumen();
      });
    }

    // Que le falta / que destraba, en una linea.
    var falta = faltantes(m);
    var nota = el('p', 'edit__nota');
    if (!(m.correlativas || []).length) {
      nota.textContent = 'No tiene correlativas.';
    } else if (falta.length === 0) {
      nota.textContent = 'Cumplís sus ' + m.correlativas.length + ' correlativas.';
    } else {
      nota.appendChild(document.createTextNode(
        (falta.length === 1 ? 'Te falta: ' : 'Te faltan: ')));
      nota.appendChild(el('b', null, falta.map(function (f) {
        return indice[f.de] ? indice[f.de].nombre : f.de;
      }).join(', ') + '.'));
    }
    caja.appendChild(nota);

    if ((m.correlativas || []).length || C.dependientes(m.codigo, todas()).length) {
      var ir = el('button', 'edit__ir', 'Ver en el mapa de correlativas ›');
      ir.type = 'button';
      ir.addEventListener('click', function () {
        enMapa = m.codigo;
        irA('correlativas');
      });
      caja.appendChild(ir);
    }

    if (esElectiva(m.codigo)) {
      var quitar = el('button', 'edit__ir', 'Quitar esta electiva');
      quitar.type = 'button';
      quitar.style.color = 'var(--rojo)';
      quitar.style.display = 'block';
      quitar.addEventListener('click', function () {
        datos.electivas = datos.electivas.filter(function (e) { return e.codigo !== m.codigo; });
        delete datos.materias[m.codigo];
        if (abierta === m.codigo) abierta = null;
        reindexar();
        guardar();
        pintarTodo();
      });
      caja.appendChild(quitar);
    }

    return caja;
  }

  function colorDe(estado) {
    if (estado === 'cursando') return 'var(--naranja)';
    if (estado === 'regularizada') return 'var(--amarillo)';
    if (estado === 'aprobada') return 'var(--verde)';
    if (estado === 'promocionada') return 'var(--violeta)';
    if (estado === 'abandonada') return 'var(--rojo)';
    return 'var(--gris)';
  }

  // Celda compacta de la grilla: nombre arriba, código y estado escrito abajo.
  function celda(m) {
    var estado = estadoDe(m.codigo);
    var puede = puedeCursar(m);
    var r = datos.materias[m.codigo];

    var b = el('button', 'celda');
    b.type = 'button';
    b.dataset.id = m.codigo;
    if (abierta === m.codigo) b.classList.add('is-abierta');

    b.appendChild(el('span', 'celda__nom', m.nombre));

    var esAnulada = anulada(m);
    if (esAnulada) b.classList.add('is-anulada');

    var pie = el('span', 'celda__pie');
    var pt = el('i', 'chip__pt');
    pt.setAttribute('aria-hidden', 'true');
    pt.style.background = esAnulada ? 'var(--label-3)' : (puede ? 'var(--accent)' : colorDe(estado));
    pie.appendChild(pt);
    pie.appendChild(el('span', null,
      esAnulada ? 'Opcional · no la vas a cursar'
                : (puede ? 'Podés cursarla' : ETIQUETA[estado])));
    if (r && typeof r.nota === 'number') pie.appendChild(el('span', 'celda__nota', String(r.nota)));
    b.appendChild(pie);

    b.setAttribute('aria-label', esAnulada
      ? m.nombre + '. Materia opcional que decidiste no cursar.'
      : m.nombre + '. ' + ETIQUETA[estado] +
        (puede ? ', podés cursarla' : '') +
        (r && typeof r.nota === 'number' ? ', nota ' + r.nota : ''));
    b.setAttribute('aria-expanded', String(abierta === m.codigo));
    return b;
  }

  function pintarNiveles() {
    pintarGrilla();
    pintarEditor();
  }

  function pintarGrilla() {
    var cont = document.getElementById('niveles');
    cont.textContent = '';

    for (var n = 1; n <= 5; n++) {
      var delNivel = PLAN_K23.filter(function (m) { return m.nivel === n; });
      if (soloPuedo) delNivel = delNivel.filter(puedeCursar);

      var col = el('div', 'nivel');
      col.appendChild(el('h3', 'nivel__cab', 'Nivel ' + n));
      var card = el('div', 'card');
      if (!delNivel.length) {
        card.appendChild(el('p', 'vacio', 'Nada por acá.'));
      } else {
        delNivel.forEach(function (m) { card.appendChild(celda(m)); });
      }
      col.appendChild(card);
      cont.appendChild(col);
    }
  }

  // El editor vive debajo de la grilla, siempre en el mismo lugar.
  function pintarEditor() {
    var cont = document.getElementById('editor-materia');
    if (!cont) return;
    cont.textContent = '';
    // Las electivas son una lista de una sola columna y abren su editor en
    // línea; acá sólo se atiende a las materias de la grilla.
    if (!abierta || !indice[abierta] || esElectiva(abierta)) return;

    var m = indice[abierta];
    var card = el('div', 'card edcard');

    var cab = el('div', 'edcard__cab');
    var izq = el('div');
    izq.appendChild(el('h3', 'edcard__tit', m.nombre));
    izq.appendChild(el('p', 'edcard__sub', m.nivel ? 'Nivel ' + m.nivel : 'Electiva'));
    cab.appendChild(izq);

    var x = el('button', 'edcard__x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Cerrar el editor');
    x.addEventListener('click', function () {
      abierta = null;
      pintarNiveles();
      pintarElectivas();
    });
    cab.appendChild(x);
    card.appendChild(cab);

    card.appendChild(editor(m));
    cont.appendChild(card);
  }

  function pintarElectivas() {
    var cont = document.getElementById('electivas');
    cont.textContent = '';

    var cupo = (typeof CUPO_ELECTIVAS === 'number') ? CUPO_ELECTIVAS : 3;
    var n = datos.electivas.length;
    document.getElementById('electivas-cupo').textContent = n + ' de ' + cupo;
    document.getElementById('btn-electiva').hidden = (n >= cupo);

    if (!n) {
      cont.appendChild(el('p', 'vacio',
        'Todavía no agregaste ninguna. El plan pide ' + cupo + ' electivas de 3.º/4.º nivel.'));
      return;
    }
    datos.electivas.forEach(function (m) { cont.appendChild(filaMateria(m)); });
  }

  // ---------------------------------------------------------------- mapa

  var COL_W = 252, COL_GAP = 46, NODO_H = 54, NODO_GAP = 12, TOP = 34;

  function pintarMapa() {
    var svg = document.getElementById('mapa');
    svg.textContent = '';

    var porNivel = [1, 2, 3, 4, 5].map(function (n) {
      return PLAN_K23.filter(function (m) { return m.nivel === n && !anulada(m); });
    });
    // Las electivas van en su propia columna: no tienen correlativas, pero son
    // parte del plan y tienen que verse en el mapa.
    if (datos.electivas.length) porNivel.push(datos.electivas);

    var cols = porNivel.length;
    var maxFilas = Math.max.apply(null, porNivel.map(function (c) { return c.length; }));
    var ancho = cols * COL_W + (cols - 1) * COL_GAP;
    var alto = TOP + maxFilas * (NODO_H + NODO_GAP);
    svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);
    svg.style.minWidth = ancho + 'px';

    var pos = {};
    porNivel.forEach(function (col, ci) {
      var x = ci * (COL_W + COL_GAP);
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x); t.setAttribute('y', 12);
      t.setAttribute('class', 'colhead');
      t.textContent = (ci < 5) ? 'NIVEL ' + (ci + 1) : 'ELECTIVAS';
      svg.appendChild(t);

      col.forEach(function (m, fi) {
        var y = TOP + fi * (NODO_H + NODO_GAP);
        pos[m.codigo] = { x: x, y: y, w: COL_W, h: NODO_H };
      });
    });

    // Aristas primero, para que queden por debajo de los nodos.
    var capaAristas = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(capaAristas);

    var cadena = null;
    if (enMapa) {
      cadena = {};
      cadena[enMapa] = 1;
      (indice[enMapa].correlativas || []).forEach(function (r) { cadena[r.de] = 1; });
      C.dependientes(enMapa, PLAN_K23).forEach(function (d) { cadena[d.codigo] = 1; });
    }

    PLAN_K23.forEach(function (m) {
      (m.correlativas || []).forEach(function (r) {
        var a = pos[r.de], b = pos[m.codigo];
        if (!a || !b) return;
        var x1 = a.x + a.w, y1 = a.y + a.h / 2;
        var x2 = b.x, y2 = b.y + b.h / 2;
        var dx = Math.max(20, (x2 - x1) * 0.5);
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 +
                            ' ' + (x2 - dx) + ',' + y2 + ' ' + x2 + ',' + y2);
        var cls = 'arista arista--' + r.tipo;
        if (enMapa) {
          cls += (r.de === enMapa || m.codigo === enMapa) ? ' is-viva' : ' is-apagada';
        }
        p.setAttribute('class', cls);
        capaAristas.appendChild(p);
      });
    });

    var enElMapa = porNivel.reduce(function (a, c) { return a.concat(c); }, []);
    enElMapa.forEach(function (m) {
      var p = pos[m.codigo];
      if (!p) return;
      var estado = estadoDe(m.codigo);
      var puede = puedeCursar(m);

      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      var cls = 'nodo';
      if (enMapa === m.codigo) cls += ' is-sel';
      else if (cadena && !cadena[m.codigo]) cls += ' is-apagado';
      g.setAttribute('class', cls);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', m.nombre + '. ' + ETIQUETA[estado] + (puede ? ', podés cursarla' : ''));
      g.dataset.id = m.codigo;

      var caja = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      caja.setAttribute('x', p.x); caja.setAttribute('y', p.y);
      caja.setAttribute('width', p.w); caja.setAttribute('height', p.h);
      caja.setAttribute('rx', 7);
      caja.setAttribute('class', 'nodo__caja');
      g.appendChild(caja);

      var pt = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pt.setAttribute('cx', p.x + 16); pt.setAttribute('cy', p.y + p.h / 2);
      pt.setAttribute('r', 5.5);
      pt.setAttribute('class', 'nodo__pt');
      pt.setAttribute('fill', puede ? 'var(--accent)' : colorDe(estado));
      g.appendChild(pt);

      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('class', 'nodo__txt');
      var lineas = cortar(m.nombre, 27);
      var y0 = p.y + p.h / 2 - (lineas.length - 1) * 7 + 4.5;
      lineas.forEach(function (linea, i) {
        var ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        ts.setAttribute('x', p.x + 31);
        ts.setAttribute('y', y0 + i * 14);
        ts.textContent = linea;
        t.appendChild(ts);
      });
      g.appendChild(t);

      g.addEventListener('click', function () { elegirEnMapa(m.codigo); });
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); elegirEnMapa(m.codigo); }
      });
      svg.appendChild(g);
    });
  }

  function cortar(texto, max) {
    var palabras = texto.split(' ');
    var lineas = [], actual = '';
    palabras.forEach(function (p) {
      if ((actual + ' ' + p).trim().length > max && actual) { lineas.push(actual); actual = p; }
      else actual = (actual + ' ' + p).trim();
    });
    if (actual) lineas.push(actual);
    return lineas.slice(0, 2);
  }

  function elegirEnMapa(id) {
    enMapa = (enMapa === id) ? null : id;
    pintarMapa();
    pintarDetalle();
  }

  function pintarDetalle() {
    var cont = document.getElementById('detalle');
    cont.textContent = '';

    if (!enMapa || !indice[enMapa]) {
      var c0 = el('div', 'card');
      c0.appendChild(el('p', 'det__vacio', 'Elegí una materia del mapa para ver qué necesita antes y qué destraba después.'));
      cont.appendChild(c0);
      return;
    }

    var m = indice[enMapa];
    var estado = estadoDe(m.codigo);
    var puede = puedeCursar(m);
    var falta = faltantes(m);

    var cab = el('div', 'card');
    cab.appendChild(el('h3', 'det__titulo', m.nombre));
    var meta = el('p', 'det__meta');
    meta.appendChild(document.createTextNode(
      (m.nivel ? 'Nivel ' + m.nivel : 'Electiva') + ' · ' + ETIQUETA[estado] + ' · '));
    if (puede) meta.appendChild(el('b', null, 'Podés cursarla'));
    else if (falta.length) meta.appendChild(el('b', null, 'Te ' + (falta.length === 1 ? 'falta 1 correlativa' : 'faltan ' + falta.length + ' correlativas')));
    else meta.appendChild(el('b', null, 'Ya la tenés'));
    cab.appendChild(meta);
    cont.appendChild(cab);

    var previas = m.correlativas || [];
    cont.appendChild(el('h3', 'ghead', 'Necesitás antes'));
    var c1 = el('div', 'card');
    if (!previas.length) {
      c1.appendChild(el('p', 'vacio', 'No tiene correlativas: la podés cursar sin nada previo.'));
    } else {
      previas.forEach(function (r) {
        c1.appendChild(filaRelacion(indice[r.de], r.tipo));
      });
    }
    cont.appendChild(c1);

    var luego = C.dependientes(m.codigo, todas());
    cont.appendChild(el('h3', 'ghead', 'Destraba'));
    var c2 = el('div', 'card');
    if (!luego.length) {
      c2.appendChild(el('p', 'vacio', 'Ninguna materia la tiene como correlativa.'));
    } else {
      luego.forEach(function (h) {
        var r = h.correlativas.filter(function (x) { return x.de === m.codigo; })[0];
        c2.appendChild(filaRelacion(h, r.tipo));
      });
    }
    cont.appendChild(c2);

    var cadena = C.cadenaPrevia(m, indice);
    if (cadena.length > previas.length) {
      cont.appendChild(el('h3', 'ghead', 'Toda la cadena hacia atrás'));
      var c3 = el('div', 'card');
      cadena.sort(function (a, b) { return (a.nivel || 9) - (b.nivel || 9); })
        .forEach(function (p) { c3.appendChild(filaRelacion(p, null)); });
      cont.appendChild(c3);
    }
  }

  function filaRelacion(m, tipo) {
    if (!m) return el('div', 'row');
    var w = el('div', 'fila-wrap');
    var b = el('button', 'mat');
    b.type = 'button';
    b.dataset.saltar = m.codigo;

    var id = el('span', 'mat__id');
    id.appendChild(el('span', 'mat__nombre', m.nombre));
    if (tipo) {
      id.appendChild(el('span', 'mat__cod',
        'Hay que ' + (tipo === 'REGULARIZAR' ? 'regularizarla' : 'aprobarla')));
    }
    b.appendChild(id);

    var der = el('span', 'mat__der');
    der.appendChild(chip(estadoDe(m.codigo), puedeCursar(m)));
    b.appendChild(der);

    b.addEventListener('click', function () { elegirEnMapa(m.codigo); });
    w.appendChild(b);
    return w;
  }

  // ------------------------------------------------------------ secciones

  var VISTAS = ['plan', 'correlativas', 'ajustes', 'simulador', 'critico', 'impacto',
                'evolucion', 'proyeccion'];
  // Las herramientas no son pestañas: son pantallas a las que se entra desde
  // Plan y de las que se vuelve, como una vista empujada.
  var HERRAMIENTAS = {
    simulador: 'Simulador de inscripción',
    critico: 'Camino crítico',
    impacto: 'Ordenar por impacto',
    evolucion: 'Evolución del peso académico',
    proyeccion: 'Proyección de egreso'
  };

  function irA(cual) {
    seccion = cual;
    VISTAS.forEach(function (s) {
      document.getElementById('vista-' + s).hidden = (s !== cual);
    });
    ['plan', 'correlativas', 'ajustes'].forEach(function (s) {
      document.getElementById('tab-' + s).setAttribute('aria-selected', String(s === cual));
    });

    var esHerramienta = !!HERRAMIENTAS[cual];
    document.getElementById('seg').hidden = esHerramienta;
    document.getElementById('btn-volver').hidden = !esHerramienta;
    document.getElementById('topbar-title').textContent =
      esHerramienta ? HERRAMIENTAS[cual] : 'Plan K23';

    if (cual === 'correlativas') { pintarMapa(); pintarDetalle(); }
    else if (cual === 'simulador') pintarSimulador();
    else if (cual === 'critico') pintarCritico();
    else if (cual === 'impacto') pintarImpacto();
    else if (cual === 'evolucion') pintarEvolucion();
    else if (cual === 'proyeccion') pintarProyeccion();

    window.scrollTo(0, 0);
  }

  function pintarTodo() {
    reindexar();
    pintarResumen();
    pintarNiveles();
    pintarElectivas();
    if (seccion === 'correlativas') { pintarMapa(); pintarDetalle(); }
  }

  // -------------------------------------------------------------- archivo

  function exportar() {
    var blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plan-k23-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importar(archivo) {
    var lector = new FileReader();
    lector.onload = function () {
      try {
        var d = JSON.parse(lector.result);
        if (!d || typeof d !== 'object' || !d.materias) throw new Error('formato');
        datos = {
          materias: d.materias,
          electivas: d.electivas || [],
          ajustes: Object.assign(C.ajustesVacios(), d.ajustes || {})
        };
        abierta = null; enMapa = null;
        guardar();
        pintarAjustes();
        pintarTodo();
        irA('plan');
      } catch (e) {
        avisar('Ese archivo no es un respaldo válido de Plan K23. Elegí el JSON que generó Exportar.');
        irA('plan');
      }
    };
    lector.onerror = function () { avisar('No se pudo leer el archivo.'); irA('plan'); };
    lector.readAsText(archivo);
  }

  // ------------------------------------------------------- copia en disco

  var TEXTO_DISCO = {
    'sin-soporte':     { valor: 'No disponible', sub: 'Este navegador no permite escribir archivos desde una página local. Usá Exportar.' },
    'sin-configurar':  { valor: 'Configurar',    sub: 'Elegí dónde y la app lo reescribe sola en cada cambio' },
    'activa':          { valor: 'Activa',        sub: 'Se reescribe sola cada vez que cambiás algo' },
    'necesita-permiso':{ valor: 'Reactivar',     sub: 'El navegador pide permiso de nuevo al reabrir la página' },
    'error':           { valor: 'Reintentar',    sub: 'No se pudo escribir el archivo' }
  };

  function pintarDisco(estado, nombre, detalle) {
    var t = TEXTO_DISCO[estado] || TEXTO_DISCO['sin-configurar'];
    document.getElementById('disco-estado').textContent = t.valor;
    document.getElementById('disco-sub').textContent =
      (estado === 'activa' && nombre) ? nombre + ' · ' + t.sub
      : (estado === 'error' && detalle) ? t.sub + ' (' + detalle + ')'
      : t.sub;
    document.getElementById('btn-disco').disabled = (estado === 'sin-soporte');
    document.getElementById('btn-disco-off').hidden =
      (estado === 'sin-configurar' || estado === 'sin-soporte');
  }

  function tocarDisco() {
    var e = window.Disco.estado();
    if (e === 'necesita-permiso') {
      window.Disco.reactivar().then(function (ok) {
        if (ok) guardar();   // deja el archivo al día apenas se reactiva
      });
    } else if (e !== 'sin-soporte') {
      window.Disco.configurar().then(function (ok) {
        if (ok) guardar();
      });
    }
  }

  function pintarAjustes() {
    var a = datos.ajustes;
    document.getElementById('aj-anio').value = a.anioInicio || '';
    document.getElementById('aj-desaprobados').value = a.finalesDesaprobados || 0;
    document.getElementById('aj-ausentes').value = a.ausentesCiclo || 0;
  }

  // =================================================== HERRAMIENTAS =========
  // Tres pantallas de decisión. Son de sólo lectura: calculan sobre los datos
  // pero nunca los escriben.

  function punto(color) {
    var p = el('i', 'chip__pt');
    p.setAttribute('aria-hidden', 'true');
    p.style.background = color;
    return p;
  }

  // ---------------------------------------------------------- simulador

  function filaSim(m) {
    var fila = el('label', 'row sim__fila');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!seleccionSim[m.codigo];
    cb.addEventListener('change', function () {
      if (cb.checked) seleccionSim[m.codigo] = 1; else delete seleccionSim[m.codigo];
      pintarResultadoSim();
    });
    fila.appendChild(cb);

    var estado = estadoDe(m.codigo);
    var id = el('span', 'row__label');
    id.appendChild(el('span', 'sim__nom', m.nombre));
    var meta = el('span', 'sim__meta');
    meta.appendChild(punto(puedeCursar(m) ? 'var(--accent)' : colorDe(estado)));
    meta.appendChild(el('span', null,
      (m.nivel ? 'Nivel ' + m.nivel : 'Electiva') +
      (m.duracion ? ' · ' + (m.duracion === 'anual' ? 'anual' : 'cuatrimestral') : '') + ' · ' +
      (puedeCursar(m) ? 'podés cursarla' : ETIQUETA[estado].toLowerCase())));
    id.appendChild(meta);
    fila.appendChild(id);
    return fila;
  }

  function pintarSimulador() {
    var lista = document.getElementById('sim-lista');
    lista.textContent = '';

    var enCurso = activas().filter(function (m) { return estadoDe(m.codigo) === 'cursando'; });
    var libres = activas().filter(function (m) {
      return verTodas
        ? (!C.APROBADAS[estadoDe(m.codigo)] && estadoDe(m.codigo) !== 'cursando')
        : puedeCursar(m);
    });

    // Lo que ya estás cursando termina este ciclo, así que entra marcado: la
    // simulación tiene que mostrar cómo cerrás el cuatrimestre, no sólo lo que
    // sumás si te anotás a algo más.
    if (!simInicializado) {
      enCurso.forEach(function (m) { seleccionSim[m.codigo] = 1; });
      simInicializado = true;
    }

    document.getElementById('sim-ayuda').textContent = verTodas
      ? 'Todas las materias que todavía no aprobaste. Las que no podés cursar quedan marcadas.'
      : 'Lo que estás cursando ya viene marcado. Sumá las que pensás anotarte.';

    var ordenar = function (a, b) { return (a.nivel || 9) - (b.nivel || 9); };

    if (enCurso.length) {
      lista.appendChild(el('p', 'sim__grupo', 'Ya las estás cursando'));
      enCurso.sort(ordenar).forEach(function (m) { lista.appendChild(filaSim(m)); });
    }

    if (libres.length) {
      lista.appendChild(el('p', 'sim__grupo', enCurso.length ? 'Te podés anotar a' : 'Podés anotarte a'));
      libres.sort(ordenar).forEach(function (m) { lista.appendChild(filaSim(m)); });
    }

    if (!enCurso.length && !libres.length) {
      lista.appendChild(el('p', 'vacio', verTodas
        ? 'Ya aprobaste todo el plan.'
        : 'No hay ninguna materia habilitada con tu estado actual.'));
    }

    // Las electivas suman igual que cualquier materia, pero sólo aparecen acá
    // si ya las agregaste en Plan.
    var cupo = (typeof CUPO_ELECTIVAS === 'number') ? CUPO_ELECTIVAS : 3;
    var faltan = cupo - datos.electivas.length;
    var pie = document.getElementById('sim-electivas');
    if (faltan > 0) {
      pie.hidden = false;
      pie.textContent = 'Te ' + (faltan === 1 ? 'falta elegir 1 electiva' : 'faltan elegir ' + faltan + ' electivas') +
        '. Las electivas suman al peso académico igual que el resto, pero para simularlas ' +
        'primero tenés que agregarlas en Plan.';
    } else {
      pie.hidden = true;
    }

    pintarResultadoSim();
  }

  function pintarResultadoSim() {
    var caja = document.getElementById('sim-resultado');
    caja.textContent = '';

    var elegidas = Object.keys(seleccionSim).filter(function (id) { return !!indice[id]; });
    if (!elegidas.length) {
      caja.appendChild(el('p', 'vacio', 'Marcá al menos una materia para ver cómo quedarías.'));
      return;
    }

    var s = C.simular(activas(), datos, datos.ajustes, elegidas, new Date());

    var v = el('div', 'veredicto');
    v.dataset.ok = s.viable ? '1' : '0';
    v.appendChild(el('b', null, s.viable ? '✓ Combinación viable' : '⚠ Esta combinación no cierra'));
    v.appendChild(el('span', null, ' · ' + elegidas.length +
      (elegidas.length === 1 ? ' materia' : ' materias')));
    caja.appendChild(v);

    if (s.noHabilitadas.length) {
      var a1 = el('p', 'sim__alerta');
      a1.appendChild(el('b', null, 'Todavía no podés cursar: '));
      a1.appendChild(document.createTextNode(
        s.noHabilitadas.map(function (m) { return m.nombre; }).join(', ') + '.'));
      caja.appendChild(a1);
    }
    if (s.conflictos.length) {
      var a2 = el('p', 'sim__alerta');
      a2.appendChild(el('b', null, 'No se pueden cursar juntas: '));
      a2.appendChild(document.createTextNode(s.conflictos.map(function (c) {
        return c.materia.nombre + ' necesita ' + c.requiere.nombre + ' aprobada antes';
      }).join('; ') + '.'));
      caja.appendChild(a2);
    }

    var t = el('table', 'comp');
    var thead = el('thead'), trh = el('tr');
    trh.appendChild(el('th', null, ''));
    trh.appendChild(el('th', 'comp__num', 'Hoy'));
    trh.appendChild(el('th', 'comp__num', 'Si aprobás'));
    trh.appendChild(el('th', 'comp__num', ''));
    thead.appendChild(trh);
    t.appendChild(thead);

    var tb = el('tbody');
    [
      ['Peso académico (hasta CL2026)', s.base.pesoViejo, s.despues.pesoViejo],
      ['Peso académico (desde CL2027)', s.base.pesoNuevo, s.despues.pesoNuevo],
      ['Materias aprobadas', s.base.mApTotal, s.despues.mApTotal]
    ].forEach(function (f) {
      var tr = el('tr');
      tr.appendChild(el('th', null, f[0]));
      tr.appendChild(el('td', 'comp__num', String(f[1])));
      tr.appendChild(el('td', 'comp__num comp__fuerte', String(f[2])));
      var d = f[2] - f[1];
      var td = el('td', 'comp__num comp__delta', (d > 0 ? '+' : '') + d);
      td.dataset.signo = d > 0 ? 'mas' : (d < 0 ? 'menos' : 'igual');
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    caja.appendChild(t);

    var h = el('p', 'sim__sub');
    if (!s.destrabadas.length) {
      h.textContent = 'No destraba ninguna materia nueva de forma inmediata.';
      caja.appendChild(h);
    } else {
      h.textContent = 'Destraba ' + s.destrabadas.length +
        (s.destrabadas.length === 1 ? ' materia nueva:' : ' materias nuevas:');
      caja.appendChild(h);
      var ul = el('ul', 'destraba');
      s.destrabadas.sort(function (a, b) { return (a.nivel || 9) - (b.nivel || 9); })
        .forEach(function (m) {
          var li = el('li');
          li.appendChild(punto('var(--accent)'));
          li.appendChild(el('span', null, m.nombre));
          li.appendChild(el('span', 'destraba__niv', m.nivel ? 'Nivel ' + m.nivel : 'Electiva'));
          ul.appendChild(li);
        });
      caja.appendChild(ul);
    }

    caja.appendChild(el('p', 'sim__nota',
      'La simulación supone que aprobás todo lo marcado en el ciclo ' + s.base.cicloActual +
      '. No modifica tus datos.'));
  }

  // ----------------------------------------------------- camino critico

  function pintarCritico() {
    var r = C.caminoCritico(obligatoriasActivas(), estadoDe);

    document.getElementById('crit-n').textContent = r.cuatri || '0';
    document.getElementById('crit-u').textContent =
      r.cuatri === 1 ? 'cuatrimestre como mínimo' : 'cuatrimestres como mínimo';
    document.getElementById('crit-exp').textContent = r.largo === 0
      ? 'Ya aprobaste todas las materias del plan.'
      : 'Esta cadena de ' + r.largo + (r.largo === 1 ? ' materia' : ' materias') +
        ' es la más larga que te queda: cada una necesita la anterior aprobada, así que no hay ' +
        'forma de acortarla cursando en paralelo. Sólo se cuentan los cuatrimestres que te falta ' +
        'cursar — las anuales valen dos, y las que ya cursaste no suman aunque debas el final.';

    var cont = document.getElementById('crit-cadena');
    cont.textContent = '';
    if (!r.camino.length) {
      cont.appendChild(el('p', 'vacio', 'No queda ninguna cadena pendiente.'));
    } else {
      r.camino.forEach(function (m, i) {
        var fila = el('div', 'row crit__paso');
        fila.appendChild(el('span', 'crit__i num', String(i + 1)));
        var id = el('span', 'row__label');
        id.appendChild(el('span', 'sim__nom', m.nombre));
        var meta = el('span', 'sim__meta');
        meta.appendChild(punto(puedeCursar(m) ? 'var(--accent)' : colorDe(estadoDe(m.codigo))));
        var e = estadoDe(m.codigo);
        var cuesta = (e === 'regularizada' || e === 'cursando') ? 0 : (m.duracion === 'anual' ? 2 : 1);
        var comoSuma = cuesta === 0
          ? (e === 'regularizada' ? 'ya la cursaste, sólo debés el final' : 'ya la estás cursando')
          : '+' + cuesta + (cuesta === 1 ? ' cuatrimestre' : ' cuatrimestres');
        meta.appendChild(el('span', null, 'Nivel ' + m.nivel + ' · ' +
          (m.duracion === 'anual' ? 'anual' : 'cuatrimestral') + ' · ' + comoSuma));
        id.appendChild(meta);
        fila.appendChild(id);
        cont.appendChild(fila);
      });
    }

    var urg = document.getElementById('crit-urgente');
    urg.textContent = '';
    var primera = r.camino[0];
    if (!primera) {
      urg.appendChild(el('p', 'vacio', 'Nada urgente: no te queda cadena por delante.'));
      return;
    }
    var estado = estadoDe(primera.codigo);
    var texto;
    if (estado === 'cursando') {
      texto = '. Es el primer eslabón de la cadena y ya la estás cursando: aprobarla este ' +
              'cuatrimestre es lo que más te acorta la carrera.';
    } else if (puedeCursar(primera)) {
      texto = '. Es el primer eslabón de la cadena y ya la podés cursar. Cada cuatrimestre que ' +
              'la postergues es un cuatrimestre más de carrera, por más materias que apruebes ' +
              'en paralelo.';
    } else {
      texto = '. Es el primer eslabón de la cadena y todavía no la podés cursar. Mirá qué le ' +
              'falta en la sección Correlativas.';
    }
    var p = el('p', 'crit__urg');
    p.appendChild(el('b', null, primera.nombre));
    p.appendChild(document.createTextNode(texto));
    urg.appendChild(p);
  }

  // ------------------------------------------------------------ impacto

  function pintarImpacto() {
    var cont = document.getElementById('imp-lista');
    cont.textContent = '';

    var cursables = activas().filter(puedeCursar);
    if (!cursables.length) {
      cont.appendChild(el('p', 'vacio', 'No hay ninguna materia habilitada con tu estado actual.'));
      document.getElementById('imp-pie').textContent = '';
      pintarFinales();
      return;
    }

    var filas = cursables.map(function (m) {
      var i = C.impacto(m, activas(), estadoDe);
      return { m: m, ya: i.destrabaYa.length, total: i.total.length, lista: i.destrabaYa };
    });
    filas.sort(function (a, b) {
      return (b.ya - a.ya) || (b.total - a.total) || (a.m.nivel || 9) - (b.m.nivel || 9);
    });

    filas.forEach(function (f) {
      var fila = el('div', 'row imp__fila');
      var id = el('span', 'row__label');
      id.appendChild(el('span', 'sim__nom', f.m.nombre));
      var meta = el('span', 'sim__meta');
      meta.appendChild(punto('var(--accent)'));
      meta.appendChild(el('span', null, f.m.nivel ? 'Nivel ' + f.m.nivel : 'Electiva'));
      if (f.lista.length) {
        meta.appendChild(el('span', 'imp__quienes',
          '→ ' + f.lista.map(function (x) { return x.nombre; }).join(', ')));
      }
      id.appendChild(meta);
      fila.appendChild(id);

      var nums = el('span', 'imp__nums');
      var a = el('span', 'imp__n');
      a.appendChild(el('b', 'num', String(f.ya)));
      a.appendChild(el('small', null, 'ahora'));
      if (f.ya > 0) a.dataset.destaca = '1';
      nums.appendChild(a);

      var b = el('span', 'imp__n');
      b.appendChild(el('b', 'num', String(f.total)));
      b.appendChild(el('small', null, 'en total'));
      nums.appendChild(b);

      fila.appendChild(nums);
      cont.appendChild(fila);
    });

    var conImpacto = filas.filter(function (f) { return f.ya > 0; }).length;
    pintarFinales();

    document.getElementById('imp-pie').textContent = conImpacto
      ? 'De las ' + filas.length + ' que podés cursar, ' + conImpacto +
        (conImpacto === 1 ? ' destraba' : ' destraban') + ' algo de inmediato. ' +
        'Las de arriba son las que más te mueven el plan.'
      : 'Ninguna de las que podés cursar destraba otra materia por sí sola: todas las que siguen ' +
        'necesitan más de una correlativa. Mirá la columna «en total» para ver cuál pesa más a futuro.';
  }


  // ---------------------------------------------------------- evolucion

  function pintarEvolucion() {
    var serie = C.historialPeso(activas(), datos, datos.ajustes, new Date());
    var cont = document.getElementById('evo-grafico');
    var tabla = document.getElementById('evo-tabla');
    cont.textContent = '';
    tabla.textContent = '';

    if (serie.length < 2) {
      cont.appendChild(el('p', 'vacio', serie.length
        ? 'Con un solo ciclo cargado todavía no hay curva. Cargá el año de cada materia para ver la evolución.'
        : 'Cargá materias con su año y acá aparece cómo se movió tu peso académico.'));
      return;
    }

    var vals = [];
    serie.forEach(function (p) { vals.push(p.pesoViejo, p.pesoNuevo); });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }

    var NS = 'http://www.w3.org/2000/svg';
    var W = 640, H = 230, PL = 46, PR = 14, PT = 16, PB = 30;
    var x = function (i) { return PL + i * (W - PL - PR) / Math.max(1, serie.length - 1); };
    var y = function (v) { return PT + (max - v) * (H - PT - PB) / (max - min); };

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'evo');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Evolución del peso académico entre ' + serie[0].ciclo +
      ' y ' + serie[serie.length - 1].ciclo);

    // La línea del cero separa lo que suma de lo que resta.
    if (min < 0 && max > 0) {
      var cero = document.createElementNS(NS, 'line');
      cero.setAttribute('x1', PL); cero.setAttribute('x2', W - PR);
      cero.setAttribute('y1', y(0)); cero.setAttribute('y2', y(0));
      cero.setAttribute('class', 'evo__cero');
      svg.appendChild(cero);
    }

    [['pesoViejo', 'viejo'], ['pesoNuevo', 'nuevo']].forEach(function (par) {
      var d = serie.map(function (p, i) {
        return (i ? 'L' : 'M') + x(i) + ',' + y(p[par[0]]);
      }).join(' ');
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'evo__linea evo__linea--' + par[1]);
      svg.appendChild(path);
      serie.forEach(function (p, i) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x(i)); c.setAttribute('cy', y(p[par[0]]));
        c.setAttribute('r', 3.5);
        c.setAttribute('class', 'evo__punto evo__punto--' + par[1]);
        svg.appendChild(c);
      });
    });

    [max, min].forEach(function (v) {
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', PL - 8); t.setAttribute('y', y(v) + 4);
      t.setAttribute('class', 'evo__eje evo__eje--y');
      t.textContent = String(v);
      svg.appendChild(t);
    });
    serie.forEach(function (p, i) {
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x(i)); t.setAttribute('y', H - 10);
      t.setAttribute('class', 'evo__eje');
      t.textContent = String(p.ciclo);
      svg.appendChild(t);
    });
    cont.appendChild(svg);

    var leyenda = el('p', 'evo__leyenda');
    [['viejo', 'Hasta CL2026'], ['nuevo', 'Desde CL2027']].forEach(function (l) {
      var sp = el('span', 'evo__clave');
      var i = el('i', 'evo__swatch evo__swatch--' + l[0]);
      i.setAttribute('aria-hidden', 'true');
      sp.appendChild(i);
      sp.appendChild(document.createTextNode(l[1]));
      leyenda.appendChild(sp);
    });
    cont.appendChild(leyenda);

    var ultimo = null;
    serie.forEach(function (p) {
      var fila = el('div', 'row');
      var lab = el('span', 'row__label');
      lab.appendChild(el('b', null, String(p.ciclo)));
      lab.appendChild(el('span', 'row__sub', '  ' + p.aprobadas +
        (p.aprobadas === 1 ? ' materia aprobada' : ' materias aprobadas')));
      fila.appendChild(lab);
      var v = el('span', 'row__value num');
      v.appendChild(el('b', null, String(p.pesoViejo)));
      if (ultimo !== null) {
        var d = p.pesoViejo - ultimo;
        var sp2 = el('span', 'evo__delta', ' ' + (d > 0 ? '+' : '') + d);
        sp2.dataset.signo = d > 0 ? 'mas' : (d < 0 ? 'menos' : 'igual');
        v.appendChild(sp2);
      }
      fila.appendChild(v);
      tabla.appendChild(fila);
      ultimo = p.pesoViejo;
    });
  }

  // --------------------------------------------------------- proyeccion

  function pintarProyeccion() {
    var ritmo = parseInt(document.getElementById('proy-ritmo').value, 10) || 4;
    document.getElementById('proy-ritmo-n').textContent = String(ritmo);

    var p = C.proyeccion(obligatoriasActivas(), estadoDe, ritmo, new Date());
    var caja = document.getElementById('proy-resultado');
    caja.textContent = '';

    if (p.cuatrimestres === 0) {
      caja.appendChild(el('p', 'vacio', 'Ya aprobaste todas las materias del plan.'));
      return;
    }

    var cifra = el('div', 'crit__cifra');
    cifra.appendChild(el('span', 'crit__n num', String(p.cuatrimestres)));
    cifra.appendChild(el('span', 'crit__u', p.cuatrimestres === 1 ? 'cuatrimestre' : 'cuatrimestres'));
    caja.appendChild(cifra);

    var res = el('p', 'crit__exp');
    res.appendChild(document.createTextNode('Cursando ' + ritmo +
      (ritmo === 1 ? ' materia' : ' materias') + ' por cuatrimestre, terminarías alrededor de '));
    res.appendChild(el('b', null, String(p.anioEgreso)));
    res.appendChild(document.createTextNode('.'));
    caja.appendChild(res);

    var det = el('p', 'crit__exp');
    det.textContent = p.loLimita === 'ritmo'
      ? 'Te faltan ' + p.faltaCursar + ' materias por cursar, que son ' + p.cuatriMateria +
        ' cuatrimestres de cursada contando que las anuales ocupan dos. A ese ritmo son ' +
        p.porRitmo + ' cuatrimestres, y las correlativas te obligan a ' + p.critico +
        ', así que lo que manda es el ritmo: cursando más por vez, terminás antes.'
      : 'Te faltan ' + p.faltaCursar + ' materias por cursar. A ese ritmo las cubrirías en ' +
        p.porRitmo + ' cuatrimestres, pero la cadena de correlativas te obliga a ' + p.critico +
        '. Lo que manda son las correlativas: cursar más materias por vez ya no te acorta la carrera.';
    caja.appendChild(det);

    if (p.pendientes > p.faltaCursar) {
      caja.appendChild(el('p', 'sim__nota', 'Las ' + (p.pendientes - p.faltaCursar) +
        ' materias que ya cursaste y te deben final no suman cuatrimestres: sólo hay que rendirlas.'));
    }
  }


  // ----------------------------------------------------------- buscador

  var busSel = 0;

  function normalizar(t) {
    return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function abrirBuscador() {
    document.getElementById('buscador').hidden = false;
    var inp = document.getElementById('buscador-inp');
    inp.value = '';
    inp.focus();
    busSel = 0;
    pintarBuscador();
  }

  function cerrarBuscador() {
    document.getElementById('buscador').hidden = true;
  }

  function resultadosBuscador() {
    var q = normalizar(document.getElementById('buscador-inp').value.trim());
    var lista = todas();
    if (!q) return lista.slice(0, 8);
    return lista.filter(function (m) {
      return normalizar(m.nombre).indexOf(q) >= 0 ||
             (m.sigla && normalizar(m.sigla).indexOf(q) >= 0);
    }).slice(0, 8);
  }

  function pintarBuscador() {
    var cont = document.getElementById('buscador-res');
    cont.textContent = '';
    var res = resultadosBuscador();
    if (!res.length) {
      cont.appendChild(el('p', 'vacio', 'Ninguna materia coincide.'));
      return;
    }
    if (busSel >= res.length) busSel = res.length - 1;
    res.forEach(function (m, i) {
      var b = el('button', 'buscador__item' + (i === busSel ? ' is-sel' : ''));
      b.type = 'button';
      var izq = el('span', 'row__label');
      izq.appendChild(el('span', 'sim__nom', m.nombre));
      var meta = el('span', 'sim__meta');
      meta.appendChild(punto(puedeCursar(m) ? 'var(--accent)' : colorDe(estadoDe(m.codigo))));
      meta.appendChild(el('span', null,
        (m.nivel ? 'Nivel ' + m.nivel : 'Electiva') + ' · ' +
        (puedeCursar(m) ? 'podés cursarla' : ETIQUETA[estadoDe(m.codigo)].toLowerCase())));
      izq.appendChild(meta);
      b.appendChild(izq);
      b.addEventListener('click', function () { elegirDelBuscador(m); });
      cont.appendChild(b);
    });
  }

  function elegirDelBuscador(m) {
    cerrarBuscador();
    abierta = m.codigo;
    irA('plan');
    pintarNiveles();
    pintarElectivas();
    var celdaSel = document.querySelector('.celda[data-id="' + m.codigo + '"], .mat[data-id="' + m.codigo + '"]');
    if (celdaSel && celdaSel.scrollIntoView) celdaSel.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }


  // ------------------------------------------------- prioridad de finales

  var PRIO = { alta: 'Alta', normal: 'Normal', baja: 'Baja' };
  var ORDEN_PRIO = { alta: 0, normal: 1, baja: 2 };

  function prioridadDe(id) {
    var r = datos.materias[id];
    return (r && r.prioridad) || 'normal';
  }

  function ciclarPrioridad(id) {
    var actual = prioridadDe(id);
    var siguiente = actual === 'normal' ? 'alta' : (actual === 'alta' ? 'baja' : 'normal');
    rec(id).prioridad = siguiente === 'normal' ? null : siguiente;
    guardar();
    pintarImpacto();
  }

  function pintarFinales() {
    var cont = document.getElementById('fin-lista');
    var pie = document.getElementById('fin-pie');
    cont.textContent = '';

    var adeudados = activas().filter(function (m) {
      return estadoDe(m.codigo) === 'regularizada';
    });

    if (!adeudados.length) {
      cont.appendChild(el('p', 'vacio', 'No debés ningún final: todas las materias que cursaste ya están aprobadas.'));
      pie.textContent = '';
      return;
    }

    var filas = adeudados.map(function (m) {
      var i = C.impactoFinal(m, activas(), estadoDe);
      return { m: m, ya: i.desbloqueaYa.length, traba: i.trabadas.length,
               total: i.total.length, lista: i.desbloqueaYa };
    });
    filas.sort(function (a, b) {
      return (ORDEN_PRIO[prioridadDe(a.m.codigo)] - ORDEN_PRIO[prioridadDe(b.m.codigo)]) ||
             (b.ya - a.ya) || (b.traba - a.traba) || (b.total - a.total);
    });

    filas.forEach(function (f) {
      var fila = el('div', 'row imp__fila');

      var id = el('span', 'row__label');
      id.appendChild(el('span', 'sim__nom', f.m.nombre));
      var meta = el('span', 'sim__meta');
      meta.appendChild(punto('var(--amarillo)'));
      meta.appendChild(el('span', null, (f.m.nivel ? 'Nivel ' + f.m.nivel : 'Electiva') +
        ' · +' + C.GANANCIA_PESO_FINAL + ' al peso'));
      if (f.lista.length) {
        meta.appendChild(el('span', 'imp__quienes',
          '→ destraba ' + f.lista.map(function (x) { return x.nombre; }).join(', ')));
      } else if (f.traba) {
        meta.appendChild(el('span', 'imp__quienes',
          '→ ' + f.traba + (f.traba === 1 ? ' materia lo pide' : ' materias lo piden') +
          ' aprobado, pero les falta algo más'));
      }
      id.appendChild(meta);
      fila.appendChild(id);

      var prio = prioridadDe(f.m.codigo);
      var bp = el('button', 'prio');
      bp.type = 'button';
      bp.dataset.p = prio;
      bp.textContent = PRIO[prio];
      bp.setAttribute('aria-label', 'Prioridad de ' + f.m.nombre + ': ' + PRIO[prio] + '. Tocá para cambiarla.');
      bp.addEventListener('click', function () { ciclarPrioridad(f.m.codigo); });
      fila.appendChild(bp);

      var nums = el('span', 'imp__nums');
      var a = el('span', 'imp__n');
      a.appendChild(el('b', 'num', String(f.ya)));
      a.appendChild(el('small', null, 'destraba'));
      if (f.ya > 0) a.dataset.destaca = '1';
      nums.appendChild(a);
      var b = el('span', 'imp__n');
      b.appendChild(el('b', 'num', String(f.total)));
      b.appendChild(el('small', null, 'en total'));
      nums.appendChild(b);
      fila.appendChild(nums);

      cont.appendChild(fila);
    });

    var conImpacto = filas.filter(function (f) { return f.ya > 0; }).length;
    pie.textContent = 'Debés ' + filas.length + (filas.length === 1 ? ' final' : ' finales') +
      '. Cada uno que apruebes suma ' + C.GANANCIA_PESO_FINAL +
      ' puntos al peso nuevo (+11 por aprobada y +7 por dejar de adeudarlo) y no te consume ' +
      'ningún cuatrimestre. ' +
      (conImpacto
        ? 'Los de arriba son los que además destraban materias.'
        : 'Ninguno destraba una materia por sí solo todavía.');
  }

  // ------------------------------------------------------------- arranque

  function iniciar() {
    cargar();
    ultimoGuardado = JSON.stringify(datos, null, 2);
    reindexar();

    var tema = 'auto';
    try { tema = localStorage.getItem(CLAVE_TEMA) || 'auto'; } catch (e) { /* sin persistencia */ }
    aplicarTema(tema);

    pintarAjustes();
    pintarTodo();

    ['plan', 'correlativas', 'ajustes'].forEach(function (s) {
      document.getElementById('tab-' + s).addEventListener('click', function () { irA(s); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('#seg-tema .seg__btn'), function (b) {
      b.addEventListener('click', function () { aplicarTema(b.dataset.tema); });
    });

    document.getElementById('vista-plan').addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('.celda, .mat');
      if (!b || !b.dataset.id) return;
      var yaEstaba = abierta === b.dataset.id;
      abierta = yaEstaba ? null : b.dataset.id;
      pintarNiveles();
      pintarElectivas();
      if (!yaEstaba) {
        var ed = document.querySelector('.edcard');
        if (ed && ed.scrollIntoView) ed.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });

    document.getElementById('btn-filtro').addEventListener('click', function () {
      soloPuedo = !soloPuedo;
      this.setAttribute('aria-pressed', String(soloPuedo));
      this.textContent = soloPuedo ? 'Ver todas' : 'Sólo las que podés cursar';
      pintarNiveles();
    });

    var campos = {
      'aj-anio': 'anioInicio',
      'aj-desaprobados': 'finalesDesaprobados', 'aj-ausentes': 'ausentesCiclo'
    };
    Object.keys(campos).forEach(function (id) {
      document.getElementById(id).addEventListener('change', function () {
        var v = this.value === '' ? null : parseInt(this.value, 10);
        if (v !== null && isNaN(v)) v = null;
        datos.ajustes[campos[id]] = (campos[id] === 'anioInicio') ? v : Math.max(0, v || 0);
        if (campos[id] !== 'anioInicio') this.value = datos.ajustes[campos[id]];
        guardar();
        pintarResumen();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-herr]'), function (b) {
      b.addEventListener('click', function () { irA(b.dataset.herr); });
    });
    document.getElementById('btn-volver').addEventListener('click', function () { irA('plan'); });
    document.getElementById('sim-todas').addEventListener('change', function () {
      verTodas = this.checked;
      pintarSimulador();
    });

    if (window.Disco) {
      window.Disco.iniciar(pintarDisco);
      document.getElementById('btn-disco').addEventListener('click', tocarDisco);
      document.getElementById('btn-disco-off').addEventListener('click', function () {
        if (!window.confirm('La app deja de escribir el archivo. El archivo que ya existe no se ' +
                            'borra, y tus datos siguen guardados en este navegador. ¿Desactivar?')) return;
        window.Disco.desactivar();
      });
    }

    document.getElementById('btn-deshacer').addEventListener('click', deshacer);
    document.getElementById('btn-imprimir').addEventListener('click', function () {
      // El navegador imprime lo que se ve, y el botón vive en Ajustes: sin esto
      // saldría impresa la pantalla de Ajustes en vez del plan.
      irA('plan');
      abierta = null;
      pintarNiveles();
      setTimeout(function () { window.print(); }, 60);
    });
    document.getElementById('proy-ritmo').addEventListener('input', pintarProyeccion);

    var bInp = document.getElementById('buscador-inp');
    bInp.addEventListener('input', function () { busSel = 0; pintarBuscador(); });
    bInp.addEventListener('keydown', function (ev) {
      var res = resultadosBuscador();
      if (ev.key === 'ArrowDown') { ev.preventDefault(); busSel = Math.min(busSel + 1, res.length - 1); pintarBuscador(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); busSel = Math.max(busSel - 1, 0); pintarBuscador(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (res[busSel]) elegirDelBuscador(res[busSel]); }
    });
    document.getElementById('buscador').addEventListener('click', function (ev) {
      if (ev.target === this) cerrarBuscador();
    });

    document.addEventListener('keydown', function (ev) {
      var enBuscador = !document.getElementById('buscador').hidden;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        if (enBuscador) cerrarBuscador(); else abrirBuscador();
      } else if (ev.key === 'Escape' && enBuscador) {
        cerrarBuscador();
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !enBuscador) {
        var t = ev.target.tagName;
        if (t !== 'INPUT' && t !== 'TEXTAREA') { ev.preventDefault(); deshacer(); }
      }
    });

    document.getElementById('btn-exportar').addEventListener('click', exportar);
    document.getElementById('btn-importar').addEventListener('click', function () {
      document.getElementById('file-importar').click();
    });
    document.getElementById('file-importar').addEventListener('change', function () {
      if (this.files && this.files[0]) importar(this.files[0]);
      this.value = '';
    });
    document.getElementById('btn-reiniciar').addEventListener('click', function () {
      if (!window.confirm('Esto borra todas las materias, electivas y ajustes que cargaste. ¿Seguro?')) return;
      datos = { materias: {}, electivas: [], ajustes: C.ajustesVacios() };
      abierta = null; enMapa = null;
      guardar();
      pintarAjustes();
      pintarTodo();
    });

    document.getElementById('btn-electiva').addEventListener('click', abrirElectiva);
    document.getElementById('modal-electiva').addEventListener('close', function () {
      if (this.returnValue === 'ok') agregarElectiva();
    });

    document.getElementById('detalle').addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-saltar]');
      if (b) window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { if (seccion === 'correlativas') pintarMapa(); }, 150);
    });
  }

  function abrirElectiva() {
    var sel = document.getElementById('el-sel');
    sel.textContent = '';
    var tengo = {};
    datos.electivas.forEach(function (e) { tengo[e.nombre] = 1; });
    var v = document.createElement('option');
    v.value = ''; v.textContent = '— elegí una —';
    sel.appendChild(v);
    ELECTIVAS_K23.forEach(function (e) {
      if (tengo[e.nombre]) return;
      var o = document.createElement('option');
      o.value = e.nombre; o.textContent = e.nombre;
      sel.appendChild(o);
    });
    document.getElementById('el-otra').value = '';
    document.getElementById('modal-electiva').showModal();
  }

  function agregarElectiva() {
    var nombre = document.getElementById('el-otra').value.trim() ||
                 document.getElementById('el-sel').value;
    if (!nombre) return;
    var enPlan = ELECTIVAS_K23.filter(function (e) { return e.nombre === nombre; })[0];
    var codigo = (enPlan && enPlan.codigo) ||
                 ('EL:' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    if (datos.electivas.some(function (e) { return e.codigo === codigo; })) return;
    datos.electivas.push({ codigo: codigo, nombre: nombre, nivel: null, correlativas: [] });
    guardar();
    pintarTodo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
