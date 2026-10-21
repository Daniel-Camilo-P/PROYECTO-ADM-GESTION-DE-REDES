/* =============================================================
   js/ui.js - Utilidades de la interfaz y navegación por pestañas (Fase 1)

   Seguridad: TODO texto que viene de los datos (en especial los logs) se
   inserta con textContent, nunca como HTML. Así un log malicioso con
   <script> se muestra como texto y no se ejecuta.

   Cada pestaña tiene su archivo en js/vistas/. Si una vista todavía no
   está instalada (fases siguientes), se muestra un aviso en su lugar.
   ============================================================= */
window.NOC = window.NOC || {};
NOC.vistas = NOC.vistas || {};

(function (NOC) {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /** Crea un elemento HTML de forma segura. */
  function h(etiqueta, atributos, ...hijos) {
    const e = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(atributos || {})) {
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) e.setAttribute(k, v);
    }
    for (const hijo of hijos.flat()) {
      if (hijo === null || hijo === undefined || hijo === false) continue;
      e.appendChild(typeof hijo === "string" || typeof hijo === "number" ? document.createTextNode(String(hijo)) : hijo);
    }
    return e;
  }

  /** Llena el cuerpo de una tabla; si no hay filas muestra un mensaje. */
  function llenar(id, filas, columnas, mensajeVacio = "Sin datos") {
    const t = $(id);
    t.replaceChildren();
    if (!filas.length) {
      t.appendChild(h("tr", {}, h("td", { colspan: columnas }, h("span", { class: "vacio" }, mensajeVacio))));
      return;
    }
    filas.forEach((f) => t.appendChild(f));
  }

  const NOMBRES_SEV = ["Emergencia", "Alerta", "Crítico", "Error", "Advertencia", "Aviso", "Informativo", "Depuración"];
  const sev = (n) => h("span", { class: `sev sev-${n}`, title: NOMBRES_SEV[n] }, String(n));

  function estadoComunicacion(texto) {
    const clase = texto === "con comunicación" ? "bien" : texto === "sin comunicación" ? "mal" : "medio";
    return h("span", { class: `estado ${clase}` }, texto);
  }
  function estadoGeneral(texto) {
    const clase = ["cerrado", "resuelto", "verificado", "permitido"].includes(texto) ? "bien"
      : ["abierto", "bloqueado", "rechazado"].includes(texto) ? "mal" : "medio";
    return h("span", { class: `estado ${clase}` }, String(texto).replaceAll("_", " "));
  }

  let temporizador;
  function avisar(texto, tipo = "ok") {
    const a = $("aviso");
    a.textContent = texto;
    a.className = `aviso ${tipo}`;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => a.classList.add("oculto"), 5000);
  }

  /** Llama a la API interna con el usuario y rol elegidos arriba. */
  function api(metodo, url, cuerpo) {
    NOC.fijarSesion($("usuario").value, $("rol").value);
    try {
      return NOC.api(metodo, url, cuerpo);
    } catch (err) {
      if (err.estado === 404 && err.message === "Recurso no encontrado") {
        throw new Error("Esta función aún no está instalada (se agrega en una fase posterior).");
      }
      throw err;
    }
  }

  /** Ejecuta una función y muestra el error en pantalla si falla. */
  function intentar(funcion) {
    try {
      const r = funcion();
      if (r && typeof r.catch === "function") r.catch((err) => avisar(err.message, "error"));
      return r;
    } catch (err) {
      avisar(err.message, "error");
      return null;
    }
  }

  function opcionesSeveridad(select, conVacio, seleccionado) {
    select.replaceChildren();
    if (conVacio) select.appendChild(h("option", { value: "" }, "—"));
    NOMBRES_SEV.forEach((n, i) => {
      const o = h("option", { value: i }, `${i} - ${n}`);
      if (String(seleccionado) === String(i)) o.selected = true;
      select.appendChild(o);
    });
  }

  /** Llena un <select> con los equipos del inventario. */
  function opcionesEquipos(select, primera) {
    if (!select) return;
    let equipos = [];
    try { equipos = api("GET", "/api/devices"); } catch (_) { equipos = []; }
    const actual = select.value;
    select.replaceChildren();
    if (primera) select.appendChild(h("option", { value: "" }, primera));
    equipos.forEach((e) => select.appendChild(h("option", { value: e.id }, `${e.nombre} (${e.marca})`)));
    select.value = actual;
    if (select.selectedIndex < 0) select.selectedIndex = 0;
    return equipos;
  }

  /** Descarga un texto como archivo. */
  function descargar(nombre, texto, tipo = "application/json") {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
    const a = h("a", { href: url, download: nombre });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------------- Pestañas ----------------
  function abrirPestana(nombre) {
    document.querySelectorAll("#pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.tab === nombre));
    const seccion = $(`tab-${nombre}`);
    const vista = NOC.vistas[nombre];
    document.querySelectorAll(".tab").forEach((s) => s.classList.add("oculto"));
    const pendiente = $("pendiente");
    if (!vista) {
      // La vista aún no se ha instalado: se muestra un aviso en lugar de la sección
      let salud = "no responde";
      try { const s = NOC.api("GET", "/api/health"); salud = `${s.estado} · versión ${s.version} · ${s.equipos_en_inventario} equipos simulados en la base`; }
      catch (err) { salud = err.message; }
      pendiente.replaceChildren(h("p", {}, "Esta sección se instala en la ", h("b", {}, `Fase ${seccion.dataset.fase}`), "."),
        h("p", {}, "Copie los archivos de esa fase y recargue la página (F5)."),
        h("p", { class: "nota" }, `Estado del núcleo (/api/health): ${salud}`));
      pendiente.classList.remove("oculto");
    } else {
      pendiente.classList.add("oculto");
      seccion.classList.remove("oculto");
      intentar(() => vista.cargar());
    }
    try { localStorage.setItem("noc-pestana", nombre); } catch (_) { /* sin almacenamiento */ }
  }

  function arrancar() {
    NOC.datos.iniciar();
    $("pestanas").addEventListener("click", (e) => { if (e.target.dataset.tab) abrirPestana(e.target.dataset.tab); });
    $("rol").addEventListener("change", () => avisar(`Rol activo: ${$("rol").value}`));
    // Cada vista instalada prepara sus botones una sola vez
    Object.values(NOC.vistas).forEach((v) => { if (v.iniciar) intentar(() => v.iniciar()); });
    let inicial = "dashboard";
    try { inicial = localStorage.getItem("noc-pestana") || "dashboard"; } catch (_) { /* sin almacenamiento */ }
    abrirPestana($(`tab-${inicial}`) ? inicial : "dashboard");
  }

  NOC.ui = { $, h, llenar, sev, NOMBRES_SEV, estadoComunicacion, estadoGeneral, avisar, api, intentar,
    opcionesSeveridad, opcionesEquipos, descargar, abrirPestana };

  // Arranca cuando la página terminó de cargar (todas las vistas ya se registraron)
  document.addEventListener("DOMContentLoaded", arrancar);
})(window.NOC);
