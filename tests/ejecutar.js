/* =============================================================
   tests/ejecutar.js - Ejecuta las pruebas y muestra los resultados (Fase 2)
   ============================================================= */
(function (NOC) {
  "use strict";
  const $ = (id) => document.getElementById(id);

  function celda(texto, clase) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (clase) td.className = clase;
    return td;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!NOC.pruebas) return;
    const resultados = NOC.pruebas.ejecutar();
    const ok = resultados.filter((r) => r.estado === "ok").length;
    const fallas = resultados.filter((r) => r.estado === "falla").length;
    const omitidas = resultados.filter((r) => r.estado === "omitida").length;

    const tarjeta = (valor, nombre, clase) => {
      const d = document.createElement("div");
      d.className = `tarjeta ${clase}`;
      d.innerHTML = '<div class="valor"></div><div class="nombre"></div>';
      d.querySelector(".valor").textContent = valor;
      d.querySelector(".nombre").textContent = nombre;
      return d;
    };
    $("resumen").replaceChildren(
      tarjeta(`${ok} passed`, "Pruebas aprobadas", "verde"),
      tarjeta(String(fallas), "Pruebas con falla", fallas ? "rojo" : "verde"),
      tarjeta(String(omitidas), "Omitidas (fase no instalada)", omitidas ? "amarillo" : ""));
    $("fecha").textContent = `Ejecutado: ${NOC.datos.ahora()}`;

    const cuerpo = $("resultados");
    resultados.forEach((r) => {
      const tr = document.createElement("tr");
      const etiqueta = { ok: "✔ aprobada", falla: "✘ falla", omitida: "— omitida" }[r.estado];
      const clase = { ok: "prueba-ok", falla: "prueba-mal", omitida: "prueba-omitida" }[r.estado];
      tr.append(celda(String(r.fase)), celda(r.grupo), celda(r.titulo), celda(etiqueta, clase), celda(r.detalle, "nota"));
      cuerpo.appendChild(tr);
    });
    document.title = `${fallas ? "✘" : "✔"} ${ok} passed · Pruebas NOC`;
  });
})(window.NOC);
