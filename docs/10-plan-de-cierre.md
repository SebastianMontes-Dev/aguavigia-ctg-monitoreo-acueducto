# 10 · Plan de cierre: lo que falta para presentar el proyecto entero

**Estado: propuesto el 2026-11-06 (hora de Cartagena), sin ejecutar.** Parte de `origin/develop` en `3d48f238` (FE0–FE7 del frontend ya integradas) y de `origin/main` en `877a4871`.
Cierra tres frentes: **(A)** los pendientes que dejó Yordy y los que ya estaban abiertos, **(B)** PostgreSQL de punta a punta (fases 2 y 3 de
[09](09-postgresql-fase-1.md) §10) y **(C)** un volumen de datos aleatorios centrado en **reportes** y no en cuentas, que alimenta la simulación.
Al terminar, `main` lleva la etiqueta `v1.0.0` y el sistema arranca con un solo `docker compose up`.

## 0. Reglas de trabajo (las del profesor)

- **Gitflow, con `main` y `develop` protegidas** (PR #119). Nada se empuja a ninguna de las dos. Cada paso de este plan es una rama
  `feature/<tema>` desde `develop`, un PR a `develop`, revisión, aprobación y CI en verde; la rama se borra al fusionarse.
- La entrega es una rama `release/1.0.0` desde `develop`: solo correcciones y versión. Se fusiona a `main` con la etiqueta `v1.0.0` y vuelve a `develop`.
- Commit, push y PR solo cuando el dueño lo pida. Conventional Commits en español, sin firmas de IA (`scripts/verificar-autoria.sh origin/develop..HEAD` antes de cada PR).
- **Backend es de Sebastian; `frontend/` es de Yordy.** Todo cambio de contrato se anota en `docs/api/cambios-para-frontend.md` antes de fusionar y se le avisa qué adaptar (§5).
- Mongo sigue siendo la única fuente de verdad. PostgreSQL sigue siendo derivada (ADR-100); las fases nuevas no lo cambian.

## 1. Dónde estamos (verificado, no supuesto)

| Qué | Estado |
|---|---|
| Frontend FE0–FE7 | En `develop` (PR #130, #131); CI en verde. Falta la prueba de los cinco segundos con otra persona |
| `main` vs `develop` | Divergidas: nadie ha hecho release. `main` no tiene el frontend nuevo (por eso el Frontend CI de Dependabot #133 sale rojo) |
| PostgreSQL | Fase 1 hecha (copia del Índice, 4 tablas, 4 vistas, 3 rutas). Fases 2 y 3 **sin hacer** |
| Datos de ejemplo | Lo único inventado son **30 000 cuentas de vecino** (ADR-094). No hay reportes, cortes ni bitácora sintéticos |
| Simulación | `backend-sim` (8082, base `aguavigia_sim`), guion de ~12 min que crea 300 vecinos y un puñado de reportes por HTTP. Sin generador de volumen |
| Issues abiertos | #84 (duración media `0.0`), #66 y #67 (tareas de verificación de septiembre) |
| Rama suelta | `chore/launch-json-frontend` sin PR |

## 2. Frente C — Datos aleatorios con los reportes como protagonistas

**Por qué.** Una app de reportes de agua con 30 000 cuentas y casi ningún reporte se ve vacía justo donde está su propuesta. Lo correcto es poco de
cuentas y mucho de lo que el sistema hace: reportes, cortes, cierres, bitácora y avisos. Además, la simulación necesita volumen para que el mapa, el
Cumplimiento y las Estadísticas se vean vivos.

### C1 · Qué cambia y qué volumen

| Colección | Hoy | Meta (valores por defecto, todos configurables) |
|---|---|---|
| `usuarios` (vecinos sintéticos) | 30 000 | **300** (lo justo para listados y la nota "cuentas sintéticas"; los reportes no necesitan cuenta) |
| `reportes` | 0 | **60 000**, en los últimos 300 días (el TTL borra a los 365) |
| `dispositivos` | 0 | **9 000** (cada reporte lleva el `huella` de uno, como en la vida real) |
| `cortes` | 0 | **400**, con 1 a 8 barrios cada uno y cierres por barrio |
| `eventos_bitacora` | 0 | Derivados de los cortes y de los cambios de estado generados (~2 000) |
| `propuestas_ingesta` | 0 | **300**, con estados `PENDIENTE`, `APROBADA` y `DESCARTADA` |
| `suscripciones` | 0 | **500**, con correo de dominio reservado `.invalid`: nunca se envía nada |
| `documentos_fallidos`, `auditoria_cuentas` | 0 | Decenas, para que el panel del veedor tenga qué mostrar |

### C2 · Cómo se genera (aleatorio de verdad, y repetible si se quiere)

- **Dentro del backend**, no en un script que escriba en Mongo: igual que `ImportadorDeVecinosSinteticos` (ADR-094), para que pase por las reglas del dominio y el esquema no
  pueda divergir. Un caso de uso nuevo (`GenerarDatosSinteticosUseCase`) y un puerto de salida por colección que ya existe; en `domain/` solo Java puro (el sorteo recibe un `RandomGenerator`).
- **Semilla.** `aguavigia.siembra.semilla`: si viene, la corrida se repite idéntica (útil para pruebas y para la demo); si no, se sortea una y se **registra en el log y en `/api/sistema/modo`**.
- **Distribuciones con sentido**, no uniformes:
  - Reportes por barrio **proporcional a la población** y con "barrios calientes" sorteados (pocos barrios concentran muchos reportes).
  - Hora del día con curva (picos 06–09 y 18–21); más reportes en torno a un corte: ráfaga desde antes del inicio hasta horas después del fin.
  - Tipo `SIN_AGUA` / `PRESION_BAJA` en proporción sorteada por corte; moderación `APROBADO` ~70 %, `PENDIENTE` ~15 %, `DESCARTADO` ~15 %.
  - Verificación `CUENTA_VERIFICADA` / `UBICACION_VERIFICADA` / `NINGUNA` en proporciones sorteadas; `redHash` entre N redes sorteadas (hay "ráfagas" de una sola red para alimentar `senalRed`).
  - Coordenada **dentro del polígono del barrio** (se sortea en el rectángulo y se acepta si cae dentro; redondeo a 3 decimales como en ADR-090).
  - Cortes con duración prometida de 2 a 24 h; cada barrio cierra antes, a tiempo, tarde, `EXPIRADO` o `ANULADO` según una mezcla sorteada, de modo que el Índice de Cumplimiento tenga variedad real (barrios al 100 %, al 40 %, sin cierre).
- **Fechas en el pasado coherente.** Todo lo generado cae entre "hace 300 días" y "ahora" (en la simulación, "ahora" es el `RelojSimulado`).
- **Inserción por lotes de 1 000** en un hilo aparte tras el arranque, idempotente: si ya hay al menos N documentos marcados `sintetico`, no añade más.

### C3 · La regla ética que esto toca (hay que decirlo, no esconderlo)

ADR-094 decidió que **no hay reportes, cortes ni estados inventados** y que lo único sintético son las cuentas. Este plan **revierte esa parte**, así que va con ADR propio (**ADR-111**, siguiente libre) y estas garantías:

1. **Todo documento generado lleva `sintetico: true`** (reportes, dispositivos, cortes, eventos, propuestas, suscripciones) y un `origen` que lo declara. Los cortes sintéticos **no** usan `OFICIAL_ACUACAR`: nuevo valor `SINTETICO`, para no contradecir la regla 4 de la ética de datos (nada llega al mapa público sin la frase del boletín que lo respalde).
2. **En la instancia real, lo sintético no mueve el mapa**: el consenso, el estado de los barrios y el Índice público lo ignoran. Solo los reportes de vecinos reales cuentan. Lo sintético aporta volumen a listados, Estadísticas y panel, siempre rotulado.
3. **En la instancia de simulación (`modo = SIMULACION`) todo cuenta**: ahí el mapa vivo y el Índice se alimentan del volumen generado, y el banner de simulación ya lo anuncia.
4. `GET /api/sistema/modo` pasa de `cuentasSinteticas` a un bloque `datosSinteticos {cuentas, reportes, cortes, semilla}`. La interfaz dice "datos generados por el sistema", nunca "N personas reportaron".
5. Un interruptor: `aguavigia.siembra.*=0` apaga todo y el sistema queda como antes.

**Decisión que queda abierta (D-1):** si el dueño prefiere que la instancia real **no** genere nada (solo `backend-sim`), basta poner los valores por defecto del perfil `docker` en 0 y dejar el volumen en `backend-sim`. La recomendación es generarlo en las dos, con la regla 2, porque la presentación se verá más completa sin arriesgar el mapa.

### C4 · El endpoint de simulación

Se amplía `/api/sim/**` (protegido con `X-Sim-Key`, 404 fuera de la simulación):

| Ruta | Para qué |
|---|---|
| `POST /api/sim/datos` | Genera ahora un lote con `{reportes, cortes, dias, semilla}`; devuelve los conteos y la semilla usada |
| `GET /api/sim/datos` | Conteos de lo sintético por colección |
| `POST /api/sim/oleada` | Dispara una oleada en vivo sobre el reloj simulado: N reportes repartidos en un lapso, por el flujo real de consenso (para ver el mapa cambiar) |
| `POST /api/sim/reinicio` | Ya existe; borra también lo sintético y, si se pide, vuelve a generar |

Y en la línea de comandos del simulador: `simulador datos generar --reportes 20000 --cortes 100 --semilla 42` y `simulador oleada --barrio manga --reportes 40`. El guion de ~12 min gana un acto inicial "volumen" y una aserción de que los conteos cuadran.

### C5 · Pruebas

Unitarias del generador (semilla igual ⇒ mismo resultado; coordenadas dentro del polígono; fechas dentro del TTL; proporciones dentro de márgenes), una `*IT` con Mongo real (volumen reducido, índices y TTL intactos), una regla ArchUnit (el generador no toca `domain/` con Spring) y la paridad con PostgreSQL (§3) sobre datos generados. Prueba de rendimiento: el arranque con 60 000 reportes no pasa de los tiempos actuales del `healthcheck`.

## 3. Frente B — PostgreSQL completo

Hoy PostgreSQL solo copia el Índice. Con reportes en volumen, SQL tiene dónde lucir un modelo relacional de verdad. Se mantiene la regla: derivada, sin datos personales, si cae el sistema sigue.

### B1 · Modelo para los reportes (fase 2a)

Migración `V3__reportes_agregados.sql` en `analitica`:
- `reporte_dia` (`sector_id` FK, `dia`, `tipo`, `estado_moderacion`, `cantidad`): **agregado por barrio, día y tipo**. Sin coordenadas, `huella`, `redHash` ni fotos.
- Vistas con funciones de ventana: `v_ranking_barrios` (`RANK()` por reportes en 30 días), `v_tendencia_semanal` (promedio móvil de 7 días con `AVG() OVER`), `v_pico_horario` y `v_reportes_por_corte` (reportes aprobados dentro de la ventana de cada corte).
- Una vista materializada para el ranking, refrescada al final de cada copia.
- Rutas de solo lectura nuevas: `GET /api/analitica/reportes/ranking`, `/tendencia` y `/por-corte` (503 si PostgreSQL no está, igual que las actuales).

### B2 · Vigilante de integridad (fase 2b)

Un job que compara a fondo Mongo con PostgreSQL y lo anota: suma de control por barrio de los pares corte-barrio y de los agregados de reportes, referencias colgantes en los dos sentidos, conteos. Resultado en `analitica.vigilancia` y ruta `GET /api/veedor/analitica/vigilancia` (`VER_PANEL`). Una diferencia **avisa, no corrige**.

### B3 · Bitácora inmutable y respaldo (fase 3)

- Tabla `analitica.bitacora_inmutable` con los eventos públicos de la bitácora, **sin `UPDATE` ni `DELETE`**: un disparador que lanza excepción y `REVOKE` al usuario de la aplicación. Cada fila lleva el hash de la anterior (cadena), y una vista verifica la cadena.
- Auditoría de cuentas **sin IP ni identificadores de personas**: solo acción, fecha y tipo de sujeto.
- Respaldo y restauración **probados**: `scripts/backup-postgres.sh` / `restore-postgres.sh` con `pg_dump`, y una prueba que restaura en una base vacía y compara conteos y cadena. No se afirma que funciona hasta que corra.

### B4 · Datos abiertos (fase 3b)

Un rol `aguavigia_lector` con solo `SELECT` sobre las vistas públicas, para exportar y demostrar permisos ante el profesor. Se documenta la cadena de conexión en `docs/03`.

### B5 · Documentación y ADR

**ADR-112** (PostgreSQL fases 2 y 3: modelo de reportes, vigilante, bitácora inmutable), `docs/03` §4 y `docs/09` actualizados, y `docs/05` con el riesgo de `trust` ya aceptado (D1) y el rol de solo lectura.

## 4. Frente A — Pendientes del equipo

| # | Pendiente | Quién | Cómo |
|---|---|---|---|
| A1 | Claves del panel en el job "Núcleo ciudadano contra backend real" (`PANEL_CORREO`, `PANEL_CLAVE`, `RATE_LIMIT_FACTOR_CUENTAS: "10"`) | Backend | Aplicar la propuesta de [FE7 §6](frontend/FE7-integracion-y-entrega.md) en `.github/workflows/frontend-ci.yml`; es archivo compartido, se avisa a Yordy. **Hay que verlo correr en GitHub Actions**: solo se probó en local |
| A2 | Desempate de `EstadisticasMongoAdapter` (orden de barrios estable con empates) | Backend | Ordenar por cantidad descendente y, a igualdad, por `nombre`; prueba de empate; sin cambio de contrato |
| A3 | Issue #84: `duracionPromedioHoras` nulo sin cortes cerrados; contrato con `nullable: true`; describir bien `cantidadCortes` | Backend | Pasos del propio issue; es cambio de contrato: aviso a Yordy para quitar su esquive del `0` y regenerar tipos (`npm run api:sync`) |
| A4 | FE6b (pantallas de verificar, invitar y restablecer dentro de la SPA; `MailCuentaAdapter` apunta a la SPA) | Los dos | **Recomendado: no hacerla.** Decisión D-C de Yordy: los correos siguen llevando a las páginas HTML del backend y funciona. Se deja escrito como "fuera de alcance" en la entrega |
| A5 | Prueba de los cinco segundos con otra persona | Yordy y el dueño | No la puede hacer una IA. Pasos en FE7 §8; anotar el resultado con fecha |
| A6 | PR #133 (Dependabot, `mongodb` 7.8.0) | Backend | Se queda abierto hasta el release (su Frontend CI falla porque `main` aún no tiene el frontend nuevo); después se reintenta y se fusiona |
| A7 | Rama `chore/launch-json-frontend` | Dueño | PR a `develop` (son 17 líneas) o se descarta; lo decide el dueño |
| A8 | Issues #66 y #67 | Dueño | Están hechos de otra forma (CI y auditoría final); cerrarlos con una nota |
| A9 | `CLAUDE.md` local y memoria con la regla vieja de "directo a `main`" | Dueño | El `CLAUDE.md` de `develop` ya está al día; solo falta la memoria personal |

## 5. Contrato y aviso a Yordy (cambios que el plan introduce)

Todos van en una sección **F8** de [`cambios-para-frontend.md`](api/cambios-para-frontend.md), escrita **antes** de fusionar cada PR:

- `GET /api/sistema/modo`: `cuentasSinteticas` → `datosSinteticos {…}`. **Rompe**; el frontend lo usa en la nota de cuentas sintéticas y el banner.
- Respuestas de reportes, cortes y bitácora: campo `sintetico` (booleano) para rotularlos.
- Rutas nuevas de analítica (§3): `ranking`, `tendencia`, `por-corte`, `vigilancia`. Opcionales para la interfaz; `cobertura-contrato.mjs` exigirá marcarlas como excluidas o consumirlas.
- #84: `duracionPromedioHoras` nullable.
- `OrigenCorte` gana `SINTETICO`.

## 6. Orden de ejecución y puertas

Cada fila es una rama `feature/*` con su PR. Las puertas ("gate") son lo que debe estar verde antes de pasar a la siguiente.

| Paso | Rama | Contenido | Gate |
|---|---|---|---|
| 1 | `feature/plan-de-cierre` | Este documento | Aprobación del dueño de las decisiones D-1 y A4 |
| 2 | `feature/ci-claves-panel` | A1 | El job corre en Actions con las pruebas del panel activas |
| 3 | `feature/estadisticas-nulas-y-desempate` | A2, A3 | `./mvnw verify` verde; `api:check` verde; aviso a Yordy |
| 4 | `feature/generador-datos-sinteticos` | C1–C3, C5 + ADR-111 | Pruebas del generador y `*IT`; mapa real intacto con la regla 2 |
| 5 | `feature/simulacion-volumen` | C4 + guion | Guion completo y aserciones de conteo en verde a x300 |
| 6 | `feature/postgresql-reportes` | B1 + ADR-112 | `ParidadMongoPostgresIT` ampliada, vistas contra datos generados |
| 7 | `feature/postgresql-vigilante-y-bitacora` | B2, B3, B4 | Restauración probada; cadena verificada; rol de solo lectura probado |
| 8 | (Yordy) `feature/fe8-*` | Adaptar el frontend a §5 | Frontend CI verde; cinco segundos hecho (A5) |
| 9 | `feature/auditoria-final` | Ejecutar el [prompt de auditoría](prompts/auditoria-final-backend.md), corregir lo que salga | Auditoría sin hallazgos críticos abiertos |
| 10 | `release/1.0.0` | Versión, CHANGELOG, README, guion de demo | `docker compose down -v && docker compose up` desde cero deja todo listo; ensayo completo del guion; Trivy y gitleaks verdes |
| 11 | — | Fusión a `main` con etiqueta `v1.0.0` y vuelta a `develop`; cerrar #84, #66, #67; fusionar #133 | `main` y `develop` iguales |

Los pasos 2 y 3 pueden ir en paralelo (archivos distintos). 4 → 5 → 6 → 7 van en serie: cada uno usa los datos del anterior.

## 7. Verificación de cierre ("terminado cuando")

1. `cd backend && ./mvnw verify` verde (hoy ~2 142 pruebas más las nuevas); `cd scripts && npm test` verde; `cd frontend && npm run lint && npm run typecheck && npm run api:check && npm test && npm run build` verdes.
2. Desde volúmenes borrados, `docker compose up -d --build` deja los 211 barrios, los datos generados y el ADMIN inicial, sin tocar nada a mano.
3. `GET /api/sistema/modo` declara los conteos de lo sintético; la interfaz lo rotula.
4. Con `docker compose stop postgres` el sistema sigue `UP` y solo la analítica responde 503; al volver, se recupera.
5. El guion de la demo ([guion-demo.md](frontend/guion-demo.md)) corre de principio a fin en la instancia real y en `backend-sim`.
6. Backup y restauración de Mongo y PostgreSQL probados con comparación de conteos.
7. CI de `develop` y de `main` en verde, sin ADR ni documento que contradiga el código.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Presentar datos inventados como reales | Marca `sintetico` en cada documento, regla 2 en la instancia real, rótulo en la interfaz, ADR-111 |
| 60 000 reportes alargan el arranque o llenan memoria | Lotes de 1 000 en hilo aparte, valores configurables, prueba de arranque; bajar a 20 000 si hace falta |
| El TTL borra reportes generados | Fechas dentro de 300 días; prueba que lo verifica |
| La fórmula del Índice vuelve a existir en Java y SQL | Ya hay prueba de paridad; se amplía a los datos generados |
| Cambio de contrato rompe el frontend | Sección F8 antes de fusionar; Yordy adapta en su fase; `api:check` en el CI |
| Protección de ramas bloquea el release | Probar el flujo `release/*` → `main` con un PR de prueba antes del día de la entrega |
