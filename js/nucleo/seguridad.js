/* =============================================================
   js/nucleo/seguridad.js - Controles de seguridad (Fase 2)

   Reglas de la "Política de defensa frente a agentes de IA":
     1. Validación de datos de entrada (IP, nombres, textos).
     2. Detección de instrucciones escondidas en los logs (inyección).
        REGLA DE ORO: un log es un DATO NO CONFIABLE, nunca una orden.
     3. Enmascarado de secretos (contraseñas o tokens dentro de un log).
     4. Límite de frecuencia (rate limit) contra tormentas de eventos.
     5. Auditoría encadenada con hash SHA-256 (detecta alteraciones).
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const D = NOC.datos;

  // ---------------- 1. Validación ----------------
  function ipValida(texto) {
    const t = String(texto || "").trim();
    const v4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    const v6 = /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|::([0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4})$/i;
    return v4.test(t) || v6.test(t);
  }

  /** Quita caracteres de control y recorta la longitud. */
  function limpiar(texto, maximo = 500) {
    if (texto === null || texto === undefined) return "";
    return String(texto).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "").trim().slice(0, maximo);
  }

  // ---------------- 2. Instrucciones escondidas (inyección de prompt) ----------------
  const PATRONES_INYECCION = [
    [/ignor\w*\s+(todas?\s+)?(las\s+|los\s+)?(instrucciones|pol[ií]ticas|politicas|reglas|restricciones)/i, "pide ignorar políticas o instrucciones"],
    [/ignore\s+(all\s+)?(previous|prior|the)\s+(instructions|rules|policies)/i, "pide ignorar instrucciones (inglés)"],
    [/system\s*prompt|prompt\s+del\s+sistema/i, "menciona el prompt del sistema"],
    [/\b(act[uú]a|actua)\s+como\b|\byou\s+are\s+now\b/i, "intenta cambiar el rol del asistente"],
    [/\bejecut\w*\s+(el\s+|este\s+|los\s+)?(siguiente|comando|comandos)\b|\bexecute\s+(the\s+)?(following|command)/i, "ordena ejecutar comandos"],
    [/\b(aprueba|approve)\w*\s+(autom[aá]ticamente|automatically|sin\s+revisi[oó]n)/i, "pide aprobar sin revisión humana"],
    [/(rm\s+-rf|curl\s+https?:\/\/|wget\s+https?:\/\/|powershell|cmd\.exe|bash\s+-c)/i, "contiene comandos de sistema operativo"],
    [/<\s*script|javascript:/i, "contiene código para navegador"],
  ];

  /** Devuelve la lista de motivos si el texto parece una instrucción maliciosa. */
  function detectarInyeccion(texto) {
    return PATRONES_INYECCION.filter(([patron]) => patron.test(texto || "")).map(([, motivo]) => motivo);
  }

  // ---------------- 3. Enmascarado de secretos ----------------
  const PATRON_SECRETO = /\b(password|passwd|pwd|contrase[ñn]a|secret|token|api[_-]?key|clave)\b(\s*[=:]\s*|\s+)("[^"]*"|\S+)/gi;
  function enmascararSecretos(texto) {
    return String(texto || "").replace(PATRON_SECRETO, (_, palabra, separador) => `${palabra}${separador}***`);
  }

  // ---------------- 4. Límite de frecuencia (ventana de 60 s) ----------------
  class LimitadorFrecuencia {
    constructor() { this.historial = new Map(); this.avisos = new Map(); }
    permitir(clave, limitePorMinuto, momento = Date.now()) {
      const cola = (this.historial.get(clave) || []).filter((t) => momento - t <= 60000);
      if (cola.length >= limitePorMinuto) { this.historial.set(clave, cola); return false; }
      cola.push(momento);
      this.historial.set(clave, cola);
      return true;
    }
    /** Un solo aviso por minuto, para que la tormenta no llene también el registro. */
    debeAvisar(clave, momento = Date.now()) {
      if (momento - (this.avisos.get(clave) || 0) >= 60000) { this.avisos.set(clave, momento); return true; }
      return false;
    }
    reiniciar() { this.historial.clear(); this.avisos.clear(); }
  }
  const limitador = new LimitadorFrecuencia();

  // ---------------- 5. SHA-256 y auditoría encadenada ----------------
  /** SHA-256 en JavaScript puro (funciona incluso abriendo el archivo con doble clic). */
  function sha256(texto) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const bytes = Array.from(new TextEncoder().encode(texto));
    const largoBits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (largoBits >>> (i * 8)) & 0xff);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < bytes.length; i += 64) {
      const w = new Array(64);
      for (let t = 0; t < 16; t++) w[t] = (bytes[i + 4 * t] << 24) | (bytes[i + 4 * t + 1] << 16) | (bytes[i + 4 * t + 2] << 8) | bytes[i + 4 * t + 3];
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, k) => { H[k] = (H[k] + v) | 0; });
    }
    return H.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
  }

  function calcularHash(prev, f) {
    return sha256([prev, f.fecha, f.actor, f.accion, f.entidad, f.entidad_id ?? "", f.detalle].join("|"));
  }

  /** Agrega una línea a la auditoría. Cada línea incluye el hash de la anterior. */
  function registrarAuditoria(actor, accion, entidad, entidadId = null, detalle = "") {
    const lista = D.tabla("audit_trail");
    const prev = lista.length ? lista[lista.length - 1].hash : "0".repeat(64);
    const fila = { fecha: D.ahora(), actor, accion, entidad, entidad_id: entidadId, detalle: limpiar(detalle, 1000) };
    fila.hash_prev = prev;
    fila.hash = calcularHash(prev, fila);
    return D.insertar("audit_trail", fila);
  }

  /** Recalcula toda la cadena. Si alguien editó una línea, el hash no coincide. */
  function verificarAuditoria() {
    let prev = "0".repeat(64);
    const lista = D.tabla("audit_trail");
    for (const f of lista) {
      if (f.hash_prev !== prev || f.hash !== calcularHash(prev, f)) {
        return { integra: false, fila_alterada: f.id, filas_revisadas: lista.length };
      }
      prev = f.hash;
    }
    return { integra: true, filas_revisadas: lista.length };
  }

  function registrarEventoSeguridad(tipo, detalle, ipOrigen = null, usuario = null) {
    return D.insertar("security_events", { fecha: D.ahora(), tipo, detalle: limpiar(detalle, 500), ip_origen: ipOrigen, usuario });
  }

  NOC.seguridad = { ipValida, limpiar, detectarInyeccion, enmascararSecretos, LimitadorFrecuencia, limitador,
    sha256, registrarAuditoria, verificarAuditoria, registrarEventoSeguridad };
})(window.NOC);
