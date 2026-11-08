# Historial de cambios

Todos los cambios notables de AguaVigía CTG. Las fechas son de Cartagena. El detalle de cada decisión está en [`docs/07-decisiones-clave.md`](docs/07-decisiones-clave.md).

## [1.0.0] — 2026-11-07

Primera entrega completa: backend, frontend y copia analítica. El trabajo sigue Gitflow (`feature/*` → `develop` → `release/*` → `main`).

### Añadido
- **Frontend completo (FE0 a FE7)**, por Yordy Pardo: mapa y ficha del barrio, reporte con foto, Cumplimiento, Bitácora, Estadísticas con gráficas e informe en PDF, Avisos, ingreso al panel con segundo factor, moderación, cortes, ingesta, administración, cuentas públicas y perfil del vecino, con accesibilidad (axe en cero), rendimiento medido y guion de la demo.
- **Datos aleatorios para la simulación (ADR-111).** Reportes, dispositivos, cortes con cierres por barrio y bitácora generados al azar, repetibles con semilla, solo en la instancia de simulación y siempre marcados como sintéticos (`sintetico: true`, cortes de origen `SINTETICO`). Rutas `POST` y `GET /api/sim/datos` y comandos `simulador datos generar` y `datos contar`.
- **Reportes en la copia analítica (ADR-112).** Reportes contados por barrio, día, tipo y estado de moderación, sin datos personales; vistas con `RANK()`, media móvil y `LAG`; rutas `GET /api/analitica/reportes/ranking` y `/tendencia`. La simulación copia a su propia base, `aguavigia_sim_analitica`.
- **Vigilante, bitácora inmutable y rol lector (ADR-113).** El vigilante compara Mongo y PostgreSQL barrio por barrio (pares, cierres, segundos de cierre y reportes) y avisa sin corregir; la bitácora se copia a una tabla que solo admite agregar y encadena el hash de cada fila; respaldo y restauración de `pg_dump` verificados; rol `aguavigia_lector` de solo lectura. Rutas `GET /api/analitica/bitacora/integridad` y `GET /api/veedor/analitica/vigilancia`.
- **Copia analítica del Índice de Cumplimiento en PostgreSQL (ADR-100).** Migraciones con Flyway, vistas y rutas `GET /api/analitica/cumplimiento`.
- Cuentas públicas y del panel con segundo factor (TOTP), moderación de reportes, ingesta de boletines de Acuacar con la frase exacta que los respalda, simulación de un día entero con aserciones (guion completo a x300 en CI) y métricas de calibración.

### Cambiado
- `GET /api/estadisticas`: `duracionPromedioHoras` es `null` (y la celda del CSV queda vacía) cuando no hay cortes cerrados, y el top de barrios se desempata por `sectorId` (issue #84).
- Las cuentas sintéticas de vecino bajan de 30 000 a 300 (ADR-111).
- Las pruebas de integración se llaman `*IT` y las ejecuta Failsafe (`./mvnw test` no necesita Docker; `./mvnw verify` sí).
- Flujo de trabajo Gitflow con `main` y `develop`, en lugar de ir directo a `main`.
- El job «Núcleo ciudadano contra backend real» del CI recibe la clave del ADMIN inicial y ejecuta las pruebas e2e del panel.

### Corregido
- Una prueba e2e de métricas del panel asumía que la muestra empezaba «hoy» y fallaba entre las 00:00 y las 06:00 de Cartagena.

### Fuera de esta versión
- Sensores IoT: construidos pero inactivos a propósito.
- Ruta `POST /api/sim/oleada` y las pantallas de verificar, invitar y restablecer dentro de la SPA (FE6b): no se hicieron; los correos siguen llevando a las páginas HTML del backend.
- La copia a PostgreSQL de la auditoría de cuentas (lleva IP e identificadores de personas).
- La prueba de los cinco segundos del frontend con otra persona.

## Anteriores

La historia previa a 1.0.0 está en las etiquetas `archivo/*` y `v1.0.0-backend-final` y en `git log`.
