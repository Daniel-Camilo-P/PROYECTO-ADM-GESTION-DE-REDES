/* Pruebas de recepción, clasificación y filtros de Syslog (Fase 3 - RF-02, RF-03) */
(function (NOC) {
  const { grupo, esperar } = NOC.pruebas;
  const api = NOC.api;
  const analizar = (t) => NOC.syslog.analizar(t, "2026-10-16 18:00:00");

  grupo("Syslog", 3, ["syslog", "eventos"], [
    ["PRI <187> = facility 23 (local7) y severidad 3", () => {
      const d = analizar("<187>Oct 16 18:00:00 R1-NOC %LINK-3-UPDOWN: Interface Gi0/1, changed state to down");
      esperar(d.facility === 23 && d.facility_nombre === "local7");
      esperar(d.severidad === 3 && d.severidad_nombre === "Error");
      esperar(d.hostname === "R1-NOC" && d.marca_detectada === "Cisco");
    }],
    ["Reconoce todas las severidades de 0 a 7", () => {
      for (let s = 0; s < 8; s++) esperar(analizar(`<${184 + s}>Oct 16 18:00:00 R1 mensaje`).severidad === s, `Falla en ${s}`);
    }],
    ["Formato Fortinet (clave=valor)", () => {
      const d = analizar('<185>date=2026-10-16 time=11:45:00 devname="FW-EDGE" level="alert" msg="Conserve mode"');
      esperar(d.hostname === "FW-EDGE" && d.severidad === 1);
      esperar(d.mensaje === "Conserve mode" && d.fecha_evento === "2026-10-16 11:45:00");
    }],
    ["Formato Huawei VRP", () => {
      const d = analizar("<187>Oct 16 2026 13:00:00 SW-CORE %%01IFNET/3/LINK_STATE(l):The line protocol is DOWN");
      esperar(d.hostname === "SW-CORE" && d.marca_detectada === "Huawei" && d.fecha_evento === "2026-10-16 13:00:00");
    }],
    ["Formato RFC 5424", () => {
      const d = analizar("<182>1 2026-10-16T14:00:00.000-05:00 R1-NOC sshd 2201 ID47 - Usuario cerró sesión");
      esperar(d.formato === "RFC5424" && d.severidad === 6 && d.hostname === "R1-NOC");
    }],
    ["Sin PRI usa el mnemónico de Cisco", () => {
      esperar(analizar("Oct 16 18:00:00 R1 %SYS-2-MALLOCFAIL: memoria").severidad === 2);
    }],
    ["Un mensaje basura no rompe el lector", () => {
      const d = analizar("\x00\x01 esto no es syslog " + "A".repeat(5000));
      esperar(d.severidad === 6 && d.mensaje.length <= 2048);
    }],
    ["Importa el ejemplo y clasifica", () => {
      const r = api("POST", "/api/events/import-sample");
      esperar(r.guardadas > 15, `guardadas=${r.guardadas}`);
      esperar(r.agrupadas >= 1, "deduplicación");
      esperar(r.no_autorizadas === 1, "ROUTER-DESCONOCIDO");
      esperar(r.sospechosas === 1, "log con instrucciones");
    }],
    ["Filtro por marca y severidad", () => {
      api("POST", "/api/events/import-sample");
      const r = api("GET", "/api/events?marca=Cisco&sev_min=0&sev_max=3");
      esperar(r.total > 0 && r.eventos.every((e) => e.marca === "Cisco" && e.severidad <= 3));
    }],
    ["Filtro por equipo y fecha", () => {
      api("POST", "/api/events/import-sample");
      const fecha = api("GET", "/api/events").eventos[0].fecha_evento.slice(0, 10);
      const r = api("GET", `/api/events?device_id=4&desde=${fecha}&hasta=${fecha}`);
      esperar(r.total > 0 && r.eventos.every((e) => e.device_id === 4));
    }],
    ["Receptor en vivo: valida la IP de origen (suplantación)", () => {
      const legitimo = api("POST", "/api/events/receive", { raw: "<190>Oct 16 18:00:00 R1-NOC %SYS-6-X: hola", ip_origen: "192.0.2.11" });
      const falso = api("POST", "/api/events/receive", { raw: "<190>Oct 16 18:00:01 R1-NOC %SYS-6-X: hola falso", ip_origen: "198.51.100.200" });
      esperar(legitimo.autorizado === true && falso.autorizado === false);
    }],
    ["Evento crítico simulado crea incidente; uno leve no", () => {
      esperar(api("POST", "/api/events/simulate", { device_id: 1, severidad: 1 }).incidente_id !== null);
      esperar(api("POST", "/api/events/simulate", { device_id: 1, severidad: 6 }).incidente_id === null);
    }],
  ]);
})(window.NOC);
