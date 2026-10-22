/* =============================================================
   js/nucleo/syslog.js - Lector de mensajes Syslog (Fase 3, RF-03)

   Un mensaje Syslog típico:
     <187>Oct 16 18:00:00 R1-NOC %LINK-3-UPDOWN: Interface Gi0/1, changed state to down

   La parte <187> se llama PRI y esconde dos datos:
     facility  = PRI ÷ 8 (parte entera)  -> 187 ÷ 8 = 23  (local7)
     severidad = residuo de PRI ÷ 8      -> 187 % 8 = 3   (error)

   Formatos que entiende:
     - RFC 3164 (BSD clásico)              - RFC 5424 (moderno, empieza con "1 ")
     - Cisco IOS (%FACILITY-SEV-MNEMONIC)  - Fortinet (campos clave=valor)
     - Huawei VRP (%%01MODULO/SEV/NOMBRE)
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";

  // Severidades según RFC 5424 (0 = más urgente, 7 = depuración)
  const SEVERIDADES = [
    ["Emergencia", "emergency", "El sistema no se puede usar"],
    ["Alerta", "alert", "Se debe actuar de inmediato"],
    ["Crítico", "critical", "Condición crítica (falla de hardware, etc.)"],
    ["Error", "error", "Condición de error"],
    ["Advertencia", "warning", "Condición de advertencia"],
    ["Aviso", "notice", "Normal pero significativo"],
    ["Informativo", "informational", "Mensaje informativo"],
    ["Depuración", "debug", "Mensajes de depuración"],
  ];

  const FACILITIES = ["kern", "user", "mail", "daemon", "auth", "syslog", "lpr", "news", "uucp", "cron",
    "authpriv", "ftp", "ntp", "security", "console", "solaris-cron",
    "local0", "local1", "local2", "local3", "local4", "local5", "local6", "local7"];

  const NIVELES_FORTINET = { emergency: 0, alert: 1, critical: 2, error: 3, warning: 4, notice: 5,
    notification: 5, information: 6, debug: 7 };

  const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const M = MESES.join("|");
  const LONGITUD_MAXIMA = 2048;

  const RE_PRI = /^<(\d{1,3})>/;
  const RE_5424 = /^1\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(-|\[.*?\])\s?([\s\S]*)$/;
  const RE_HUAWEI = new RegExp(`^((?:${M})\\s+\\d{1,2}\\s+\\d{4}\\s+\\d{2}:\\d{2}:\\d{2})(?:\\.\\d+)?(?:\\s+[+-]\\d{2}:\\d{2})?\\s+(\\S+)\\s+([\\s\\S]*)$`);
  const RE_3164 = new RegExp(`^((?:${M})\\s+\\d{1,2}\\s+\\d{2}:\\d{2}:\\d{2})\\s+(\\S+)\\s+([\\s\\S]*)$`);
  const RE_CISCO_NATIVO = new RegExp(`^(?:\\d+:\\s*)?(?:([A-Za-z0-9._-]+):\\s*)?[*.]?((?:${M})\\s+\\d{1,2}\\s+(?:\\d{4}\\s+)?\\d{2}:\\d{2}:\\d{2})(?:\\.\\d+)?(?:\\s+[A-Z]{2,5})?:\\s*(%[\\s\\S]*)$`);
  const RE_KV = /(\w+)=("([^"]*)"|\S+)/g;
  const RE_MNEMONICO_CISCO = /%([A-Z0-9_]+)-([0-7])-([A-Z0-9_]+)/;
  const RE_MNEMONICO_HUAWEI = /%%\d{2}([A-Z0-9_]+)\/([0-7])\/([A-Z0-9_]+)/;

  const nombreSeveridad = (n) => (SEVERIDADES[n] || ["Desconocida"])[0];

  /** Convierte la fecha del mensaje a 'AAAA-MM-DD HH:MM:SS'. Si falla, usa la de recepción. */
  function convertirFecha(texto, recibido) {
    if (!texto || texto === "-") return recibido;
    const t = texto.trim().replace(/\s+/g, " ");
    let m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(t);     // ISO
    if (m) return `${m[1]} ${m[2]}`;
    m = /^([A-Z][a-z]{2}) (\d{1,2})(?: (\d{4}))? (\d{2}:\d{2}:\d{2})$/.exec(t);  // Oct 16 [2026] 18:00:00
    if (m && MESES.includes(m[1])) {
      const anio = m[3] || recibido.slice(0, 4);   // RFC 3164 no trae año: se usa el actual
      return `${anio}-${String(MESES.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")} ${m[4]}`;
    }
    return recibido;
  }

  /**
   * Analiza una línea Syslog y devuelve los campos normalizados.
   * Nunca lanza error: lo que no reconoce queda anotado en 'advertencias'.
   */
  function analizar(raw, recibido) {
    recibido = recibido || NOC.datos.ahora();
    const advertencias = [];
    let texto = String(raw || "").replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trim();
    if (texto.length > LONGITUD_MAXIMA) { texto = texto.slice(0, LONGITUD_MAXIMA); advertencias.push("mensaje recortado por longitud"); }

    const r = { fecha_evento: recibido, hostname: null, facility: null, facility_nombre: null, severidad: null,
      mensaje: texto, marca_detectada: null, formato: "desconocido", advertencias };

    // 1) PRI -> facility y severidad
    let resto = texto;
    let m = RE_PRI.exec(texto);
    if (m && Number(m[1]) <= 191) {
      const pri = Number(m[1]);
      r.facility = Math.floor(pri / 8);
      r.facility_nombre = FACILITIES[r.facility];
      r.severidad = pri % 8;
      resto = texto.slice(m[0].length).trimStart();
    } else {
      advertencias.push("sin PRI válido");
    }

    // 2) Formato del encabezado
    if ((m = RE_5424.exec(resto))) {
      Object.assign(r, { formato: "RFC5424", fecha_evento: convertirFecha(m[1], recibido), hostname: m[2], mensaje: m[7] || "" });
    } else if (resto.includes("devname=")) {
      // Fortinet: devname="FW-EDGE" level="alert" msg="..."
      const campos = {};
      for (const k of resto.matchAll(RE_KV)) campos[k[1]] = k[2].startsWith('"') ? k[3] : k[2];
      Object.assign(r, { formato: "Fortinet", marca_detectada: "Fortinet", hostname: campos.devname || null,
        mensaje: campos.msg || campos.logdesc || resto });
      if (campos.date && campos.time) r.fecha_evento = convertirFecha(`${campos.date} ${campos.time}`, recibido);
      const nivel = (campos.level || "").toLowerCase();
      if (r.severidad === null && nivel in NIVELES_FORTINET) r.severidad = NIVELES_FORTINET[nivel];
    } else if ((m = RE_HUAWEI.exec(resto))) {
      Object.assign(r, { formato: "Huawei VRP", fecha_evento: convertirFecha(m[1], recibido), hostname: m[2], mensaje: m[3] });
    } else if ((m = RE_CISCO_NATIVO.exec(resto))) {
      Object.assign(r, { formato: "Cisco IOS", fecha_evento: convertirFecha(m[2], recibido), hostname: m[1] || null, mensaje: m[3] });
    } else if ((m = RE_3164.exec(resto))) {
      Object.assign(r, { formato: "RFC3164", fecha_evento: convertirFecha(m[1], recibido), hostname: m[2], mensaje: m[3] });
    } else {
      r.mensaje = resto;
      advertencias.push("encabezado no reconocido");
    }

    // 3) Fabricante por la forma del mensaje
    if ((m = RE_MNEMONICO_HUAWEI.exec(r.mensaje))) {
      r.marca_detectada = "Huawei";
      if (r.severidad === null) r.severidad = Number(m[2]);
    } else if ((m = RE_MNEMONICO_CISCO.exec(r.mensaje))) {
      r.marca_detectada = r.marca_detectada || "Cisco";
      if (r.severidad === null) r.severidad = Number(m[2]);
    }

    // 4) Sin forma de saber la severidad: se asume 6 (informativo) y se avisa
    if (r.severidad === null) { r.severidad = 6; advertencias.push("severidad no indicada: se asumió 6 (informativo)"); }
    if (r.hostname) r.hostname = r.hostname.replace(/^["':]+|["':]+$/g, "").slice(0, 64);
    r.severidad_nombre = nombreSeveridad(r.severidad);
    r.mensaje = (r.mensaje || "").trim() || "(mensaje vacío)";
    return r;
  }

  NOC.syslog = { SEVERIDADES, FACILITIES, LONGITUD_MAXIMA, nombreSeveridad, analizar };
})(window.NOC);
