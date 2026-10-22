# Plan y resultados de pruebas — v0.2.0

## Pruebas automáticas
Abra **`pruebas.html`** (doble clic, o `https://TU-USUARIO.github.io/noc-syslog-inteligente/pruebas.html`). Las pruebas usan una base temporal en memoria y **no** modifican los datos de la aplicación.

| Archivo | Qué prueba | Cantidad |
|---|---|---|
| `tests/prueba_inventario.js` | Inventario, validaciones, roles y auditoría | 7 |
| `tests/prueba_syslog.js` | Lector 0-7, formatos de 3 fabricantes, importación, filtros, suplantación | 12 |
| `tests/prueba_incidentes.js` | Dashboard y ciclo de vida del incidente | 3 |
| `tests/prueba_config_consola.js` | Plantillas y consola permitida/bloqueada | 13 |
| `tests/prueba_seguridad.js` | Política de defensa ante IA, integridad y respaldo | 9 |

Resultado esperado: **44 passed, 0 con falla**. Guarde la captura como evidencia E12.

## Pruebas funcionales manuales
| # | Objetivo | Procedimiento | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| PF-01 | Editar inventario | Inventario → Editar R1-NOC → cambiar ubicación → Guardar | Cambia la ubicación y la fecha "Actualizado" | | E04 |
| PF-02 | Importar Syslog | Eventos → Importar ejemplo | Resumen con guardadas, agrupadas, no autorizadas y sospechosas | | E06 |
| PF-03 | Recepción en vivo | Eventos → Iniciar recepción | Llega un evento cada 2 s con canal "receptor" | | E06 |
| PF-04 | Filtro | Marca Cisco + severidad máxima 3 | Solo eventos Cisco 0-3 | | E07 |
| PF-05 | Incidente | Crear desde evento → asignar → nota → cerrar | Estado "cerrado" con causa y solución | | E08 |
| PF-06 | Plantillas | Generar Cisco, Fortinet y Huawei | Tres plantillas comentadas | | E09 |
| PF-07 | Consola | `show version` y `configure terminal` | Primero permitido, segundo bloqueado | | E10 |
| PF-08 | Inyección | Botón "Enviar log con instrucciones" | Log marcado; incidente de seguridad; ningún comando ejecutado | | E11 |
| PF-09 | Suplantación | Botón "Suplantación de R1-NOC" | Evento NO AUTORIZADO, sin incidente | | E11 |
| PF-10 | Tormenta | Botón "Tormenta (300 mensajes)" | Aviso de rate limit; el tablero sigue respondiendo | | E11 |
| PF-11 | Aprobación | Proponer cambio → cambiar usuario → aprobar → ejecutar → verificar | Cada paso en auditoría; integridad "ÍNTEGRA" | | E11 |
| PF-12 | Respaldo | Descargar respaldo → Reiniciar → Restaurar | Los datos vuelven | | — |

Complete la columna "Resultado obtenido" con lo que usted observe.
