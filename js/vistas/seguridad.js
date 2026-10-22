/* =============================================================
   js/vistas/seguridad.js - Aprobaciones, detecciones, auditoría y respaldo (Fase 6)
   ============================================================= */
(function (NOC) {
  "use strict";
  const { $, h, llenar, estadoGeneral, avisar, api, intentar, descargar } = NOC.ui;

  function cargar() {
    const propuestas = api("GET", "/api/actions?tipo=propuesta");
    llenar("tabla-propuestas", propuestas.map((p) => {
      const boton = (ruta, texto, clase, pedir) => h("button", { class: `${clase} pequeno`, onclick: () => intentar(() => {
        const cuerpo = pedir ? pedir() : {};
        if (cuerpo === null) return;   // el usuario canceló
        api("POST", `/api/actions/${p.id}/${ruta}`, cuerpo);
        avisar(`Propuesta #${p.id}: ${texto}`);
        cargar();
      }) }, texto);
      const pedir = (pregunta, campo) => () => { const v = prompt(pregunta); return v === null ? null : { [campo]: v }; };
      const botones = [];
      if (p.decision === "pendiente") {
        botones.push(boton("approve", "Aprobar", "ok", pedir("Comentario de aprobación:", "comentario")));
        botones.push(boton("reject", "Rechazar", "peligro", pedir("Motivo del rechazo:", "comentario")));
      }
      if (p.decision === "aprobado") botones.push(boton("execute", "Ejecutar (simulado)", "secundario"));
      if (p.decision === "ejecutado_simulado") botones.push(boton("verify", "Verificar", "ok", pedir("Resultado de la verificación:", "nota")));
      return h("tr", {}, h("td", {}, `#${p.id}`), h("td", {}, p.fecha), h("td", {}, p.usuario), h("td", {}, p.equipo || "—"),
        h("td", { class: "mono" }, p.comando), h("td", {}, p.justificacion || "—"),
        h("td", {}, estadoGeneral(p.decision)), h("td", {}, p.aprobado_por || "—"),
        h("td", {}, h("div", { class: "acciones" }, ...botones), p.resultado ? h("div", { class: "nota" }, p.resultado) : null));
    }), 9, "Sin propuestas. Desde la Consola escriba un comando de cambio (ej. configure terminal) y regístrelo como propuesta.");

    let seguridad = [];
    try { seguridad = api("GET", "/api/events/security"); } catch (_) { seguridad = []; }
    llenar("tabla-seguridad", seguridad.slice(0, 50).map((s) => h("tr", {}, h("td", {}, s.fecha),
      h("td", {}, h("span", { class: "alerta" }, s.tipo.replaceAll("_", " "))), h("td", { class: "msg" }, s.detalle))), 3, "Sin detecciones");

    const comandos = api("GET", "/api/actions").filter((c) => c.tipo !== "propuesta").slice(0, 50);
    llenar("tabla-comandos", comandos.map((c) => h("tr", {}, h("td", {}, c.fecha), h("td", {}, `${c.usuario} (${c.rol})`),
      h("td", {}, c.perfil), h("td", { class: "mono" }, c.comando), h("td", {}, estadoGeneral(c.decision)))), 5, "Sin comandos");

    const auditoria = api("GET", "/api/actions/audit");
    llenar("tabla-auditoria", auditoria.slice(0, 100).map((a) => h("tr", {}, h("td", {}, String(a.id)), h("td", {}, a.fecha),
      h("td", {}, a.actor), h("td", {}, a.accion), h("td", {}, `${a.entidad}${a.entidad_id ? " #" + a.entidad_id : ""}`),
      h("td", { class: "msg" }, a.detalle || ""), h("td", { class: "mono", title: a.hash }, a.hash.slice(0, 12) + "…"))), 7);
  }

  function iniciar() {
    $("btn-integridad").addEventListener("click", () => intentar(() => {
      const r = api("GET", "/api/actions/audit/verify");
      $("integridad").textContent = r.integra ? `ÍNTEGRA · ${r.filas_revisadas} registros` : `ALTERADA en el registro #${r.fila_alterada}`;
    }));
    $("btn-respaldo").addEventListener("click", () => intentar(() => {
      const texto = api("POST", "/api/backup");
      descargar(`respaldo-noc-${NOC.datos.ahora().slice(0, 10)}.json`, texto);
      avisar("Respaldo descargado");
      cargar();
    }));
    $("archivo-respaldo").addEventListener("change", (ev) => {
      const archivo = ev.target.files[0];
      ev.target.value = "";
      if (!archivo || !confirm("¿Reemplazar todos los datos actuales por los del respaldo?")) return;
      const lector = new FileReader();
      lector.onload = () => intentar(() => {
        avisar(api("POST", "/api/restore", { texto: lector.result, nombre: archivo.name }).mensaje);
        cargar();
      });
      lector.readAsText(archivo);
    });
    $("btn-reiniciar").addEventListener("click", () => {
      if (!confirm("Se borrarán todos los eventos, incidentes y la auditoría, y se cargarán de nuevo los 4 equipos simulados. ¿Continuar?")) return;
      intentar(() => { avisar(api("POST", "/api/reset").mensaje); cargar(); });
    });
  }

  NOC.vistas.seguridad = { iniciar, cargar };
})(window.NOC);
