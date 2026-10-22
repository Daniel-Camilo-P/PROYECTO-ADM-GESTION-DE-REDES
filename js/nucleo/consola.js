/* =============================================================
   js/nucleo/consola.js - Consola tipo PuTTY SIMULADA de solo lectura (Fase 5, RF-07)

   No existe conexión a ningún equipo. Las respuestas son textos de ejemplo.
   Reglas (política de comandos):
     1. LISTA PERMITIDA: solo se responden comandos de consulta conocidos.
     2. DENEGAR POR DEFECTO: cualquier otro comando se bloquea.
     3. Comandos de CAMBIO (configure, write, save, reload...) se bloquean y
        solo pueden quedar como PROPUESTA que un administrador debe aprobar.
     4. Caracteres peligrosos ( ; & ` $ > < | ) se rechazan siempre.
     5. CONTEXTO: en modo ROMMON los comandos de IOS no aplican y se marcan
        "no verificado" (evita la "alucinación operacional").
     6. Todo intento queda auditado: usuario, rol, equipo, comando y decisión.

     POST /api/console/exec     {perfil, comando, device_id}
     POST /api/console/propose  {perfil, comando, device_id, justificacion}
     GET  /api/console/profiles
   ============================================================= */
window.NOC = window.NOC || {};

(function (NOC) {
  "use strict";
  const D = NOC.datos;
  const S = NOC.seguridad;
  const SIM = "[SIMULACIÓN - salida de ejemplo, no proviene de un equipo real]\n";

  const PERFILES = {
    cisco_ios: {
      nombre: "Cisco IOS XE", prompt: "R1-NOC#", marca: "Cisco",
      permitidos: {
        "show version": SIM + "Cisco IOS XE Software, Version 17.09.04a\nR1-NOC uptime is 12 days, 4 hours\ncisco ISR4331/K9 (1RU) processor with 1795999K/6147K bytes of memory.",
        "show ip interface brief": SIM + "Interface              IP-Address      OK? Method Status   Protocol\nGigabitEthernet0/0/0   192.0.2.11      YES manual up       up\nGigabitEthernet0/0/1   unassigned      YES unset  down     down\nLoopback0              198.51.100.1    YES manual up       up",
        "show logging": SIM + "Syslog logging: enabled\n    Trap logging: level warnings\n    Logging to 192.0.2.250 (udp port 514), 152 message lines logged\nLog Buffer (16384 bytes):\n*Oct 16 18:00:01: %LINK-3-UPDOWN: Interface Gi0/0/1, changed state to down",
        "show clock": SIM + "*18:05:12.345 COT Fri Oct 16 2026",
        "show running-config | section logging": SIM + "logging buffered 16384 informational\nlogging trap warnings\nlogging host 192.0.2.250",
      },
      cambio: [/^conf(igure)?(\s+t(erminal)?)?$/, /^write/, /^copy\s/, /^reload/, /^erase/, /^delete/, /^format/, /^no\s/,
        /^interface\s/, /^username\s/, /^enable\s+secret/, /^logging\s/, /^shutdown/, /^clear\s/, /^debug/, /^boot\s/],
    },
    fortinet: {
      nombre: "FortiGate FortiOS", prompt: "FW-EDGE #", marca: "Fortinet",
      permitidos: {
        "get system status": SIM + "Version: FortiGate-60F v7.2.8,build1639\nHostname: FW-EDGE\nOperation Mode: NAT\nSystem time: Fri Oct 16 18:05:12 2026",
        "get system interface physical": SIM + "== [wan1]\n\tmode: static\tip: 203.0.113.2 255.255.255.252\tstatus: up\n== [internal]\n\tmode: static\tip: 192.0.2.21 255.255.255.0\tstatus: up",
        "show log syslogd setting": SIM + "config log syslogd setting\n    set status enable\n    set server \"192.0.2.250\"\nend",
        "get router info routing-table all": SIM + "S*  0.0.0.0/0 [10/0] via 203.0.113.1, wan1\nC   192.0.2.0/24 is directly connected, internal",
      },
      cambio: [/^config\s/, /^set\s/, /^unset\s/, /^delete\s/, /^edit\s/, /^execute\s/, /^end$/, /^purge/, /^diagnose\s+sys\s+kill/],
    },
    huawei: {
      nombre: "Huawei VRP", prompt: "<SW-CORE>", marca: "Huawei",
      permitidos: {
        "display version": SIM + "Huawei Versatile Routing Platform Software\nVRP (R) software, Version 5.170 (S5735 V200R021C00SPC100)\nHUAWEI S5735-L48T4S-A uptime is 30 days, 2 hours",
        "display ip interface brief": SIM + "Interface         IP Address/Mask    Physical  Protocol\nVlanif10          192.0.2.31/24      up        up\nLoopBack0         198.51.100.3/32    up        up(s)",
        "display info-center": SIM + "Information Center: enabled\nLog host:\n  192.0.2.250, channel number 2, channel name loghost, language English, host facility local7",
        "display clock": SIM + "2026-10-16 18:05:12\nFriday\nTime Zone(UTC-05:00) : UTC-05:00",
      },
      cambio: [/^system-view$/, /^sys$/, /^save/, /^reboot/, /^reset\s/, /^undo\s/, /^delete\s/, /^format\s/, /^info-center\s/, /^interface\s/, /^commit/],
    },
    cisco_rommon: {
      nombre: "Cisco ROMMON (recuperación)", prompt: "rommon 1 >", marca: "Cisco",
      permitidos: {
        "dev": SIM + "Devices in device table:\n\tid  name\n\tflash: flash",
        "dir flash:": SIM + "File size           Checksum   File name\n   519896532 bytes (0x1efd0f74)   isr4300-universalk9.17.09.04a.SPA.bin",
        "set": SIM + "PS1=rommon ! >\nBOOT=bootflash:isr4300-universalk9.17.09.04a.SPA.bin,1;",
      },
      cambio: [/^boot/, /^confreg/, /^reset/, /^[a-z_]+=/, /^tftpdnld/, /^unset/],
    },
  };

  const PELIGROSOS = /[;&`$<>]|\|\||\|(?!\s*section\s)/;
  const COMANDOS_IOS = /^(show|conf|configure|write|copy|enable|interface)\b/;
  const normalizar = (c) => S.limpiar(c, 200).replace(/\s+/g, " ").trim();

  /** Decide qué hacer con un comando. Devuelve {tipo, decision, motivo, salida}. */
  function evaluar(perfil, comando) {
    const p = PERFILES[perfil];
    const c = normalizar(comando);
    const bajo = c.toLowerCase();
    const r = (tipo, decision, motivo, salida = "") => ({ tipo, decision, motivo, salida });
    if (!c) return r("bloqueado", "bloqueado", "comando vacío");
    if (bajo === "help" || bajo === "?") {
      return r("lectura", "permitido", "ayuda", `Comandos permitidos en ${p.nombre} (solo lectura):\n` + Object.keys(p.permitidos).map((k) => "  " + k).join("\n"));
    }
    if (PELIGROSOS.test(c)) return r("bloqueado", "bloqueado", "caracteres no permitidos (; & ` $ < > |)");
    if (p.permitidos[bajo]) return r("lectura", "permitido", "en lista permitida", p.permitidos[bajo]);
    if (perfil === "cisco_rommon" && COMANDOS_IOS.test(bajo)) {
      return r("bloqueado", "bloqueado", "NO VERIFICADO: comando de IOS no válido en modo ROMMON (primero identifique fabricante, sistema y modo)");
    }
    if (p.cambio.some((patron) => patron.test(bajo))) {
      return r("bloqueado", "bloqueado", "comando de CAMBIO: solo se permite como propuesta con aprobación humana");
    }
    return r("bloqueado", "bloqueado", "no está en la lista permitida (denegar por defecto)");
  }

  function auditar(sesion, perfil, comando, deviceId, tipo, decision, motivo, justificacion = null, resultado = null) {
    const fila = D.insertar("command_audit", { fecha: D.ahora(), usuario: sesion.usuario, rol: sesion.rol, device_id: deviceId,
      perfil, comando, tipo, decision, motivo, justificacion, aprobado_por: null, aprobado_en: null, resultado });
    S.registrarAuditoria(sesion.usuario, `consola_${decision}`, "command_audit", fila.id, `[${perfil}] ${comando} -> ${motivo}`);
    return fila.id;
  }

  const idEquipo = (v) => (D.buscar("devices", v) ? Number(v) : null);

  NOC.ruta("GET", "/api/console/profiles", null, () => Object.fromEntries(Object.entries(PERFILES).map(([k, v]) =>
    [k, { nombre: v.nombre, prompt: v.prompt, marca: v.marca, permitidos: Object.keys(v.permitidos) }])));

  NOC.ruta("POST", "/api/console/exec", null, ({ cuerpo, usuario, rol }) => {
    if (!PERFILES[cuerpo.perfil]) throw new NOC.ErrorNOC(400, "Perfil inválido");
    const comando = normalizar(cuerpo.comando);
    const ev = evaluar(cuerpo.perfil, comando);
    if (!comando) return { decision: "bloqueado", motivo: ev.motivo, salida: "" };
    const id = auditar({ usuario, rol }, cuerpo.perfil, comando, idEquipo(cuerpo.device_id), ev.tipo, ev.decision, ev.motivo,
      null, ev.decision === "permitido" ? "salida simulada" : null);
    if (ev.decision === "bloqueado") S.registrarEventoSeguridad("comando_bloqueado", `[${cuerpo.perfil}] ${comando}: ${ev.motivo}`, null, usuario);
    return { decision: ev.decision, motivo: ev.motivo, salida: ev.salida, auditoria_id: id, puede_proponer: ev.motivo.includes("CAMBIO") };
  });

  /** Un comando de cambio NO se ejecuta: queda PENDIENTE de aprobación humana. */
  NOC.ruta("POST", "/api/console/propose", ["operador", "administrador"], ({ cuerpo, usuario, rol }) => {
    if (!PERFILES[cuerpo.perfil]) throw new NOC.ErrorNOC(400, "Perfil inválido");
    const comando = normalizar(cuerpo.comando);
    const justificacion = S.limpiar(cuerpo.justificacion, 300);
    if (!comando || !justificacion) throw new NOC.ErrorNOC(400, "Escriba el comando y la justificación del cambio.");
    if (PELIGROSOS.test(comando)) throw new NOC.ErrorNOC(400, "El comando tiene caracteres no permitidos.");
    const deviceId = idEquipo(cuerpo.device_id);
    if (!deviceId) throw new NOC.ErrorNOC(400, "Seleccione el equipo al que aplicaría el cambio.");
    const id = auditar({ usuario, rol }, cuerpo.perfil, comando, deviceId, "propuesta", "pendiente",
      "propuesta de cambio en espera de aprobación humana", justificacion);
    return { mensaje: "Propuesta registrada. Un administrador distinto debe aprobarla.", propuesta_id: id, decision: "pendiente" };
  });

  NOC.consola = { PERFILES, evaluar };
})(window.NOC);
