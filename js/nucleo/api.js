/* =============================================================
   js/nucleo/api.js - "API interna" del NOC (Fase 1)

   La interfaz nunca toca los datos directamente: pide todo por rutas,
   igual que una aplicación con servidor. Ejemplo:
       NOC.api("POST", "/api/devices", { nombre: "R2", ... })

   Ventajas:
     - Separa la interfaz (vistas) de la lógica (núcleo).
     - Cada ruta declara qué ROLES pueden usarla (control de acceso).
     - En el Corte 3 estas rutas se pueden mover a un servidor real
       sin cambiar la interfaz.
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";

  const ROLES = ["lector", "operador", "administrador"];
  const rutas = [];

  /** Error controlado con código de estado tipo HTTP (400, 403, 404, 409). */
  class ErrorNOC extends Error {
    constructor(estado, mensajes) {
      const lista = Array.isArray(mensajes) ? mensajes : [mensajes];
      super(lista.join(" "));
      this.estado = estado;
      this.errores = lista;
    }
  }

  /** Sesión actual (usuario y rol). La interfaz la actualiza. */
  const sesion = { usuario: "anonimo", rol: "lector" };
  const USUARIO_VALIDO = /^[\w .\-áéíóúÁÉÍÓÚñÑ]{1,40}$/;

  function fijarSesion(usuario, rol) {
    const u = String(usuario || "").trim();
    sesion.usuario = USUARIO_VALIDO.test(u) ? u : "anonimo";
    sesion.rol = ROLES.includes(rol) ? rol : "lector";
  }

  /**
   * Registra una ruta.
   *   metodo: GET, POST, PUT, DELETE
   *   patron: "/api/devices/:id"
   *   roles:  null = cualquiera; o lista de roles permitidos
   */
  function ruta(metodo, patron, roles, manejador) {
    const nombres = [];
    const regex = new RegExp("^" + patron.replace(/:(\w+)/g, (_, n) => { nombres.push(n); return "([^/]+)"; }) + "$");
    rutas.push({ metodo, regex, nombres, roles, manejador });
  }

  /** Ejecuta una petición. Devuelve el resultado o lanza ErrorNOC. */
  function api(metodo, url, cuerpo) {
    NOC.datos.iniciar();
    const [camino, consulta] = url.split("?");
    const query = Object.fromEntries(new URLSearchParams(consulta || ""));
    for (const r of rutas) {
      if (r.metodo !== metodo) continue;
      const m = r.regex.exec(camino);
      if (!m) continue;
      if (r.roles && !r.roles.includes(sesion.rol)) {
        throw new ErrorNOC(403, `Acción no permitida para el rol '${sesion.rol}'. Requiere: ${r.roles.join(", ")}.`);
      }
      const params = {};
      r.nombres.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      const resultado = r.manejador({ params, query, cuerpo: cuerpo || {}, usuario: sesion.usuario, rol: sesion.rol });
      if (metodo !== "GET") NOC.datos.guardar();   // los cambios se guardan en el navegador
      return resultado;
    }
    throw new ErrorNOC(404, "Recurso no encontrado");
  }

  NOC.ErrorNOC = ErrorNOC;
  NOC.ROLES = ROLES;
  NOC.sesion = sesion;
  NOC.fijarSesion = fijarSesion;
  NOC.ruta = ruta;
  NOC.api = api;

  // Ruta de salud: confirma que el núcleo funciona
  ruta("GET", "/api/health", null, () => ({
    estado: "ok",
    aplicacion: "NOC Syslog Inteligente",
    version: NOC.config.VERSION,
    equipos_en_inventario: NOC.datos.tabla("devices").length,
    datos: "SIMULADOS (laboratorio académico)",
  }));
})(window.NOC);
