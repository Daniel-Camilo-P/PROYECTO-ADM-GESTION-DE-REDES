/* =============================================================
   js/nucleo/configuraciones.js - Plantillas Syslog comentadas (Fase 5, RF-06, HU-04)

   Produce una PLANTILLA de texto para Cisco IOS/IOS XE, Fortinet FortiOS
   y Huawei VRP. La aplicación NO se conecta a ningún equipo: el
   administrador revisa la plantilla con la documentación oficial y la
   aplica con autorización, respaldo previo y plan de reversa.

     POST /api/config/generate  {marca, ip_colector, umbral, puerto, interfaz_origen, ntp}
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const S = NOC.seguridad;

  // Cómo llama cada fabricante a cada nivel de severidad (0 a 7)
  const NIVELES = {
    Cisco: ["emergencies", "alerts", "critical", "errors", "warnings", "notifications", "informational", "debugging"],
    Fortinet: ["emergency", "alert", "critical", "error", "warning", "notification", "information", "debug"],
    Huawei: ["emergencies", "alert", "critical", "error", "warning", "notification", "informational", "debugging"],
  };
  const INTERFAZ_VALIDA = /^[A-Za-z][A-Za-z0-9/.-]{0,40}$/;
  const ADVERTENCIA = [
    "PLANTILLA GENERADA POR NOC SYSLOG INTELIGENTE v0.2.0 - USO ACADÉMICO",
    "ANTES DE APLICAR: 1) identifique modelo y versión  2) consulte la guía oficial",
    "3) haga backup  4) pruebe en laboratorio  5) obtenga autorización  6) tenga plan de reversa",
  ];

  function cisco(ip, puerto, nivel, umbral, interfaz, ntp) {
    const c = "!";
    return [
      ...ADVERTENCIA.map((l) => `${c} ${l}`),
      `${c} Fabricante: Cisco IOS / IOS XE. Verificar versión con: show version`,
      c,
      "configure terminal",
      `${c} Hora exacta en cada log (necesaria para la auditoría y la correlación)`,
      " service timestamps log datetime msec localtime show-timezone",
      ntp ? ` ntp server ${ntp}` : ` ${c} ntp server <IP_SERVIDOR_NTP>   ! recomendado: sincronizar la hora`,
      `${c} Destino de los logs: el colector del NOC`,
      ` logging host ${ip} transport udp port ${puerto}`,
      `${c} Umbral: se envían los mensajes de severidad ${umbral} (${nivel}) hacia abajo (más graves)`,
      ` logging trap ${nivel}`,
      `${c} Interfaz de origen fija: el NOC siempre ve la misma IP de este equipo`,
      interfaz ? ` logging source-interface ${interfaz}` : ` ${c} logging source-interface Loopback0`,
      `${c} Identifica el equipo por su nombre dentro del mensaje`,
      " logging origin-id hostname",
      `${c} Guarda una copia local en memoria por si falla la red`,
      " logging buffered 16384 informational",
      "end",
      `${c} VERIFICAR: show logging   (debe aparecer el host ${ip} y el nivel ${nivel})`,
      `${c} GUARDAR solo después de verificar y con autorización: copy running-config startup-config`,
      `${c} REVERSA: configure terminal / no logging host ${ip} / end`,
    ];
  }

  function fortinet(ip, puerto, nivel, umbral, interfaz, ntp) {
    const c = "#";
    return [
      ...ADVERTENCIA.map((l) => `${c} ${l}`),
      `${c} Fabricante: Fortinet FortiOS. Verificar versión con: get system status`,
      `${c} La sintaxis puede variar según la versión de FortiOS.`,
      `${c} Hora exacta: sincronizar por NTP`,
      "config system ntp",
      "    set ntpsync enable",
      ...(ntp ? ["    set type custom", "    config ntpserver", "        edit 1", `            set server "${ntp}"`, "        next", "    end"]
        : [`    ${c} set type fortiguard   (o custom con su servidor NTP)`]),
      "end",
      `${c} Destino de los logs: el colector del NOC`,
      "config log syslogd setting",
      "    set status enable",
      `    set server "${ip}"`,
      `    set port ${puerto}`,
      "    set mode udp",
      "    set facility local7",
      `    set source-ip "<IP_DE_${interfaz || "LA_INTERFAZ_DE_GESTION"}>"   ${c} IP de gestión del FortiGate`,
      "end",
      `${c} Umbral: se envían los mensajes de nivel ${nivel} (${umbral}) y más graves`,
      "config log syslogd filter",
      `    set severity ${nivel}`,
      "end",
      `${c} VERIFICAR: show log syslogd setting  /  show log syslogd filter`,
      `${c} REVERSA: config log syslogd setting / set status disable / end`,
    ];
  }

  function huawei(ip, puerto, nivel, umbral, interfaz, ntp) {
    const c = "#";
    return [
      ...ADVERTENCIA.map((l) => `${c} ${l}`),
      `${c} Fabricante: Huawei VRP. Verificar versión con: display version`,
      `${c} En algunas plataformas VRP se requiere 'commit' después de los cambios.`,
      "system-view",
      `${c} Hora exacta: sincronizar por NTP`,
      ntp ? ` ntp-service unicast-server ${ntp}` : ` ${c} ntp-service unicast-server <IP_SERVIDOR_NTP>`,
      `${c} Activa el centro de información (motor de logs de Huawei)`,
      " info-center enable",
      `${c} Interfaz de origen fija para los mensajes`,
      interfaz ? ` info-center loghost source ${interfaz}` : ` ${c} info-center loghost source LoopBack0`,
      `${c} Destino de los logs: el colector del NOC (facility local7)`,
      ` info-center loghost ${ip} facility local7` + (puerto !== 514 ? ` port ${puerto}` : ""),
      `${c} Umbral: canal 'loghost' envía nivel ${nivel} (${umbral}) y más graves`,
      ` info-center source default channel loghost log level ${nivel}`,
      " quit",
      `${c} VERIFICAR: display info-center`,
      `${c} GUARDAR solo después de verificar y con autorización: save`,
      `${c} REVERSA: system-view / undo info-center loghost ${ip} / quit`,
    ];
  }

  const GENERADORES = { Cisco: cisco, Fortinet: fortinet, Huawei: huawei };
  const VALIDACION = {
    Cisco: "show logging muestra el host y el nivel; revise hora y source-interface.",
    Fortinet: "show log syslogd setting y show log syslogd filter. La sintaxis depende de FortiOS.",
    Huawei: "display info-center. VRP puede requerir canal, nivel y commit según plataforma.",
  };

  NOC.ruta("POST", "/api/config/generate", null, ({ cuerpo }) => {
    const errores = [];
    const marca = cuerpo.marca;
    const ip = String(cuerpo.ip_colector || "").trim();
    if (!GENERADORES[marca]) errores.push("Marca inválida: use Cisco, Fortinet o Huawei.");
    if (!S.ipValida(ip)) errores.push("La IP del colector no es válida.");
    const umbral = Number(cuerpo.umbral ?? 4);
    const puerto = Number(cuerpo.puerto ?? 514);
    if (!Number.isInteger(umbral) || umbral < 0 || umbral > 7 || !Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
      errores.push("Umbral (0-7) o puerto (1-65535) inválido.");
    }
    const interfaz = String(cuerpo.interfaz_origen || "").trim();
    if (interfaz && !INTERFAZ_VALIDA.test(interfaz)) errores.push("Nombre de interfaz inválido (ejemplo: Loopback0).");
    const ntp = String(cuerpo.ntp || "").trim();
    if (ntp && !S.ipValida(ntp)) errores.push("La IP del servidor NTP no es válida.");
    if (errores.length) throw new NOC.ErrorNOC(400, errores);

    const nivel = NIVELES[marca][umbral];
    return {
      marca, nivel, umbral,
      plantilla: GENERADORES[marca](ip, puerto, nivel, umbral, interfaz, ntp).join("\n"),
      validacion: VALIDACION[marca],
      aviso: "Plantilla NO aplicada. Requiere revisión humana y autorización.",
    };
  });

  NOC.configuraciones = { NIVELES };
})(window.NOC);
