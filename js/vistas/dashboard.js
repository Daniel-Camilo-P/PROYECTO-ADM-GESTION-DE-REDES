/* =============================================================
   js/vistas/dashboard.js - Tablero principal (Fase 4, RF-04)
   ============================================================= */
(function (NOC) {
  "use strict";
  const { $, h, llenar, sev, NOMBRES_SEV, estadoComunicacion, estadoGeneral, avisar, api, intentar, opcionesSeveridad, opcionesEquipos } = NOC.ui;

  function verIncidente(id) {
    NOC.ui.abrirPestana("incidentes");
    if (NOC.vistas.incidentes) NOC.vistas.incidentes.ver(id);
  }

  function cargar() {
    opcionesEquipos($("sim-equipo"));
    const d = api("GET", "/api/dashboard");
    const c = d.contadores;
    const kpis = [
      ["Equipos en inventario", c.equipos, ""],
      ["Sin comunicación / sin eventos", c.sin_comunicacion, c.sin_comunicacion ? "amarillo" : "verde"],
      ["Eventos (24 h)", c.eventos_24h, ""],
      [`Críticos 0-${d.politica.incidente_hasta_severidad} (24 h)`, c.criticos_24h, c.criticos_24h ? "rojo" : "verde"],
      ["Incidentes abiertos", c.incidentes_abiertos, c.incidentes_abiertos ? "rojo" : "verde"],
      ["Detecciones de seguridad (24 h)", c.seguridad_24h, c.seguridad_24h ? "amarillo" : "verde"],
      ["Cambios por aprobar / ejecutar", c.pendientes_aprobacion, c.pendientes_aprobacion ? "amarillo" : ""],
    ];
    $("kpis").replaceChildren(...kpis.map(([n, v, cl]) =>
      h("div", { class: `tarjeta ${cl}` }, h("div", { class: "valor" }, String(v)), h("div", { class: "nombre" }, n))));

    const maximo = Math.max(1, ...Object.values(d.por_severidad));
    $("barras-sev").replaceChildren(...Object.entries(d.por_severidad).map(([n, v]) => {
      const relleno = h("div", { class: `relleno sev-${n}` });
      relleno.style.width = `${(v / maximo) * 100}%`;
      return h("div", { class: "barra-sev" }, h("span", {}, `${n} ${NOMBRES_SEV[n]}`),
        h("div", { class: "fondo-barra" }, relleno), h("b", {}, String(v)));
    }));

    llenar("dash-equipos", d.equipos.map((e) => h("tr", {},
      h("td", {}, e.nombre), h("td", {}, e.marca), h("td", {}, e.estado.replaceAll("_", " ")),
      h("td", {}, estadoComunicacion(e.comunicacion)), h("td", {}, e.ultimo_evento || "—"))), 5);
    llenar("dash-criticos", d.eventos_criticos.map((e) => h("tr", {},
      h("td", {}, sev(e.severidad)), h("td", {}, e.equipo || `${e.hostname || "?"} (no autorizado)`),
      h("td", { class: "msg" }, e.mensaje), h("td", {}, e.recibido_en))), 4, "Sin eventos críticos");
    llenar("dash-incidentes", d.incidentes_abiertos.map((i) => h("tr", { class: "clic", onclick: () => verIncidente(i.id) },
      h("td", {}, `#${i.id}`), h("td", {}, sev(i.severidad)), h("td", { class: "msg" }, i.titulo),
      h("td", {}, estadoGeneral(i.estado)), h("td", {}, i.responsable || "—"))), 5, "Sin incidentes abiertos");
    llenar("dash-recientes", d.eventos_recientes.map((e) => h("tr", {},
      h("td", {}, sev(e.severidad)), h("td", {}, e.equipo || e.hostname || "?"), h("td", {}, e.marca || "?"),
      h("td", {}, e.facility_nombre || "—"), h("td", { class: "msg" }, e.mensaje), h("td", {}, e.canal),
      h("td", {}, e.recibido_en))), 7, "Aún no hay eventos. Vaya a Eventos Syslog e importe el ejemplo o inicie el receptor.");
  }

  function iniciar() {
    opcionesSeveridad($("sim-sev"), false, 3);
    $("form-simular").addEventListener("submit", (ev) => {
      ev.preventDefault();
      intentar(() => {
        const r = api("POST", "/api/events/simulate", { device_id: $("sim-equipo").value, severidad: Number($("sim-sev").value) });
        avisar(r.estado === "guardado" ? `Evento #${r.event_id} generado` + (r.incidente_id ? ` · incidente #${r.incidente_id}` : "")
          : `Evento ${r.estado.replaceAll("_", " ")}`);
        cargar();
      });
    });
    // Actualiza el tablero cada 10 segundos (por si el receptor en vivo está activo)
    setInterval(() => { if (!$("tab-dashboard").classList.contains("oculto")) intentar(cargar); }, 10000);
  }

  NOC.vistas.dashboard = { iniciar, cargar };
})(window.NOC);
