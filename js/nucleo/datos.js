/* =============================================================
   js/nucleo/datos.js - Base de datos del NOC (Fase 1)

   Los datos se guardan en el navegador con localStorage (un pequeño
   almacén de texto que cada navegador tiene por página). Cada "tabla"
   es una lista de objetos, igual que las filas de una base de datos.

   Tablas (modelo de datos):
     devices          -> inventario de equipos de red
     events           -> mensajes Syslog recibidos o importados
     incidents        -> incidentes creados a partir de eventos
     incident_notes   -> seguimiento (bitácora) de cada incidente
     command_audit    -> comandos de consola y propuestas de cambio
     security_events  -> detecciones de seguridad
     audit_trail      -> auditoría encadenada con hash (quién, qué, cuándo)

   Limitación: los datos viven solo en ESTE navegador de ESTE equipo.
   Por eso existe "Exportar respaldo" (archivo .json) y "Restaurar".
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";

  const CLAVE = "noc-syslog-inteligente-v1";
  const TABLAS = ["devices", "events", "incidents", "incident_notes", "command_audit", "security_events", "audit_trail"];

  // Equipos de ejemplo. IPs de DOCUMENTACIÓN (RFC 5737): no son reales.
  const EQUIPOS_SIMULADOS = [
    ["R1-NOC", "192.0.2.11", "Cisco", "ISR 4331", "IOS XE 17.9", "Sala de equipos - Rack 1", "operativo"],
    ["SW-ACCESO-01", "192.0.2.12", "Cisco", "Catalyst 2960-X", "IOS 15.2", "Piso 2 - Gabinete A", "mantenimiento"],
    ["FW-EDGE", "192.0.2.21", "Fortinet", "FortiGate 60F", "FortiOS 7.2", "Borde de Internet", "operativo"],
    ["SW-CORE", "192.0.2.31", "Huawei", "S5735-L", "VRP V200R021", "Sala de equipos - Rack 2", "operativo"],
  ];

  let db = null;
  let persistir = true;   // en las pruebas se trabaja solo en memoria

  /** Fecha y hora local en formato ordenable: 2026-10-16 18:30:00 */
  function ahora(fecha) {
    const d = fecha || new Date();
    const dos = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
  }

  /** Convierte '2026-10-16 18:30:00' en un objeto Date. */
  function aFecha(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(texto || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  }

  function baseVacia() {
    const nueva = { version: 1, seq: {} };
    TABLAS.forEach((t) => { nueva[t] = []; nueva.seq[t] = 0; });
    return nueva;
  }

  function sembrar() {
    EQUIPOS_SIMULADOS.forEach(([nombre, ip, marca, modelo, version, ubicacion, estado]) =>
      insertar("devices", { nombre, ip, marca, modelo, version, ubicacion, estado,
        origen_dato: "SIMULADO", ultimo_evento: null, ultima_actualizacion: ahora() }));
  }

  /** Abre la base: la lee del navegador o la crea con los equipos simulados. */
  function iniciar() {
    if (db) return db;
    let texto = null;
    if (persistir) {
      try { texto = localStorage.getItem(CLAVE); } catch (_) { texto = null; }
    }
    try { db = texto ? JSON.parse(texto) : null; } catch (_) { db = null; }
    if (!db || db.version !== 1 || !TABLAS.every((t) => Array.isArray(db[t]))) {
      db = baseVacia();
      sembrar();
      guardar();
    }
    return db;
  }

  /** Guarda en el navegador. Si no se puede (modo privado), sigue en memoria. */
  function guardar() {
    if (!persistir || !db) return;
    try { localStorage.setItem(CLAVE, JSON.stringify(db)); }
    catch (e) { console.warn("No se pudo guardar en el navegador:", e.message); }
  }

  function tabla(nombre) { return iniciar()[nombre]; }

  function insertar(nombre, fila) {
    const base = db || iniciar();
    base.seq[nombre] += 1;
    const nueva = Object.assign({ id: base.seq[nombre] }, fila);
    base[nombre].push(nueva);
    return nueva;
  }

  function buscar(nombre, id) {
    return tabla(nombre).find((f) => f.id === Number(id)) || null;
  }

  function eliminar(nombre, id) {
    const lista = tabla(nombre);
    const i = lista.findIndex((f) => f.id === Number(id));
    if (i >= 0) lista.splice(i, 1);
  }

  /** Borra todo y vuelve a cargar los equipos simulados. */
  function reiniciar() {
    db = baseVacia();
    sembrar();
    guardar();
  }

  /** Respaldo: devuelve todo como texto JSON. */
  function exportar() {
    return JSON.stringify(iniciar(), null, 2);
  }

  /** Restaura un respaldo. Valida la estructura antes de reemplazar. */
  function restaurar(texto) {
    const nuevo = JSON.parse(texto);
    if (!nuevo || nuevo.version !== 1 || !TABLAS.every((t) => Array.isArray(nuevo[t]))) {
      throw new Error("El archivo no es un respaldo válido del NOC.");
    }
    db = nuevo;
    guardar();
  }

  /** Modo prueba: base nueva en memoria que no toca los datos reales. */
  function modoPrueba() {
    persistir = false;
    db = baseVacia();
    sembrar();
  }

  NOC.datos = { ahora, aFecha, iniciar, guardar, tabla, insertar, buscar, eliminar, reiniciar,
    exportar, restaurar, modoPrueba, TABLAS };
})(window.NOC);
