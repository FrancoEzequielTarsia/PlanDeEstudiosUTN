/* Plan K23 — copia automatica en un archivo del disco.
 *
 * Usa la File System Access API. El usuario elige UNA VEZ donde guardar (por
 * ejemplo D:\ProyectosPersonales\PlanK23\plan-k23.json) y a partir de ahi la app
 * reescribe ese archivo sola en cada cambio.
 *
 * El permiso de escritura no siempre sobrevive al cierre del navegador: al
 * volver a abrir, el estado puede quedar en "necesita-permiso" y alcanza con un
 * click para reactivarlo. Por eso el handle se guarda en IndexedDB: no hay que
 * volver a elegir el archivo, solo re-autorizarlo.
 *
 * Nada de esto reemplaza a localStorage: es una copia adicional, "por las dudas".
 */
(function () {
  'use strict';

  var BD = 'plank23-disco';
  var ALMACEN = 'handles';
  var CLAVE = 'respaldo';

  var handle = null;
  var estado = 'sin-configurar';   // sin-configurar | activa | necesita-permiso | error
  var detalle = '';
  var alCambiar = function () {};
  var pendiente = null;
  var temporizador = null;

  var soportado = (typeof window.showSaveFilePicker === 'function');

  // --- IndexedDB, lo minimo indispensable -------------------------------

  function abrirBD() {
    return new Promise(function (res, rej) {
      var req = indexedDB.open(BD, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(ALMACEN)) req.result.createObjectStore(ALMACEN);
      };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }

  function guardarHandle(h) {
    return abrirBD().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(ALMACEN, 'readwrite');
        tx.objectStore(ALMACEN).put(h, CLAVE);
        tx.oncomplete = function () { db.close(); res(); };
        tx.onerror = function () { db.close(); rej(tx.error); };
      });
    });
  }

  function leerHandle() {
    return abrirBD().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(ALMACEN, 'readonly');
        var req = tx.objectStore(ALMACEN).get(CLAVE);
        req.onsuccess = function () { db.close(); res(req.result || null); };
        req.onerror = function () { db.close(); rej(req.error); };
      });
    });
  }

  function borrarHandle() {
    return abrirBD().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction(ALMACEN, 'readwrite');
        tx.objectStore(ALMACEN).delete(CLAVE);
        tx.oncomplete = function () { db.close(); res(); };
        tx.onerror = function () { db.close(); res(); };
      });
    });
  }

  // --- estado -----------------------------------------------------------

  function fijar(nuevo, texto) {
    estado = nuevo;
    detalle = texto || '';
    alCambiar(estado, nombre(), detalle);
  }

  function nombre() { return handle ? handle.name : ''; }

  // --- API --------------------------------------------------------------

  function iniciar(callback) {
    alCambiar = callback || function () {};
    if (!soportado) { fijar('sin-soporte'); return Promise.resolve(); }

    return leerHandle().then(function (h) {
      if (!h) { fijar('sin-configurar'); return; }
      handle = h;
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
        fijar(p === 'granted' ? 'activa' : 'necesita-permiso');
      });
    }).catch(function () { fijar('sin-configurar'); });
  }

  // Requiere gesto del usuario.
  function configurar() {
    if (!soportado) return Promise.resolve(false);
    return window.showSaveFilePicker({
      suggestedName: 'plan-k23.json',
      types: [{ description: 'Respaldo de Plan K23', accept: { 'application/json': ['.json'] } }]
    }).then(function (h) {
      handle = h;
      return guardarHandle(h).then(function () {
        fijar('activa');
        return true;
      });
    }).catch(function (e) {
      // Cancelar el dialogo no es un error que valga la pena mostrar.
      if (e && e.name === 'AbortError') return false;
      fijar('error', e && e.message);
      return false;
    });
  }

  // Requiere gesto del usuario.
  function reactivar() {
    if (!handle) return Promise.resolve(false);
    return handle.requestPermission({ mode: 'readwrite' }).then(function (p) {
      fijar(p === 'granted' ? 'activa' : 'necesita-permiso');
      return p === 'granted';
    }).catch(function (e) {
      fijar('error', e && e.message);
      return false;
    });
  }

  function desactivar() {
    handle = null;
    return borrarHandle().then(function () { fijar('sin-configurar'); });
  }

  // Escritura con un respiro: cargar el cuatrimestre son muchos cambios
  // seguidos y no hace falta tocar el disco en cada tecla.
  function escribir(texto) {
    pendiente = texto;
    if (estado !== 'activa') return;
    clearTimeout(temporizador);
    temporizador = setTimeout(volcar, 400);
  }

  function volcar() {
    if (!handle || estado !== 'activa' || pendiente === null) return;
    var texto = pendiente;
    pendiente = null;
    handle.createWritable()
      .then(function (w) {
        return w.write(texto).then(function () { return w.close(); });
      })
      .catch(function (e) {
        if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
          fijar('necesita-permiso');
        } else {
          fijar('error', e && e.message);
        }
      });
  }

  window.Disco = {
    soportado: soportado,
    iniciar: iniciar,
    configurar: configurar,
    reactivar: reactivar,
    desactivar: desactivar,
    escribir: escribir,
    estado: function () { return estado; },
    nombre: nombre,
    detalle: function () { return detalle; }
  };
})();
