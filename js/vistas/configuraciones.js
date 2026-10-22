/* =============================================================
   js/vistas/configuraciones.js - Generador de plantillas (Fase 5, RF-06)
   ============================================================= */
(function (NOC) {
  "use strict";
  const { $, avisar, api, intentar, opcionesSeveridad } = NOC.ui;

  function cargar() { /* no necesita recargar datos */ }

  function iniciar() {
    opcionesSeveridad($("cf-umbral"), false, 4);
    $("form-config").addEventListener("submit", (ev) => {
      ev.preventDefault();
      intentar(() => {
        const r = api("POST", "/api/config/generate", {
          marca: $("cf-marca").value, ip_colector: $("cf-ip").value, puerto: Number($("cf-puerto").value),
          umbral: Number($("cf-umbral").value), interfaz_origen: $("cf-interfaz").value, ntp: $("cf-ntp").value });
        $("cf-salida").textContent = r.plantilla;
        $("cf-validacion").textContent = `Validación ${r.marca}: ${r.validacion} · ${r.aviso}`;
      });
    });
    $("cf-copiar").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText($("cf-salida").textContent); avisar("Plantilla copiada"); }
      catch (_) { avisar("No se pudo copiar automáticamente; seleccione el texto y use Ctrl+C", "error"); }
    });
  }

  NOC.vistas.configuraciones = { iniciar, cargar };
})(window.NOC);
