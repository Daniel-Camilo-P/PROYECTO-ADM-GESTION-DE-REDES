# Modelo de datos — NOC Syslog Inteligente v0.2.0

Los datos se guardan en el **navegador** (localStorage) como un objeto JSON con 7 "tablas" (listas). Se crean solas al abrir la aplicación. El detalle está comentado en `js/nucleo/datos.js`. Se pueden exportar e importar como respaldo `.json`.

```mermaid
erDiagram
    devices ||--o{ events : "genera"
    devices ||--o{ incidents : "afecta"
    events ||--o| incidents : "origina"
    incidents ||--o{ incident_notes : "seguimiento"
    devices ||--o{ command_audit : "comandos"

    devices {
        int id PK
        text nombre "hostname único"
        text ip "única"
        text marca "Cisco/Fortinet/Huawei/Otro"
        text modelo
        text version
        text ubicacion
        text estado "operativo/mantenimiento/fuera_de_servicio"
        text origen_dato "SIMULADO/REAL"
        text ultimo_evento
        text ultima_actualizacion
    }
    events {
        int id PK
        text fecha_evento
        text recibido_en
        int device_id FK
        text hostname
        text marca
        int facility
        int severidad "0 a 7"
        text mensaje
        text raw "dato no confiable"
        int repeticiones "deduplicación"
        int autorizado
        int sospechoso
        text canal "udp/importacion/simulador"
    }
    incidents {
        int id PK
        text titulo
        int severidad
        text estado "abierto/asignado/en_progreso/resuelto/cerrado"
        text responsable
        int device_id FK
        int event_id FK
        int sla_minutos
        text causa
        text solucion
        text cerrado_en
    }
    incident_notes {
        int id PK
        int incident_id FK
        text autor
        text nota
        text creado_en
    }
    command_audit {
        int id PK
        text usuario
        text rol
        int device_id FK
        text perfil
        text comando
        text tipo "lectura/bloqueado/propuesta"
        text decision "permitido/bloqueado/pendiente/aprobado/..."
        text aprobado_por
        text resultado
    }
    security_events {
        int id PK
        text fecha
        text tipo
        text detalle
    }
    audit_trail {
        int id PK
        text fecha
        text actor
        text accion
        text entidad
        text detalle
        text hash_prev
        text hash "SHA-256 encadenado"
    }
```
