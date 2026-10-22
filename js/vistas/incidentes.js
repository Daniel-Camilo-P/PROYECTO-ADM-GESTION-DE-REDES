/* =============================================================
   js/vistas/incidentes.js - Pantalla de incidentes (Fase 4, RF-05)
   ============================================================= */
(function (NOC) {
  "use strict";
  const { $, h, llenar, sev, estadoGeneral, avisar, api, intentar, opcionesSeveridad, opcionesEquipos } = NOC.ui;

  function cargar() {
    opcionesEquipos($("in-equipo"), "(ninguno)");
    const estado = $("filtro-estado").value;
    const lista = api("GET", `/api/incidents${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`);
    llenar("tabla-incidentes", lista.map((i) => h("tr", { class: "clic", onclick: () => ver(i.id) },
      h("td", {}, `#${i.id}`), h("td", {}, sev(i.severidad)), h("td", { class: "msg" }, i.titulo),
      h("td", {}, i.equipo || "—"), h("td", {}, estadoGeneral(i.estado)), h("td", {}, i.responsable || "—"),
      h("td", {}, i.sla_minutos ? `${i.sla_minutos} min` : "—"), h("td", {}, i.creado_en), h("td", {}, i.creado_por))),
    9, "Sin incidentes");
  }

  /** Muestra el detalle de un incidente con sus controles. */
  function ver(id) {
    intentar(() => {
      const i = api("GET", `/api/incidents/${id}`);
      const cerrado = i.estado === "cerrado";
      const caja = $("detalle-incidente");
      caja.className = "detalle";
      const datos = [
        ["Incidente", `#${i.id} · ${i.titulo}`], ["Severidad", sev(i.severidad)], ["Estado", estadoGeneral(i.estado)],
        ["Equipo", i.equipo || "—"], ["Responsable", i.responsable || "sin asignar"],
        ["SLA", i.sla_minutos ? `${i.sla_minutos} minutos` : "—"], ["Creado", `${i.creado_en} por ${i.creado_por}`],
        ["Evento origen", i.evento ? `#${i.evento.id} · ${i.evento.mensaje}` : "—"], ["Descripción", i.descripcion || "—"],
      ];
      if (cerrado) datos.push(["Cerrado", i.cerrado_en], ["Causa", i.causa], ["Solución", i.solucion]);
      const dl = h("dl", {}, ...datos.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
      const controles = [];
      if (!cerrado) {
        const resp = h("input", { placeholder: "Responsable", value: i.responsable || "", maxlength: 60 });
        const est = h("select", {}, ...["abierto", "asignado", "en_progreso", "resuelto"].map((s) => {
          const o = h("option", { value: s }, s.replace("_", " ")); if (s === i.estado) o.selected = true; return o; }));
        const nota = h("input", { placeholder: "Nota de seguimiento", maxlength: 300 });
        const causa = h("input", { placeholder: "Causa raíz", maxlength: 300 });
        const solucion = h("input", { placeholder: "Solución aplicada", maxlength: 300 });
        const accion = (texto, clase, funcion) => h("button", { class: clase, onclick: () => intentar(() => { funcion(); cargar(); ver(i.id); }) }, texto);
        controles.push(
          h("div", { class: "en-linea" }, resp, est, accion("Asignar / actualizar", "", () => {
            api("PUT", `/api/incidents/${i.id}`, { responsable: resp.value, estado: est.value }); avisar("Incidente actualizado"); })),
          h("div", { class: "en-linea" }, nota, accion("Agregar nota", "secundario", () => {
            api("POST", `/api/incidents/${i.id}/notes`, { nota: nota.value }); avisar("Nota agregada"); })),
          h("div", { class: "en-linea" }, causa, solucion, accion("Cerrar incidente", "ok", () => {
            api("POST", `/api/incidents/${i.id}/close`, { causa: causa.value, solucion: solucion.value }); avisar(`Incidente #${i.id} cerrado`); })));
      }
      const notas = h("div", { class: "notas" }, h("b", {}, "Bitácora de seguimiento"),
        ...i.notas.map((n) => h("div", {}, `${n.creado_en} · ${n.autor}: ${n.nota}`)));
      caja.replaceChildren(dl, ...controles, notas);
    });
  }

  function iniciar() {
    opcionesSeveridad($("in-sev"), false, 3);
    $("filtro-estado").addEventListener("change", () => intentar(cargar));
    $("form-incidente").addEventListener("submit", (ev) => {
      ev.preventDefault();
      intentar(() => {
        const r = api("POST", "/api/incidents", {
          titulo: $("in-titulo").value, severidad: Number($("in-sev").value), device_id: $("in-equipo").value || null,
          responsable: $("in-resp").value, descripcion: $("in-desc").value });
        $("form-incidente").reset();
        opcionesSeveridad($("in-sev"), false, 3);
        avisar(`Incidente #${r.id} creado`);
        cargar();
        ver(r.id);
      });
    });
  }

  NOC.vistas.incidentes = { iniciar, cargar, ver };
})(window.NOC);
