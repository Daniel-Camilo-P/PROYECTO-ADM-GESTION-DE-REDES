/* =============================================================
   js/nucleo/incidentes.js - Gestión de incidentes y tablero (Fase 4, RF-04, RF-05, HU-03)

   Ciclo de vida:  abierto -> asignado -> en_progreso -> resuelto -> cerrado
     - Para CERRAR es obligatorio escribir la causa y la solución.
     - Un incidente cerrado ya no se puede modificar (queda como evidencia).
     - Cada cambio queda en la bitácora del incidente y en la auditoría.

   Rutas de la API interna:
     GET  /api/incidents              -> lista (?estado=activos | abierto | ... )
     POST /api/incidents              -> crea manualmente (opcional: event_id)
     GET  /api/incidents/:id          -> detalle con bitácora
     PUT  /api/incidents/:id          -> asignar responsable / cambiar estado
     POST /api/incidents/:id/notes    -> nota de seguimiento
     POST /api/incidents/:id/close    -> cierre con causa y solución
     GET  /api/dashboard              -> resumen para el tablero
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const D = NOC.datos;
  const S = NOC.seguridad;
  const C = NOC.config;
  const ESTADOS = ["abierto", "asignado", "en_progreso", "resuelto", "cerrado"];

  function nombreEquipo(id) { const e = id ? D.buscar("devices", id) : null; return e ? e.nombre : null; }

  function detalle(inc) {
    const d = Object.assign({}, inc, { equipo: nombreEquipo(inc.device_id) });
    d.notas = D.tabla("incident_notes").filter((n) => n.incident_id === inc.id);
    const ev = inc.event_id ? D.buscar("events", inc.event_id) : null;
    d.evento = ev ? { id: ev.id, fecha_evento: ev.fecha_evento, severidad: ev.severidad, mensaje: ev.mensaje, hostname: ev.hostname } : null;
    return d;
  }

  function obtener(id) {
    const inc = D.buscar("incidents", id);
    if (!inc) throw new NOC.ErrorNOC(404, "Incidente no encontrado");
    return inc;
  }

  function nota(incidentId, autor, texto) {
    D.insertar("incident_notes", { incident_id: incidentId, autor, nota: S.limpiar(texto, 1000), creado_en: D.ahora() });
  }

  NOC.ruta("GET", "/api/incidents", null, ({ query }) => {
    let lista = D.tabla("incidents").slice();
    if (ESTADOS.includes(query.estado)) lista = lista.filter((i) => i.estado === query.estado);
    if (query.estado === "activos") {
      lista = lista.filter((i) => i.estado !== "cerrado").sort((a, b) => a.severidad - b.severidad || b.id - a.id);
    } else lista.sort((a, b) => b.id - a.id);
    return lista.map((i) => Object.assign({}, i, { equipo: nombreEquipo(i.device_id) }));
  });

  NOC.ruta("GET", "/api/incidents/:id", null, ({ params }) => detalle(obtener(params.id)));

  NOC.ruta("POST", "/api/incidents", ["operador", "administrador"], ({ cuerpo, usuario }) => {
    let evento = null;
    if (cuerpo.event_id) {
      evento = D.buscar("events", cuerpo.event_id);
      if (!evento) throw new NOC.ErrorNOC(400, "El evento indicado no existe.");
    }
    const titulo = S.limpiar(cuerpo.titulo || (evento ? `[${evento.severidad_nombre}] ${evento.hostname}: ${evento.mensaje.slice(0, 80)}` : ""), 200);
    if (!titulo) throw new NOC.ErrorNOC(400, "El título es obligatorio.");
    const severidad = Number(cuerpo.severidad ?? (evento ? evento.severidad : 3));
    if (!Number.isInteger(severidad) || severidad < 0 || severidad > 7) throw new NOC.ErrorNOC(400, "La severidad debe estar entre 0 y 7.");
    const responsable = S.limpiar(cuerpo.responsable, 60) || null;
    const inc = D.insertar("incidents", {
      titulo, descripcion: S.limpiar(cuerpo.descripcion || (evento ? evento.mensaje : ""), 1000), severidad,
      estado: responsable ? "asignado" : "abierto", responsable,
      device_id: cuerpo.device_id ? Number(cuerpo.device_id) : (evento ? evento.device_id : null),
      event_id: evento ? evento.id : null, sla_minutos: C.SLA_POR_SEVERIDAD[severidad] ?? null,
      creado_por: usuario, creado_en: D.ahora(), actualizado_en: D.ahora(), cerrado_en: null, causa: null, solucion: null,
    });
    nota(inc.id, usuario, "Incidente creado manualmente" + (evento ? ` desde el evento #${evento.id}` : ""));
    S.registrarAuditoria(usuario, "crear_incidente", "incidents", inc.id, titulo);
    return detalle(inc);
  });

  NOC.ruta("PUT", "/api/incidents/:id", ["operador", "administrador"], ({ params, cuerpo, usuario }) => {
    const inc = obtener(params.id);
    if (inc.estado === "cerrado") throw new NOC.ErrorNOC(409, "El incidente está cerrado y no se puede modificar.");
    const cambios = {};
    if ("responsable" in cuerpo) cambios.responsable = S.limpiar(cuerpo.responsable, 60) || null;
    if ("estado" in cuerpo) {
      if (!ESTADOS.includes(cuerpo.estado)) throw new NOC.ErrorNOC(400, `Estado inválido. Opciones: ${ESTADOS.join(", ")}`);
      if (cuerpo.estado === "cerrado") throw new NOC.ErrorNOC(400, "Para cerrar use la opción Cerrar (exige causa y solución).");
      cambios.estado = cuerpo.estado;
    }
    if (cambios.responsable && inc.estado === "abierto" && !("estado" in cambios)) cambios.estado = "asignado";
    const reales = Object.entries(cambios).filter(([k, v]) => inc[k] !== v);
    if (!reales.length) throw new NOC.ErrorNOC(400, "No hay cambios.");
    const texto = reales.map(([k, v]) => `${k}: '${inc[k] || "-"}' -> '${v || "-"}'`).join("; ");
    reales.forEach(([k, v]) => { inc[k] = v; });
    inc.actualizado_en = D.ahora();
    nota(inc.id, usuario, texto);
    S.registrarAuditoria(usuario, "actualizar_incidente", "incidents", inc.id, texto);
    return detalle(inc);
  });

  NOC.ruta("POST", "/api/incidents/:id/notes", ["operador", "administrador"], ({ params, cuerpo, usuario }) => {
    const inc = obtener(params.id);
    if (inc.estado === "cerrado") throw new NOC.ErrorNOC(409, "El incidente está cerrado.");
    const texto = S.limpiar(cuerpo.nota, 1000);
    if (!texto) throw new NOC.ErrorNOC(400, "Escriba la nota.");
    nota(inc.id, usuario, texto);
    inc.actualizado_en = D.ahora();
    return detalle(inc);
  });

  NOC.ruta("POST", "/api/incidents/:id/close", ["operador", "administrador"], ({ params, cuerpo, usuario }) => {
    const inc = obtener(params.id);
    if (inc.estado === "cerrado") throw new NOC.ErrorNOC(409, "El incidente ya estaba cerrado.");
    const causa = S.limpiar(cuerpo.causa, 500);
    const solucion = S.limpiar(cuerpo.solucion, 500);
    if (!causa || !solucion) throw new NOC.ErrorNOC(400, "Para cerrar escriba la causa y la solución.");
    Object.assign(inc, { estado: "cerrado", causa, solucion, cerrado_en: D.ahora(), actualizado_en: D.ahora(),
      responsable: inc.responsable || usuario });
    nota(inc.id, usuario, `Cerrado. Causa: ${causa}. Solución: ${solucion}`);
    S.registrarAuditoria(usuario, "cerrar_incidente", "incidents", inc.id, causa);
    return detalle(inc);
  });

  // ---------------- Tablero ----------------
  NOC.ruta("GET", "/api/dashboard", null, () => {
    const hace24h = D.ahora(new Date(Date.now() - 24 * 3600 * 1000));
    const equipos = D.tabla("devices").slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(NOC.inventario.serializar);
    const recientes24 = D.tabla("events").filter((e) => e.recibido_en >= hace24h);
    const porSeveridad = {};
    for (let n = 0; n < 8; n++) porSeveridad[n] = 0;
    recientes24.forEach((e) => { porSeveridad[e.severidad] += 1; });
    const suma = (max) => Object.entries(porSeveridad).filter(([k]) => Number(k) <= max).reduce((a, [, v]) => a + v, 0);
    const conEquipo = (e) => Object.assign({}, e, { equipo: nombreEquipo(e.device_id) });
    const eventosDesc = D.tabla("events").slice().reverse();
    const abiertos = D.tabla("incidents").filter((i) => i.estado !== "cerrado");
    return {
      contadores: {
        equipos: equipos.length,
        sin_comunicacion: equipos.filter((e) => ["sin comunicación", "sin eventos"].includes(e.comunicacion)).length,
        eventos_24h: recientes24.length,
        criticos_24h: suma(C.INCIDENTE_HASTA_SEVERIDAD),
        alertas_24h: suma(C.ALERTA_HASTA_SEVERIDAD),
        incidentes_abiertos: abiertos.length,
        seguridad_24h: D.tabla("security_events").filter((s) => s.fecha >= hace24h).length,
        pendientes_aprobacion: D.tabla("command_audit").filter((c) => ["pendiente", "aprobado"].includes(c.decision)).length,
      },
      por_severidad: porSeveridad,
      equipos,
      eventos_recientes: eventosDesc.slice(0, 10).map(conEquipo),
      eventos_criticos: eventosDesc.filter((e) => e.severidad <= C.ALERTA_HASTA_SEVERIDAD).slice(0, 10).map(conEquipo),
      incidentes_abiertos: abiertos.slice().sort((a, b) => a.severidad - b.severidad || b.id - a.id).slice(0, 10)
        .map((i) => Object.assign({}, i, { equipo: nombreEquipo(i.device_id) })),
      politica: { incidente_hasta_severidad: C.INCIDENTE_HASTA_SEVERIDAD, alerta_hasta_severidad: C.ALERTA_HASTA_SEVERIDAD },
      generado_en: D.ahora(),
    };
  });

  NOC.incidentes = { ESTADOS };
})(window.NOC);
