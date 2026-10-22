/* Pruebas del tablero y los incidentes (Fase 4 - RF-04, RF-05, HU-03) */
(function (NOC) {
  const { grupo, esperar, esperarError, como } = NOC.pruebas;
  const api = NOC.api;

  grupo("Incidentes y dashboard", 4, ["incidentes"], [
    ["El dashboard trae contadores", () => {
      api("POST", "/api/events/import-sample");
      const d = api("GET", "/api/dashboard");
      esperar(d.contadores.equipos === 4 && d.contadores.eventos_24h > 0 && d.contadores.incidentes_abiertos > 0);
      esperar(d.eventos_recientes.length <= 10);
    }],
    ["Ciclo completo: crear, asignar, seguir y cerrar", () => {
      como("operador");
      const ev = api("POST", "/api/events/simulate", { device_id: 2, severidad: 3 });
      let inc = api("POST", "/api/incidents", { event_id: ev.event_id });
      esperar(inc.estado === "abierto" && inc.evento.id === ev.event_id);
      inc = api("PUT", `/api/incidents/${inc.id}`, { responsable: "Daniel" });
      esperar(inc.estado === "asignado" && inc.responsable === "Daniel");
      api("PUT", `/api/incidents/${inc.id}`, { estado: "en_progreso" });
      api("POST", `/api/incidents/${inc.id}/notes`, { nota: "Se revisa el cable" });
      esperarError(() => api("POST", `/api/incidents/${inc.id}/close`, {}), 400);
      inc = api("POST", `/api/incidents/${inc.id}/close`, { causa: "Cable dañado", solucion: "Cambio de cable" });
      esperar(inc.estado === "cerrado" && inc.cerrado_en && inc.notas.length >= 4);
      esperarError(() => api("PUT", `/api/incidents/${inc.id}`, { estado: "abierto" }), 409);
    }],
    ["Un incidente automático no se duplica", () => {
      for (let i = 0; i < 3; i++) api("POST", "/api/events/simulate", { device_id: 1, severidad: 0 });
      esperar(api("GET", "/api/incidents?estado=activos").length === 1);
    }],
  ]);
})(window.NOC);
