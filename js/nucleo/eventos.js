/* =============================================================
   js/nucleo/eventos.js - Eventos Syslog: recepción, importación, filtros (Fase 3, RF-02)

   Rutas de la API interna:
     GET  /api/events               -> lista con filtros (HU-02)
          ?desde=AAAA-MM-DD &hasta=AAAA-MM-DD &marca=Cisco &device_id=1
          &sev_min=0 &sev_max=3 &texto=down &solo_sospechosos=1 &limite=300
     POST /api/events/receive       -> recibe UN mensaje "por la red" (receptor en vivo)
     POST /api/events/import        -> importa el texto de un archivo .log/.txt
     POST /api/events/import-sample -> importa el archivo de ejemplo (SIMULADO)
     POST /api/events/simulate      -> genera un evento SIMULADO para un equipo
     GET  /api/events/severities    -> tabla de severidades 0-7
     GET  /api/events/security      -> detecciones de seguridad

   Nota: un navegador no puede abrir un puerto UDP 514. Por eso la
   recepción "en vivo" es un receptor SIMULADO que entrega mensajes con
   la IP de origen de cada equipo, y la importación de archivos permite
   cargar logs reales exportados de un colector (rsyslog, etc.).
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const D = NOC.datos;
  const S = NOC.seguridad;
  const C = NOC.config;

  // Mensajes de ejemplo por severidad (todos marcados como SIMULADO)
  const TEXTOS = [
    ["SYS", "PLATFORM_FAIL", "Falla total de la plataforma, el equipo dejó de operar"],
    ["ENVMON", "TEMP_CRIT", "Temperatura crítica en el chasis, actuar de inmediato"],
    ["PLATFORM", "PS_FAIL", "Fuente de poder 1 falló"],
    ["LINK", "UPDOWN", "Interface GigabitEthernet0/1, changed state to down"],
    ["SYS", "CPUHOG", "Uso de CPU superior al 85 por ciento"],
    ["SYS", "CONFIG_I", "Configured from console by admin on vty0"],
    ["SEC_LOGIN", "LOGIN_SUCCESS", "Login Success [user: admin] [Source: 198.51.100.50]"],
    ["DEBUG", "PKT", "Depuración: paquete procesado en cola de salida"],
  ];
  const NIVEL_FORTI = ["emergency", "alert", "critical", "error", "warning", "notice", "information", "debug"];
  const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /** Construye un mensaje Syslog con la forma típica de cada fabricante. */
  function mensajeSimulado(marca, hostname, severidad, texto) {
    const d = new Date();
    const dos = (n) => String(n).padStart(2, "0");
    const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
    const pri = 23 * 8 + severidad;   // facility local7 (23)
    const [modulo, mnemonico, base] = TEXTOS[severidad];
    const msg = texto || base;
    if (marca === "Fortinet") {
      return `<${pri}>date=${D.ahora(d).slice(0, 10)} time=${hora} devname="${hostname}" devid="FGT60F-SIMULADO" ` +
        `logid="0100032001" type="event" subtype="system" level="${NIVEL_FORTI[severidad]}" msg="${msg} (SIMULADO)"`;
    }
    if (marca === "Huawei") {
      return `<${pri}>${MESES[d.getMonth()]} ${dos(d.getDate())} ${d.getFullYear()} ${hora} ${hostname} ` +
        `%%01${modulo}/${severidad}/${mnemonico}(l):${msg} (SIMULADO)`;
    }
    return `<${pri}>${MESES[d.getMonth()]} ${dos(d.getDate())} ${hora} ${hostname} %${modulo}-${severidad}-${mnemonico}: ${msg} (SIMULADO)`;
  }

  function conEquipo(e) {
    const eq = e.device_id ? D.buscar("devices", e.device_id) : null;
    return Object.assign({}, e, { equipo: eq ? eq.nombre : null });
  }

  /** Filtros de eventos. */
  function filtrar(q) {
    const num = (v) => (v === undefined || v === "" ? null : Number(v));
    const sevMin = num(q.sev_min), sevMax = num(q.sev_max), dev = num(q.device_id);
    const texto = (q.texto || "").toLowerCase();
    return D.tabla("events").filter((e) => {
      const fecha = e.fecha_evento.slice(0, 10);
      if (q.desde && fecha < q.desde) return false;
      if (q.hasta && fecha > q.hasta) return false;
      if (q.marca && e.marca !== q.marca) return false;
      if (dev !== null && e.device_id !== dev) return false;
      if (sevMin !== null && e.severidad < sevMin) return false;
      if (sevMax !== null && e.severidad > sevMax) return false;
      if (texto && !(e.mensaje.toLowerCase().includes(texto) || (e.hostname || "").toLowerCase().includes(texto))) return false;
      if ((q.solo_sospechosos === "1" || q.solo_sospechosos === "true") && !(e.sospechoso || !e.autorizado)) return false;
      return true;
    });
  }

  NOC.ruta("GET", "/api/events/severities", null, () =>
    NOC.syslog.SEVERIDADES.map(([nombre, clave, significado], nivel) => ({ nivel, nombre, palabra_clave: clave, significado })));

  NOC.ruta("GET", "/api/events", null, ({ query }) => {
    const lista = filtrar(query).sort((a, b) => (b.fecha_evento.localeCompare(a.fecha_evento)) || b.id - a.id);
    const limite = Math.max(1, Math.min(Number(query.limite) || 300, 2000));
    return { total: lista.length, mostrados: Math.min(limite, lista.length), eventos: lista.slice(0, limite).map(conEquipo) };
  });

  NOC.ruta("POST", "/api/events/receive", ["operador", "administrador"], ({ cuerpo }) =>
    NOC.ingreso.ingresar(String(cuerpo.raw || ""), cuerpo.ip_origen || null, "receptor"));

  function importarLineas(lineas, origen, usuario) {
    const r = { leidas: 0, guardadas: 0, agrupadas: 0, descartadas: 0, no_autorizadas: 0, sospechosas: 0, incidentes: 0 };
    lineas.slice(0, C.MAX_LINEAS_IMPORTACION).forEach((linea) => {
      if (!linea.trim() || linea.trim().startsWith("#")) return;   // # = comentario del archivo
      r.leidas += 1;
      const x = NOC.ingreso.ingresar(linea, null, "importacion");
      if (x.estado === "guardado") {
        r.guardadas += 1;
        if (!x.autorizado) r.no_autorizadas += 1;
        if (x.sospechoso) r.sospechosas += 1;
        if (x.incidente_id) r.incidentes += 1;
      } else if (x.estado === "duplicado_agrupado") r.agrupadas += 1;
      else r.descartadas += 1;
    });
    if (lineas.length > C.MAX_LINEAS_IMPORTACION) r.aviso = `Solo se procesaron las primeras ${C.MAX_LINEAS_IMPORTACION} líneas.`;
    S.registrarAuditoria(usuario, "importar_syslog", "events", null, `origen=${origen} ${JSON.stringify(r)}`);
    return r;
  }

  NOC.ruta("POST", "/api/events/import", ["operador", "administrador"], ({ cuerpo, usuario }) => {
    const nombre = String(cuerpo.nombre || "");
    if (!/\.(log|txt)$/i.test(nombre)) throw new NOC.ErrorNOC(400, "Solo se aceptan archivos .log o .txt");
    const texto = String(cuerpo.texto || "");
    if (texto.length > C.MAX_BYTES_ARCHIVO) throw new NOC.ErrorNOC(413, "Archivo demasiado grande (máximo 1 MB)");
    return importarLineas(texto.split(/\r?\n/), S.limpiar(nombre, 100), usuario);
  });

  NOC.ruta("POST", "/api/events/import-sample", ["operador", "administrador"], ({ usuario }) => {
    if (!NOC.EJEMPLO_SYSLOG) throw new NOC.ErrorNOC(404, "No se encontró data/ejemplo.js");
    return importarLineas(NOC.EJEMPLO_SYSLOG.split(/\r?\n/), "syslog_simulado.log", usuario);
  });

  NOC.ruta("POST", "/api/events/simulate", ["operador", "administrador"], ({ cuerpo }) => {
    const severidad = Number(cuerpo.severidad);
    if (!Number.isInteger(severidad) || severidad < 0 || severidad > 7) throw new NOC.ErrorNOC(400, "La severidad debe estar entre 0 y 7");
    const equipo = D.buscar("devices", cuerpo.device_id);
    if (!equipo) throw new NOC.ErrorNOC(404, "Equipo no encontrado");
    const linea = mensajeSimulado(equipo.marca, equipo.nombre, severidad);
    const r = NOC.ingreso.ingresar(linea, equipo.ip, "simulador");
    r.mensaje_generado = linea;
    return r;
  });

  NOC.ruta("GET", "/api/events/security", null, () => D.tabla("security_events").slice().reverse().slice(0, 200));

  NOC.eventos = { mensajeSimulado, filtrar };
})(window.NOC);
