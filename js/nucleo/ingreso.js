/* =============================================================
   js/nucleo/ingreso.js - Motor de ingreso y política de eventos (Fase 3)

   Cada mensaje sigue el FLUJO SEGURO del proyecto:
     1. Ingreso        -> receptor en vivo (simulado), archivo importado o simulador
     2. Límite         -> rate limit por origen (control de tormentas)
     3. Normalización  -> NOC.syslog.analizar(): fecha, host, facility, severidad
     4. Validación     -> ¿el origen está en el inventario? (fuentes autorizadas)
     5. Limpieza       -> se enmascaran secretos y se buscan instrucciones escondidas
     6. Deduplicación  -> mensajes idénticos en 60 s se agrupan (repeticiones)
     7. Política       -> severidad 0-2 crea o actualiza un incidente
     8. Evidencia      -> todo queda guardado con fecha, canal y origen

   IMPORTANTE: el texto del log NUNCA se ejecuta ni se usa como orden.
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const D = NOC.datos;
  const S = NOC.seguridad;
  const C = NOC.config;

  /**
   * Valida la fuente (lista de dispositivos autorizados):
   *  - Receptor en vivo: SOLO por IP de origen. Un mensaje que "dice" ser R1-NOC
   *    pero llega desde otra IP se rechaza (protege contra suplantación).
   *  - Archivo importado: no hay IP de red, se identifica por el nombre del equipo.
   */
  function buscarEquipo(ipOrigen, hostname, canal) {
    const equipos = D.tabla("devices");
    if (ipOrigen) return equipos.find((e) => e.ip === ipOrigen) || null;
    if (hostname && ["importacion", "simulador"].includes(canal)) {
      return equipos.find((e) => e.nombre.toLowerCase() === hostname.toLowerCase()) || null;
    }
    return null;
  }

  /** Si ya hay un incidente abierto con el mismo título, solo agrega una nota. */
  function crearOActualizarIncidente(titulo, descripcion, severidad, deviceId, eventId) {
    const abierto = D.tabla("incidents").slice().reverse().find((i) => i.titulo === titulo && i.estado !== "cerrado");
    if (abierto) {
      D.insertar("incident_notes", { incident_id: abierto.id, autor: "sistema", nota: `Nuevo evento relacionado #${eventId}`, creado_en: D.ahora() });
      abierto.actualizado_en = D.ahora();
      return abierto.id;
    }
    const inc = D.insertar("incidents", {
      titulo: titulo.slice(0, 200), descripcion: descripcion.slice(0, 1000), severidad, estado: "abierto",
      responsable: null, device_id: deviceId, event_id: eventId, sla_minutos: C.SLA_POR_SEVERIDAD[severidad] ?? null,
      creado_por: "sistema", creado_en: D.ahora(), actualizado_en: D.ahora(), cerrado_en: null, causa: null, solucion: null,
    });
    S.registrarAuditoria("sistema", "crear_incidente_automatico", "incidents", inc.id, `Política: severidad ${severidad} desde evento #${eventId}`);
    return inc.id;
  }

  /** Retención: si hay demasiados eventos, se eliminan los más antiguos. */
  function aplicarRetencion() {
    const ev = D.tabla("events");
    if (ev.length > C.MAX_EVENTOS) ev.splice(0, ev.length - C.MAX_EVENTOS);
  }

  /** Procesa una línea Syslog. Devuelve un objeto con el resultado. */
  function ingresar(raw, ipOrigen = null, canal = "importacion", origenDato = "SIMULADO") {
    const recibido = D.ahora();
    const datos = NOC.syslog.analizar(raw, recibido);

    // 2) Control de tormentas
    const clave = ipOrigen || `${canal}:${datos.hostname || "?"}`;
    if (!S.limitador.permitir(clave, C.LIMITE_POR_MINUTO)) {
      if (S.limitador.debeAvisar(clave)) {
        S.registrarEventoSeguridad("rate_limit", `Tormenta de eventos: ${clave} superó ${C.LIMITE_POR_MINUTO} mensajes/min. ` +
          "Los excedentes se descartan durante el minuto.", ipOrigen);
      }
      return { estado: "descartado_rate_limit" };
    }

    // 4) Validación de la fuente
    const equipo = buscarEquipo(ipOrigen, datos.hostname, canal);
    const motivos = [];
    if (!equipo) {
      motivos.push("origen no autorizado (no está en el inventario)");
      S.registrarEventoSeguridad("origen_no_autorizado", `host=${datos.hostname} ip=${ipOrigen} canal=${canal}`, ipOrigen);
    }

    // 5) Limpieza: secretos e instrucciones escondidas
    const mensaje = S.enmascararSecretos(datos.mensaje);
    if (mensaje !== datos.mensaje) motivos.push("se enmascaró un posible secreto");
    const inyeccion = S.detectarInyeccion(mensaje);
    if (inyeccion.length) {
      motivos.push("posible inyección de instrucciones: " + inyeccion.join(", "));
      S.registrarEventoSeguridad("posible_inyeccion", `host=${datos.hostname} motivos=${inyeccion.join(", ")}`, ipOrigen);
    }
    motivos.push(...datos.advertencias);

    const marca = equipo ? equipo.marca : datos.marca_detectada;
    const deviceId = equipo ? equipo.id : null;
    const hostname = equipo ? equipo.nombre : datos.hostname;

    // 6) Deduplicación
    const limite = Date.now() - C.VENTANA_DEDUP_SEGUNDOS * 1000;
    const eventos = D.tabla("events");
    for (let i = eventos.length - 1; i >= Math.max(0, eventos.length - 500); i--) {   // revisa los 500 más recientes
      const e = eventos[i];
      if (D.aFecha(e.ultima_vez).getTime() < limite) continue;
      if (e.device_id === deviceId && (e.hostname || "") === (hostname || "") && e.severidad === datos.severidad && e.mensaje === mensaje) {
        e.repeticiones += 1;
        e.ultima_vez = recibido;
        if (equipo) equipo.ultimo_evento = recibido;
        return { estado: "duplicado_agrupado", event_id: e.id };
      }
    }

    // 8) Guardar el evento
    const ev = D.insertar("events", {
      recibido_en: recibido, fecha_evento: datos.fecha_evento, ultima_vez: recibido, repeticiones: 1,
      device_id: deviceId, ip_origen: ipOrigen, hostname, marca, facility: datos.facility, facility_nombre: datos.facility_nombre,
      severidad: datos.severidad, severidad_nombre: datos.severidad_nombre, mensaje,
      raw: S.enmascararSecretos(String(raw).trim()).slice(0, NOC.syslog.LONGITUD_MAXIMA),
      formato: datos.formato, canal, autorizado: equipo ? 1 : 0, sospechoso: inyeccion.length ? 1 : 0,
      motivo_alerta: motivos.join("; ") || null, origen_dato: origenDato,
    });
    if (equipo) equipo.ultimo_evento = recibido;
    aplicarRetencion();

    // 7) Política: severidades críticas generan incidente (solo fuentes autorizadas)
    let incidenteId = null;
    if (equipo && datos.severidad <= C.INCIDENTE_HASTA_SEVERIDAD) {
      incidenteId = crearOActualizarIncidente(`[${datos.severidad_nombre}] ${hostname}: ${mensaje.slice(0, 80)}`,
        mensaje, datos.severidad, deviceId, ev.id);
    }
    if (inyeccion.length) {
      // Incidente de SEGURIDAD: el NOC jamás ejecuta lo que el log "pide".
      incidenteId = crearOActualizarIncidente(`[Seguridad] Contenido sospechoso en log de ${hostname || ipOrigen}`,
        "El mensaje contiene texto con forma de instrucción. Se trató como DATO, no se ejecutó nada. " +
        "Revisar el origen y el equipo. Motivos: " + inyeccion.join(", "), 2, deviceId, ev.id);
    }

    return { estado: "guardado", event_id: ev.id, severidad: datos.severidad, autorizado: !!equipo,
      sospechoso: inyeccion.length > 0, incidente_id: incidenteId };
  }

  NOC.ingreso = { ingresar, crearOActualizarIncidente };
})(window.NOC);
