/* =============================================================
   js/nucleo/inventario.js - Inventario editable de equipos (Fase 2, RF-01)

   Rutas de la API interna:
     GET    /api/devices        -> lista todos los equipos
     POST   /api/devices        -> crea un equipo        (operador o administrador)
     GET    /api/devices/:id    -> consulta un equipo
     PUT    /api/devices/:id    -> edita un equipo       (operador o administrador)
     DELETE /api/devices/:id    -> elimina un equipo     (solo administrador)
   Cada cambio queda en la auditoría con usuario y fecha.
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const D = NOC.datos;
  const S = NOC.seguridad;
  const MARCAS = ["Cisco", "Fortinet", "Huawei", "Otro"];
  const ESTADOS = ["operativo", "mantenimiento", "fuera_de_servicio"];
  const CAMPOS = ["nombre", "ip", "marca", "modelo", "version", "ubicacion", "estado", "origen_dato"];
  const NOMBRE_VALIDO = /^[A-Za-z0-9._-]{1,64}$/;

  /** ¿El equipo "habla" con el NOC? (historia de usuario HU-01) */
  function comunicacion(equipo) {
    if (equipo.estado === "fuera_de_servicio") return "fuera de servicio";
    if (!equipo.ultimo_evento) return "sin eventos";
    const minutos = (Date.now() - D.aFecha(equipo.ultimo_evento).getTime()) / 60000;
    return minutos <= NOC.config.MINUTOS_SIN_COMUNICACION ? "con comunicación" : "sin comunicación";
  }

  function serializar(e) { return Object.assign({}, e, { comunicacion: comunicacion(e) }); }

  /** Revisa los datos recibidos. Devuelve { limpio, errores }. */
  function validar(datos, parcial) {
    const errores = [];
    const limpio = {};
    CAMPOS.forEach((c) => { if (c in datos) limpio[c] = S.limpiar(datos[c], 120); });
    if (!parcial) ["nombre", "ip", "marca"].forEach((c) => { if (!limpio[c]) errores.push(`El campo '${c}' es obligatorio.`); });
    if (limpio.nombre && !NOMBRE_VALIDO.test(limpio.nombre)) errores.push("Nombre inválido: use letras, números, punto, guion o guion bajo (sin espacios).");
    if (limpio.ip && !S.ipValida(limpio.ip)) errores.push("La IP no es válida (ejemplo: 192.0.2.10).");
    if (limpio.marca && !MARCAS.includes(limpio.marca)) errores.push(`Marca inválida. Opciones: ${MARCAS.join(", ")}.`);
    if (limpio.estado && !ESTADOS.includes(limpio.estado)) errores.push(`Estado inválido. Opciones: ${ESTADOS.join(", ")}.`);
    if ("origen_dato" in limpio && !["SIMULADO", "REAL"].includes(limpio.origen_dato)) errores.push("origen_dato debe ser SIMULADO o REAL.");
    return { limpio, errores };
  }

  function obtener(id) {
    const e = D.buscar("devices", id);
    if (!e) throw new NOC.ErrorNOC(404, "Equipo no encontrado");
    return e;
  }

  NOC.ruta("GET", "/api/devices", null, () =>
    D.tabla("devices").slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map(serializar));

  NOC.ruta("GET", "/api/devices/:id", null, ({ params }) => serializar(obtener(params.id)));

  NOC.ruta("POST", "/api/devices", ["operador", "administrador"], ({ cuerpo, usuario }) => {
    const { limpio, errores } = validar(cuerpo, false);
    if (errores.length) throw new NOC.ErrorNOC(400, errores);
    if (D.tabla("devices").some((e) => e.nombre === limpio.nombre || e.ip === limpio.ip)) {
      throw new NOC.ErrorNOC(409, "Ya existe un equipo con ese nombre o esa IP.");
    }
    const nuevo = D.insertar("devices", {
      nombre: limpio.nombre, ip: limpio.ip, marca: limpio.marca, modelo: limpio.modelo || null,
      version: limpio.version || null, ubicacion: limpio.ubicacion || null, estado: limpio.estado || "operativo",
      origen_dato: limpio.origen_dato || "SIMULADO", ultimo_evento: null, ultima_actualizacion: D.ahora(),
    });
    S.registrarAuditoria(usuario, "crear_equipo", "devices", nuevo.id, `${nuevo.nombre} ${nuevo.ip} ${nuevo.marca}`);
    return serializar(nuevo);
  });

  NOC.ruta("PUT", "/api/devices/:id", ["operador", "administrador"], ({ params, cuerpo, usuario }) => {
    const actual = obtener(params.id);
    const { limpio, errores } = validar(cuerpo, true);
    if (errores.length) throw new NOC.ErrorNOC(400, errores);
    if (!Object.keys(limpio).length) throw new NOC.ErrorNOC(400, "No se recibió ningún campo para actualizar.");
    const nombre = limpio.nombre || actual.nombre;
    const ip = limpio.ip || actual.ip;
    if (D.tabla("devices").some((e) => e.id !== actual.id && (e.nombre === nombre || e.ip === ip))) {
      throw new NOC.ErrorNOC(409, "Otro equipo ya usa ese nombre o esa IP.");
    }
    const cambios = Object.entries(limpio).filter(([k, v]) => String(actual[k] ?? "") !== String(v));
    if (cambios.length) {
      // Se arma el detalle ANTES de cambiar, para guardar el valor anterior y el nuevo
      const detalle = cambios.map(([k, v]) => `${k}: '${actual[k] ?? "-"}' -> '${v}'`).join("; ");
      cambios.forEach(([k, v]) => { actual[k] = v || null; });
      actual.ultima_actualizacion = D.ahora();
      S.registrarAuditoria(usuario, "editar_equipo", "devices", actual.id, detalle);
    }
    return serializar(actual);
  });

  NOC.ruta("DELETE", "/api/devices/:id", ["administrador"], ({ params, usuario }) => {
    const e = obtener(params.id);
    D.eliminar("devices", e.id);
    // Los eventos se conservan como evidencia, sin equipo asociado
    D.tabla("events").forEach((ev) => { if (ev.device_id === e.id) ev.device_id = null; });
    S.registrarAuditoria(usuario, "eliminar_equipo", "devices", e.id, `${e.nombre} ${e.ip}`);
    return { mensaje: `Equipo ${e.nombre} eliminado.` };
  });

  NOC.inventario = { MARCAS, ESTADOS, comunicacion, serializar };
})(window.NOC);
