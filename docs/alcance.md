# Alcance del proyecto — NOC Syslog Inteligente v0.2.0 (MVP)

**Estudiante:** Daniel Camilo Peña Pulido · **Asignatura:** Administración y Gestión de Redes · **Docente:** Ing. John Harold Pérez Calderón · **Periodo:** 2026-2

## 1. Problema
En una red con equipos de varios fabricantes (Cisco, Fortinet, Huawei), los mensajes de estado y de error quedan dispersos en cada equipo. Nadie los ve a tiempo, no se sabe cuáles son graves y no queda registro de quién atendió cada falla ni de qué cambios se hicieron. Además, si se usa un asistente de inteligencia artificial para ayudar en la operación, existe el riesgo de que un log manipulado le "ordene" acciones dañinas.

> **Frase del problema:** el operador necesita detectar y registrar los eventos de red en un solo lugar para responder con trazabilidad y sin permitir cambios no autorizados.

## 2. Objetivo general
Desarrollar una aplicación web tipo NOC que reciba, clasifique y muestre eventos Syslog de equipos multivendor, gestione incidentes y aplique controles de seguridad frente a acciones de agentes de IA.

## 3. Objetivos específicos
1. Mantener un inventario editable de los equipos de red.
2. Recibir (receptor en vivo) e importar (archivo) mensajes Syslog y clasificarlos por equipo, fabricante, fecha, facility y severidad 0-7.
3. Mostrar en un tablero el estado de los equipos, los eventos recientes y críticos, y los incidentes.
4. Gestionar incidentes: creación, asignación, seguimiento y cierre.
5. Generar configuraciones Syslog comentadas para Cisco, Fortinet y Huawei.
6. Ofrecer una consola simulada de solo lectura con lista de comandos permitidos y bloqueados.
7. Aplicar una política inicial de defensa frente a agentes de IA con aprobación humana y auditoría.

## 4. Alcance (incluido en v0.2.0)
| Función | Estado |
|---|---|
| Inventario editable con fecha de actualización | Incluido |
| Receptor Syslog en vivo (simulado, valida IP de origen) e importación de archivos | Incluido |
| Clasificación de severidades 0-7 y facility | Incluido |
| Dashboard con contadores, estado, eventos e incidentes | Incluido |
| Filtros por fecha, marca, equipo, severidad y texto | Incluido |
| Incidentes: crear, asignar, seguimiento, cerrar | Incluido |
| Plantillas Syslog Cisco / Fortinet / Huawei | Incluido |
| Consola tipo PuTTY simulada (solo lectura) | Incluido |
| Política de defensa ante IA + auditoría con hash | Incluido |

## 5. Datos
Todos los equipos y eventos son **SIMULADOS** y están marcados como tales. Las direcciones IP son de documentación (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) y no pertenecen a ninguna red real.

## 6. Limitaciones y pendientes (Corte 3)
- La aplicación es **solo HTML, CSS y JavaScript**: no necesita instalación y se publica en GitHub Pages.
- Un navegador no puede abrir el puerto UDP 514; por eso la recepción "en vivo" es un **receptor simulado** y los logs reales se cargan **importando archivos** exportados de un colector (por ejemplo rsyslog).
- Los datos se guardan en el navegador (localStorage): son por equipo y por navegador. Se mitiga con respaldo/restauración en JSON.
- No hay conexión SSH real: la ejecución de cambios es simulada.
- Los roles se eligen en la interfaz (RBAC simulado); falta inicio de sesión con contraseña.
- Sin alertas por Telegram (previstas para la v1.0.0, requieren un backend para no exponer el token).
- UDP no confirma entrega ni cifra (RFC 5426); TLS (RFC 5425) queda como mejora del colector.
