/* =============================================================
   js/nucleo/config.js - Configuración y política del NOC (Fase 1)

   Aquí se cambian los valores de la política sin tocar el resto del
   código. Esta aplicación NO guarda contraseñas ni tokens: todo corre
   en el navegador y los datos son SIMULADOS.
   ============================================================= */
window.NOC = window.NOC || {};

NOC.config = {
  VERSION: "0.2.0",
  AUTOR: "Daniel Camilo Peña Pulido",

  // Política de severidades (0 = más grave, 7 = depuración)
  INCIDENTE_HASTA_SEVERIDAD: 2,   // 0-2 crean incidente automáticamente
  ALERTA_HASTA_SEVERIDAD: 3,      // 0-3 se muestran como alerta

  // Control de tormentas de eventos
  LIMITE_POR_MINUTO: 120,         // máximo de mensajes por origen por minuto
  VENTANA_DEDUP_SEGUNDOS: 60,     // mensajes idénticos en esta ventana se agrupan

  // Minutos sin eventos para marcar un equipo "sin comunicación"
  MINUTOS_SIN_COMUNICACION: 30,

  // Retención: máximo de eventos guardados (los más viejos se eliminan)
  MAX_EVENTOS: 5000,

  // Límites de importación
  MAX_LINEAS_IMPORTACION: 5000,
  MAX_BYTES_ARCHIVO: 1024 * 1024, // 1 MB

  // Tiempo máximo de atención (SLA) según severidad, en minutos
  SLA_POR_SEVERIDAD: { 0: 15, 1: 30, 2: 60, 3: 240, 4: 480 },
};
