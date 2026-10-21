/* Pruebas del inventario de equipos (Fase 2 - RF-01) */
(function (NOC) {
  const { grupo, esperar, esperarError, como } = NOC.pruebas;
  const api = NOC.api;

  grupo("Inventario", 2, ["inventario"], [
    ["El núcleo responde (/api/health)", () => {
      esperar(api("GET", "/api/health").estado === "ok");
    }],
    ["Carga los 4 equipos simulados", () => {
      const equipos = api("GET", "/api/devices");
      esperar(equipos.length === 4, `Hay ${equipos.length} equipos`);
      esperar(equipos.every((e) => e.origen_dato === "SIMULADO"));
    }],
    ["Crear, editar y eliminar un equipo", () => {
      como("operador");
      const nuevo = api("POST", "/api/devices", { nombre: "R2-SEDE", ip: "192.0.2.40", marca: "Cisco", modelo: "ISR 4321" });
      const editado = api("PUT", `/api/devices/${nuevo.id}`, { estado: "mantenimiento" });
      esperar(editado.estado === "mantenimiento" && editado.ultima_actualizacion);
      como("administrador");
      api("DELETE", `/api/devices/${nuevo.id}`);
      esperar(api("GET", "/api/devices").length === 4);
    }],
    ["Valida nombre, IP y marca", () => {
      const e = esperarError(() => api("POST", "/api/devices", { nombre: "mal nombre", ip: "999.1.1.1", marca: "X" }), 400);
      esperar(e.errores.length === 3, `Errores: ${e.errores.length}`);
    }],
    ["No permite nombres ni IPs duplicados", () => {
      esperarError(() => api("POST", "/api/devices", { nombre: "R1-NOC", ip: "192.0.2.99", marca: "Cisco" }), 409);
    }],
    ["Roles: lector no crea; operador no elimina", () => {
      como("lector");
      esperarError(() => api("POST", "/api/devices", { nombre: "X1", ip: "192.0.2.77", marca: "Otro" }), 403);
      como("operador");
      esperarError(() => api("DELETE", "/api/devices/1"), 403);
    }],
    ["Los cambios quedan en la auditoría con el usuario", () => {
      api("PUT", "/api/devices/1", { ubicacion: "Nueva sala" });
      const fila = NOC.datos.tabla("audit_trail").find((a) => a.accion === "editar_equipo");
      esperar(fila && fila.actor === "admin.pruebas" && fila.detalle.includes("Nueva sala"));
    }],
  ]);
})(window.NOC);
