/* =============================================================
   js/vistas/inventario.js - Pantalla del inventario (Fase 2)
   ============================================================= */
(function (NOC) {
  "use strict";
  const { $, h, llenar, estadoComunicacion, avisar, api, intentar } = NOC.ui;
  const CAMPOS = ["nombre", "ip", "marca", "modelo", "version", "ubicacion", "estado"];

  function limpiarFormulario() {
    $("form-equipo").reset();
    $("eq-id").value = "";
    $("titulo-form-equipo").textContent = "Agregar equipo";
  }

  function editar(e) {
    $("eq-id").value = e.id;
    CAMPOS.forEach((k) => { $(`eq-${k}`).value = e[k] || ""; });
    $("eq-origen").value = e.origen_dato;
    $("titulo-form-equipo").textContent = `Editando: ${e.nombre}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function eliminar(e) {
    if (!confirm(`¿Eliminar el equipo ${e.nombre}? Sus eventos se conservan sin equipo asociado.`)) return;
    intentar(() => { avisar(api("DELETE", `/api/devices/${e.id}`).mensaje); cargar(); });
  }

  function cargar() {
    const equipos = api("GET", "/api/devices");
    llenar("tabla-equipos", equipos.map((e) => h("tr", {},
      h("td", {}, h("b", {}, e.nombre)), h("td", {}, e.ip), h("td", {}, e.marca), h("td", {}, e.modelo || "—"),
      h("td", {}, e.version || "—"), h("td", {}, e.ubicacion || "—"), h("td", {}, e.estado.replaceAll("_", " ")),
      h("td", {}, estadoComunicacion(e.comunicacion)), h("td", {}, h("span", { class: "etiqueta" }, e.origen_dato)),
      h("td", {}, e.ultima_actualizacion),
      h("td", {}, h("div", { class: "acciones" },
        h("button", { class: "secundario pequeno", onclick: () => editar(e) }, "Editar"),
        h("button", { class: "peligro pequeno", onclick: () => eliminar(e) }, "Eliminar"))))), 11);
  }

  function iniciar() {
    $("eq-cancelar").addEventListener("click", limpiarFormulario);
    $("form-equipo").addEventListener("submit", (ev) => {
      ev.preventDefault();
      intentar(() => {
        const datos = {};
        CAMPOS.forEach((k) => { datos[k] = $(`eq-${k}`).value.trim(); });
        datos.origen_dato = $("eq-origen").value;
        const id = $("eq-id").value;
        api(id ? "PUT" : "POST", id ? `/api/devices/${id}` : "/api/devices", datos);
        avisar(id ? "Equipo actualizado" : "Equipo agregado");
        limpiarFormulario();
        cargar();
      });
    });
  }

  NOC.vistas.inventario = { iniciar, cargar };
})(window.NOC);
