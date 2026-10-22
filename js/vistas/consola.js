/* =============================================================
   js/vistas/consola.js - Consola tipo PuTTY simulada (Fase 5, RF-07)
   ============================================================= */
(function (NOC) {
  "use strict";
  const { $, h, avisar, api, intentar, opcionesEquipos } = NOC.ui;
  let perfiles = {};

  function linea(texto, clase) {
    const t = $("terminal");
    t.appendChild(h("div", { class: `t-linea ${clase || ""}` }, texto));
    t.scrollTop = t.scrollHeight;
  }

  function cambioPerfil() {
    const p = perfiles[$("co-perfil").value];
    if (!p) return;
    $("co-prompt").textContent = p.prompt;
    $("co-permitidos").textContent = `Lista permitida (${p.nombre}): ${p.permitidos.join(" · ")}`;
    const equipos = api("GET", "/api/devices");
    const eq = equipos.find((e) => e.marca === p.marca);
    if (eq) $("co-equipo").value = eq.id;
  }

  function cargar() {
    opcionesEquipos($("co-equipo"));
    if (!Object.keys(perfiles).length) {
      perfiles = api("GET", "/api/console/profiles");
      $("co-perfil").replaceChildren(...Object.entries(perfiles).map(([k, v]) => h("option", { value: k }, v.nombre)));
    }
    cambioPerfil();
    $("co-comando").focus();
  }

  function iniciar() {
    $("co-perfil").addEventListener("change", () => intentar(cambioPerfil));
    $("form-comando").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const comando = $("co-comando").value.trim();
      $("co-comando").value = "";
      if (!comando) return;
      linea(`${$("co-prompt").textContent} ${comando}`, "t-cmd");
      intentar(() => {
        const r = api("POST", "/api/console/exec", { perfil: $("co-perfil").value, comando, device_id: $("co-equipo").value });
        if (r.decision === "permitido") {
          linea(r.salida);
          $("co-propuesta").classList.add("oculto");
        } else {
          linea(`% BLOQUEADO: ${r.motivo}`, "t-bloq");
          $("co-propuesta").classList.toggle("oculto", !r.puede_proponer);
          $("pr-comando").value = comando;
        }
      });
    });
    $("form-propuesta").addEventListener("submit", (ev) => {
      ev.preventDefault();
      intentar(() => {
        const r = api("POST", "/api/console/propose", { perfil: $("co-perfil").value, comando: $("pr-comando").value,
          device_id: $("co-equipo").value, justificacion: $("pr-just").value });
        linea(`[PROPUESTA #${r.propuesta_id}] registrada como PENDIENTE. Debe aprobarla un administrador distinto.`, "t-info");
        $("co-propuesta").classList.add("oculto");
        $("pr-just").value = "";
        avisar(r.mensaje);
      });
    });
  }

  NOC.vistas.consola = { iniciar, cargar };
})(window.NOC);
