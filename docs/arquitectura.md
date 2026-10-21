# Arquitectura y diagramas — NOC Syslog Inteligente v0.2.0

> GitHub dibuja automáticamente los diagramas de este archivo (formato Mermaid).

La aplicación está hecha **solo con HTML, CSS y JavaScript**. Corre completa en el navegador: no necesita servidor ni instalación. Se abre con doble clic en `index.html` o desde GitHub Pages.

## 1. Arquitectura general
```mermaid
flowchart LR
    subgraph Fuentes["Fuentes de eventos (SIMULADAS)"]
        RX[Receptor en vivo<br>mensajes con IP de origen]
        ARCH[Archivo .log importado]
        SIM[Simulador de eventos]
    end
    RX & ARCH & SIM --> ING[Motor de ingreso<br>ingreso.js]
    ING --> PAR[Lector Syslog<br>syslog.js]
    ING --> SEG[Controles<br>seguridad.js]
    ING --> API
    subgraph Nucleo["Núcleo (js/nucleo)"]
        API[API interna con roles<br>api.js]
        DAT[(Datos del navegador<br>localStorage · datos.js)]
        API --> DAT
    end
    VIS[Interfaz por pestañas<br>index.html + js/vistas] -->|NOC.api| API
    OP((Operador /<br>Administrador)) --> VIS
```

**Idea clave:** la interfaz nunca toca los datos directamente. Todo pasa por la **API interna** (`NOC.api("POST", "/api/devices", ...)`), que revisa el rol, valida los datos y registra la auditoría. En el Corte 3 esa API se puede mover a un servidor real sin cambiar la interfaz.

## 2. Flujo de un evento (política)
```mermaid
flowchart TD
    E[1. Ingreso: receptor, archivo o simulador] --> RL{2. ¿Supera el límite<br>por minuto?}
    RL -- Sí --> D[Descartar + aviso de tormenta]
    RL -- No --> N[3. Leer: fecha, host,<br>facility, severidad]
    N --> V{4. ¿Origen autorizado?<br>IP en el inventario}
    V -- No --> NA[Guardar como NO AUTORIZADO<br>+ evento de seguridad]
    V -- Sí --> L[5. Enmascarar secretos y<br>buscar instrucciones escondidas]
    L --> DD{6. ¿Repetido en 60 s?}
    DD -- Sí --> AG[Sumar repetición]
    DD -- No --> G[Guardar evento]
    G --> SV{7. ¿Severidad 0-2 o sospechoso?}
    SV -- Sí --> INC[Crear o actualizar incidente]
    SV -- No --> FIN[Mostrar en el tablero]
    INC --> FIN
```

## 3. Flujo seguro de cambios (obligatorio)
```mermaid
flowchart LR
    A[Evento detectado] --> B[Validación] --> C[Propuesta de acción] --> D[Revisión humana]
    D --> E{Aprobación<br>administrador distinto}
    E -- Rechazada --> X[Fin + auditoría]
    E -- Aprobada --> F[Ejecución autorizada<br>SIMULADA en MVP] --> G[Verificación] --> H[Auditoría con hash]
```

## 4. Módulos
| Archivo | Fase | Responsabilidad |
|---|---|---|
| `index.html` | 1 | Estructura de la página y pestañas |
| `css/estilos.css` | 1 | Diseño visual |
| `js/nucleo/config.js` | 1 | Valores de la política (severidades, límites, SLA) |
| `js/nucleo/datos.js` | 1 | Almacén de datos, equipos simulados, respaldo |
| `js/nucleo/api.js` | 1 | API interna: rutas, roles y errores |
| `js/ui.js` | 1 | Utilidades de interfaz y navegación |
| `js/nucleo/seguridad.js` | 2 | Validación, inyección, secretos, rate limit, SHA-256, auditoría |
| `js/nucleo/inventario.js` + `js/vistas/inventario.js` | 2 | Inventario (CRUD) |
| `pruebas.html` + `tests/` | 2-6 | Pruebas automáticas en el navegador |
| `js/nucleo/syslog.js` | 3 | Lee mensajes Syslog de 5 formatos |
| `js/nucleo/ingreso.js` | 3 | Política de ingreso de eventos |
| `js/nucleo/eventos.js` + `js/vistas/eventos.js` | 3 | Receptor, importación, filtros |
| `js/nucleo/incidentes.js` + `js/vistas/incidentes.js`, `dashboard.js` | 4 | Incidentes y tablero |
| `js/nucleo/configuraciones.js` + vista | 5 | Plantillas Cisco / Fortinet / Huawei |
| `js/nucleo/consola.js` + vista | 5 | Consola simulada |
| `js/nucleo/acciones.js` + `js/vistas/seguridad.js` | 6 | Aprobación humana, auditoría, respaldo |
