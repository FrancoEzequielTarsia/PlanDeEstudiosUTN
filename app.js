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

  // --------------------------------------------------------------- datos

  // El Seminario Integrador no hace falta para el título de grado: no entra en
  // el total ni en el camino crítico, pero se puede cargar igual.
  var OBLIGATORIAS = PLAN_K23.filter(function (m) { return !m.opcional; });

  function todas() { return PLAN_K23.concat(datos.electivas); }

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

  function guardar() {
    var texto = JSON.stringify(datos, null, 2);
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
    var m = C.metricas(todas(), datos, datos.ajustes, new Date());
    var g = function (id) { return document.getElementById(id); };
    var n = function (v) { return v === null || v === undefined ? '—' : String(v); };

    g('peso-viejo').textContent = m.hayDatos ? String(m.pesoViejo) : '—';
    g('peso-nuevo').textContent = m.hayDatos ? String(m.pesoNuevo) : '—';
    g('promedio').textContent = m.promedio === null ? '—' : m.promedio.toFixed(2);
    g('promedio-pond').textContent = m.promedioPonderado === null ? '—' : m.promedioPonderado.toFixed(2);
    g('aprobadas').textContent = m.mApTotal + ' / ' + OBLIGATORIAS.length;
    g('habilitadas').textContent = n(todas().filter(puedeCursar).length);

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

    if (m.opcional) {
      var op = el('p', 'edit__nota');
      op.appendChild(el('b', null, 'Sólo para el título intermedio. '));
      op.appendChild(document.createTextNode(
        'No hace falta para recibirte de ingeniero, así que no cuenta en el total del plan ni en ' +
        'el camino crítico. Si la cursás igual, suma al peso académico como cualquier otra.'));
      caja.appendChild(op);
    }

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

    var pie = el('span', 'celda__pie');
    var pt = el('i', 'chip__pt');
    pt.setAttribute('aria-hidden', 'true');
    pt.style.background = puede ? 'var(--accent)' : colorDe(estado);
    pie.appendChild(pt);
    pie.appendChild(el('span', null, puede ? 'Podés cursarla' : ETIQUETA[estado]));
    if (r && typeof r.nota === 'number') pie.appendChild(el('span', 'celda__nota', String(r.nota)));
    b.appendChild(pie);

    b.setAttribute('aria-label', m.nombre + '. ' + ETIQUETA[estado] +
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
      return PLAN_K23.filter(function (m) { return m.nivel === n; });
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

  var VISTAS = ['plan', 'correlativas', 'ajustes', 'simulador', 'critico', 'impacto'];
  // Las herramientas no son pestañas: son pantallas a las que se entra desde
  // Plan y de las que se vuelve, como una vista empujada.
  var HERRAMIENTAS = {
    simulador: 'Simulador de inscripción',
    critico: 'Camino crítico',
    impacto: 'Ordenar por impacto'
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

  function pintarSimulador() {
    var lista = document.getElementById('sim-lista');
    lista.textContent = '';

    var candidatas = todas().filter(function (m) {
      return verTodas ? !C.APROBADAS[estadoDe(m.codigo)] : puedeCursar(m);
    });

    document.getElementById('sim-ayuda').textContent = verTodas
      ? 'Todas las materias que todavía no aprobaste. Las que no podés cursar quedan marcadas.'
      : 'Estas son las ' + candidatas.length + ' materias que hoy podés cursar. Marcá las que ' +
        'pensás anotarte.';

    if (!candidatas.length) {
      lista.appendChild(el('p', 'vacio', verTodas
        ? 'Ya aprobaste todo el plan.'
        : 'No hay ninguna materia habilitada con tu estado actual.'));
    }

    candidatas.sort(function (a, b) { return (a.nivel || 9) - (b.nivel || 9); });
    candidatas.forEach(function (m) {
      var fila = el('label', 'row sim__fila');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!seleccionSim[m.codigo];
      cb.addEventListener('change', function () {
        if (cb.checked) seleccionSim[m.codigo] = 1; else delete seleccionSim[m.codigo];
        pintarResultadoSim();
      });
      fila.appendChild(cb);

      var id = el('span', 'row__label');
      id.appendChild(el('span', 'sim__nom', m.nombre));
      var meta = el('span', 'sim__meta');
      meta.appendChild(punto(puedeCursar(m) ? 'var(--accent)' : colorDe(estadoDe(m.codigo))));
      meta.appendChild(el('span', null,
        (m.nivel ? 'Nivel ' + m.nivel : 'Electiva') + ' · ' +
        (puedeCursar(m) ? 'podés cursarla' : ETIQUETA[estadoDe(m.codigo)].toLowerCase())));
      id.appendChild(meta);
      fila.appendChild(id);
      lista.appendChild(fila);
    });

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

    var s = C.simular(todas(), datos, datos.ajustes, elegidas, new Date());

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
    var r = C.caminoCritico(OBLIGATORIAS, estadoDe);

    document.getElementById('crit-n').textContent = r.largo || '0';
    document.getElementById('crit-u').textContent =
      r.largo === 1 ? 'cuatrimestre como mínimo' : 'cuatrimestres como mínimo';
    document.getElementById('crit-exp').textContent = r.largo === 0
      ? 'Ya aprobaste todas las materias del plan.'
      : 'Aunque apruebes todo lo demás en paralelo, esta cadena te obliga a cursar ' + r.largo +
        ' cuatrimestres más: cada materia necesita la anterior aprobada.';

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
        meta.appendChild(el('span', null, 'Nivel ' + m.nivel + ' · ' +
          (puedeCursar(m) ? 'podés cursarla ya' : ETIQUETA[estadoDe(m.codigo)].toLowerCase())));
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

    var cursables = todas().filter(puedeCursar);
    if (!cursables.length) {
      cont.appendChild(el('p', 'vacio', 'No hay ninguna materia habilitada con tu estado actual.'));
      document.getElementById('imp-pie').textContent = '';
      return;
    }

    var filas = cursables.map(function (m) {
      var i = C.impacto(m, todas(), estadoDe);
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
    document.getElementById('imp-pie').textContent = conImpacto
      ? 'De las ' + filas.length + ' que podés cursar, ' + conImpacto +
        (conImpacto === 1 ? ' destraba' : ' destraban') + ' algo de inmediato. ' +
        'Las de arriba son las que más te mueven el plan.'
      : 'Ninguna de las que podés cursar destraba otra materia por sí sola: todas las que siguen ' +
        'necesitan más de una correlativa. Mirá la columna «en total» para ver cuál pesa más a futuro.';
  }

  // ------------------------------------------------------------- arranque

  function iniciar() {
    cargar();
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
