/* Pruebas del generador de configuraciones y la consola (Fase 5 - RF-06, RF-07) */
(function (NOC) {
  const { grupo, esperar, esperarError, como } = NOC.pruebas;
  const api = NOC.api;

  const plantilla = (marca, esperado) => [`Plantilla ${marca} correcta`, () => {
    const r = api("POST", "/api/config/generate", { marca, ip_colector: "192.0.2.250", umbral: 4 });
    esperar(r.plantilla.includes(esperado), `Falta: ${esperado}`);
    esperar(r.plantilla.includes("ANTES DE APLICAR") && r.nivel.includes("warning"));
  }];
  const bloqueado = (comando) => [`Bloquea "${comando}"`, () => {
    esperar(api("POST", "/api/console/exec", { perfil: "cisco_ios", comando }).decision === "bloqueado");
  }];

  grupo("Configuraciones y consola", 5, ["configuraciones", "consola"], [
    plantilla("Cisco", "logging host 192.0.2.250"),
    plantilla("Fortinet", 'set server "192.0.2.250"'),
    plantilla("Huawei", "info-center loghost 192.0.2.250"),
    ["Rechaza una IP de colector inválida", () => {
      esperarError(() => api("POST", "/api/config/generate", { marca: "Cisco", ip_colector: "no-es-ip" }), 400);
    }],
    ["Permite comandos de lectura", () => {
      como("operador");
      const r = api("POST", "/api/console/exec", { perfil: "cisco_ios", comando: "show version" });
      esperar(r.decision === "permitido" && r.salida.includes("SIMULACIÓN"));
    }],
    bloqueado("configure terminal"),
    bloqueado("write erase"),
    bloqueado("reload"),
    bloqueado("copy run start"),
    ["Deniega por defecto lo desconocido", () => {
      const r = api("POST", "/api/console/exec", { perfil: "huawei", comando: "comando-inventado" });
      esperar(r.decision === "bloqueado" && r.motivo.includes("denegar por defecto"));
    }],
    ["Bloquea caracteres peligrosos", () => {
      esperar(api("POST", "/api/console/exec", { perfil: "cisco_ios", comando: "show version; reload" }).decision === "bloqueado");
    }],
    ["En ROMMON no acepta comandos de IOS", () => {
      const r = api("POST", "/api/console/exec", { perfil: "cisco_rommon", comando: "show version" });
      esperar(r.decision === "bloqueado" && r.motivo.includes("ROMMON"));
    }],
    ["Todo comando queda auditado", () => {
      api("POST", "/api/console/exec", { perfil: "fortinet", comando: "get system status" });
      api("POST", "/api/console/exec", { perfil: "fortinet", comando: "execute reboot" });
      esperar(NOC.datos.tabla("command_audit").length === 2);
    }],
  ]);
})(window.NOC);
