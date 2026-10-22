/* =============================================================
   js/nucleo/acciones.js - Aprobación humana y auditoría (Fase 6, RF-08, HU-05)

   FLUJO SEGURO OBLIGATORIO del curso:
     evento detectado -> validación -> PROPUESTA -> REVISIÓN humana
     -> APROBACIÓN -> EJECUCIÓN autorizada -> VERIFICACIÓN -> AUDITORÍA

   Reglas:
     - Solo un ADMINISTRADOR aprueba o rechaza.
     - Quien propone NO puede aprobar su propia propuesta (separación de funciones).
     - Sin aprobación no hay ejecución. En el MVP la ejecución es SIMULADA:
       no existe ninguna conexión SSH (llega en el Corte 3 con un backend).
     - Cada paso deja una línea en la auditoría encadenada con hash.

     GET  /api/actions                 -> comandos y propuestas (?tipo=propuesta)
     POST /api/actions/:id/approve     -> aprobar  (administrador)
     POST /api/actions/:id/reject      -> rechazar (administrador)
     POST /api/actions/:id/execute     -> ejecutar SIMULADO (solo si está aprobada)
     POST /api/actions/:id/verify      -> marcar verificada
     GET  /api/actions/audit           -> auditoría completa
     GET  /api/actions/audit/verify    -> comprueba la integridad
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const D = NOC.datos;
  const S = NOC.seguridad;

  function propuesta(id) {
    const a = D.buscar("command_audit", id);
    if (!a || a.tipo !== "propuesta") throw new NOC.ErrorNOC(404, "Propuesta no encontrada");
    return a;
  }

  function cambiar(a, usuario, nueva, detalle, extra = {}) {
    Object.assign(a, extra, { decision: nueva });
    S.registrarAuditoria(usuario, `accion_${nueva}`, "command_audit", a.id, detalle);
    return Object.assign({}, a);
  }

  function conEquipo(c) {
    const e = c.device_id ? D.buscar("devices", c.device_id) : null;
    return Object.assign({}, c, { equipo: e ? e.nombre : null });
  }

  NOC.ruta("GET", "/api/actions", null, ({ query }) => {
    let lista = D.tabla("command_audit").slice().reverse();
    if (query.tipo === "propuesta") lista = lista.filter((c) => c.tipo === "propuesta");
    return lista.slice(0, 300).map(conEquipo);
  });

  NOC.ruta("POST", "/api/actions/:id/approve", ["administrador"], ({ params, cuerpo, usuario }) => {
    const a = propuesta(params.id);
    if (a.decision !== "pendiente") throw new NOC.ErrorNOC(409, `Solo se aprueban propuestas pendientes (estado actual: ${a.decision}).`);
    if (a.usuario.toLowerCase() === usuario.toLowerCase()) {
      throw new NOC.ErrorNOC(403, "Separación de funciones: no puede aprobar su propia propuesta.");
    }
    return cambiar(a, usuario, "aprobado", `Aprobado. ${S.limpiar(cuerpo.comentario, 300)}`,
      { aprobado_por: usuario, aprobado_en: D.ahora() });
  });

  NOC.ruta("POST", "/api/actions/:id/reject", ["administrador"], ({ params, cuerpo, usuario }) => {
    const a = propuesta(params.id);
    if (a.decision !== "pendiente") throw new NOC.ErrorNOC(409, "Solo se rechazan propuestas pendientes.");
    const comentario = S.limpiar(cuerpo.comentario, 300);
    return cambiar(a, usuario, "rechazado", `Rechazado. ${comentario}`,
      { aprobado_por: usuario, aprobado_en: D.ahora(), resultado: comentario || null });
  });

  NOC.ruta("POST", "/api/actions/:id/execute", ["operador", "administrador"], ({ params, usuario }) => {
    const a = propuesta(params.id);
    // REGLA MÁS IMPORTANTE: SIN APROBACIÓN NO HAY EJECUCIÓN.
    if (a.decision !== "aprobado") throw new NOC.ErrorNOC(403, "Bloqueado: la propuesta no está aprobada por un humano.");
    const resultado = "EJECUCIÓN SIMULADA: en el MVP no existe conexión SSH. En el Corte 3 un backend ejecutará " +
      "solo en hosts permitidos, con backup previo y registro de salida.";
    return cambiar(a, usuario, "ejecutado_simulado", resultado, { resultado });
  });

  NOC.ruta("POST", "/api/actions/:id/verify", ["operador", "administrador"], ({ params, cuerpo, usuario }) => {
    const a = propuesta(params.id);
    if (a.decision !== "ejecutado_simulado") throw new NOC.ErrorNOC(409, "Solo se verifica una acción ya ejecutada.");
    const nota = S.limpiar(cuerpo.nota, 300) || "Verificado sin novedad";
    return cambiar(a, usuario, "verificado", nota, { resultado: `${a.resultado} | Verificación: ${nota}` });
  });

  NOC.ruta("GET", "/api/actions/audit", null, () => D.tabla("audit_trail").slice().reverse().slice(0, 500));
  NOC.ruta("GET", "/api/actions/audit/verify", null, () => S.verificarAuditoria());

  // Respaldo y restauración (RNF-08 Recuperación)
  NOC.ruta("POST", "/api/backup", ["administrador"], ({ usuario }) => {
    S.registrarAuditoria(usuario, "exportar_respaldo", "sistema", null, "Respaldo JSON descargado");
    return D.exportar();
  });

  NOC.ruta("POST", "/api/restore", ["administrador"], ({ cuerpo, usuario }) => {
    D.restaurar(String(cuerpo.texto || ""));
    S.registrarAuditoria(usuario, "restaurar_respaldo", "sistema", null, S.limpiar(cuerpo.nombre, 100));
    return { mensaje: "Respaldo restaurado" };
  });

  NOC.ruta("POST", "/api/reset", ["administrador"], ({ usuario }) => {
    D.reiniciar();
    S.limitador.reiniciar();
    S.registrarAuditoria(usuario, "reiniciar_datos", "sistema", null, "Datos de prueba reiniciados");
    return { mensaje: "Datos reiniciados" };
  });

  NOC.acciones = { instalado: true };
})(window.NOC);
