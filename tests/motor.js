/* =============================================================
   tests/motor.js - Pequeño motor de pruebas automáticas (Fase 2)

   Cada prueba usa una base de datos NUEVA en memoria, así nunca se
   dañan los datos reales guardados en el navegador.
   Se ejecutan abriendo pruebas.html.
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const grupos = [];

  /** Registra un grupo de pruebas. 'requiere' = módulo que debe existir. */
  function grupo(nombre, fase, requiere, pruebas) { grupos.push({ nombre, fase, requiere, pruebas }); }

  function esperar(condicion, mensaje) { if (!condicion) throw new Error(mensaje || "La condición no se cumplió"); }

  /** Comprueba que una función falle con el código indicado (400, 403, 404, 409). */
  function esperarError(funcion, estado) {
    try { funcion(); } catch (e) {
      if (estado && e.estado !== estado) throw new Error(`Se esperaba error ${estado} y llegó ${e.estado}: ${e.message}`);
      return e;
    }
    throw new Error(`Se esperaba un error ${estado || ""} y no ocurrió`);
  }

  const como = (rol, usuario) => NOC.fijarSesion(usuario || `${rol}.pruebas`, rol);

  /** Ejecuta todo y devuelve los resultados. */
  function ejecutar() {
    const resultados = [];
    for (const g of grupos) {
      const disponible = g.requiere.every((m) => NOC[m]);
      for (const [titulo, funcion] of g.pruebas) {
        if (!disponible) { resultados.push({ grupo: g.nombre, fase: g.fase, titulo, estado: "omitida", detalle: `Requiere la Fase ${g.fase}` }); continue; }
        NOC.datos.modoPrueba();
        if (NOC.seguridad) NOC.seguridad.limitador.reiniciar();
        como("administrador", "admin.pruebas");
        try { funcion(); resultados.push({ grupo: g.nombre, fase: g.fase, titulo, estado: "ok", detalle: "" }); }
        catch (e) { resultados.push({ grupo: g.nombre, fase: g.fase, titulo, estado: "falla", detalle: e.message }); }
      }
    }
    return resultados;
  }

  NOC.pruebas = { grupo, esperar, esperarError, como, ejecutar };
})(window.NOC);
