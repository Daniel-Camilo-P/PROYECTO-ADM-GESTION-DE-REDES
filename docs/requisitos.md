# Requisitos — NOC Syslog Inteligente v0.2.0

Prioridad con método **MoSCoW**: **M** = debe (Must), **S** = debería (Should), **C** = podría (Could), **W** = no se hará aún (Won't).

## Requisitos funcionales
| ID | Requisito | Prioridad | Criterio de aceptación | Prueba |
|---|---|---|---|---|
| RF-01 | Registrar, editar y eliminar equipos del inventario | M | Al guardar, el equipo aparece con su fecha de actualización | `prueba_inventario.js` |
| RF-02 | Recibir (receptor en vivo simulado) o importar (archivo) mensajes Syslog | M | El archivo de ejemplo se importa y muestra un resumen; el receptor valida la IP de origen | `prueba_syslog.js` |
| RF-03 | Normalizar fecha, host, marca, facility y severidad | M | `<187>` se interpreta como facility 23 (local7), severidad 3 | `prueba_syslog.js` |
| RF-04 | Visualizar estado, eventos e incidentes en un tablero | M | El dashboard muestra contadores y tablas | `prueba_incidentes.js` |
| RF-05 | Abrir, asignar, actualizar y cerrar incidentes | M | No se cierra sin causa y solución; cerrado no se modifica | `prueba_incidentes.js` |
| RF-06 | Generar configuraciones comentadas por fabricante | M | Cisco, Fortinet y Huawei incluyen IP, nivel y advertencia | `prueba_config_consola.js` |
| RF-07 | Ofrecer consola simulada controlada | M | `show version` permitido; `configure terminal` bloqueado | `prueba_config_consola.js` |
| RF-08 | Conservar auditoría y verificar su integridad | M | Alterar una fila hace fallar la verificación | `prueba_seguridad.js` |
| RF-09 | Notificar por Telegram | W (Corte 3) | — | — |

## Requisitos no funcionales
| ID | Requisito | Cómo se cumple |
|---|---|---|
| RNF-01 Seguridad | Sin secretos en el código | La aplicación no guarda contraseñas ni tokens; los secretos que llegan en logs se enmascaran |
| RNF-02 Usabilidad | Navegación sin manual extenso | Una página con 7 pestañas |
| RNF-03 Trazabilidad | Cada evento y acción con fecha y actor | Tablas `events`, `incident_notes`, `audit_trail` (hash SHA-256) |
| RNF-04 Confiabilidad | Errores controlados | Errores con código (400, 403, 404, 409) y mensaje claro; un mensaje malo no rompe el lector |
| RNF-05 Portabilidad | Instalación reproducible | Sin instalación: doble clic en `index.html` o enlace de GitHub Pages |
| RNF-06 Mantenibilidad | Módulos y comentarios | Núcleo (`js/nucleo/`) separado de la interfaz (`js/vistas/`) |
| RNF-07 Rendimiento | El tablero no se bloquea | Deduplicación, rate limit y consultas con límite |
| RNF-08 Recuperación | Copia y reversa | Respaldo/restauración JSON; plantillas incluyen comando de reversa |
