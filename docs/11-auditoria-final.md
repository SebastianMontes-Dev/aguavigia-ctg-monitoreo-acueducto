# 11 · Auditoría final del backend (paso 9 del plan de cierre)

**Fecha:** 2026-11-08 (hora de Cartagena). **Base:** `develop` en `e7a20b48` (= `main` v1.0.0 más la retro-fusión y el ajuste de Dependabot).
**Alcance:** auditoría interna hecha por el equipo con ayuda de Claude, siguiendo el [prompt de auditoría](prompts/auditoria-final-backend.md) **en la parte que se puede
comprobar en una tarde sin tumbar el Docker de trabajo**. No es la auditoría independiente que el prompt describe: esa sigue disponible para quien la quiera lanzar. Lo que no se
comprobó está en §6; no se da por bueno.

## 1. Veredicto

**TERMINADO CON RESERVAS.** No se encontró ningún hallazgo Bloqueante ni Alto en lo que se pudo comprobar. Las reservas son: (1) hay dimensiones del prompt que no se ejecutaron (§6),
(2) la prueba de los cinco segundos con otra persona sigue sin hacerse y (3) las dos exenciones de Trivy vencen el 2026-12-31 y su corrección real exige Spring Boot 4.

**Nota del 2026-11-16:** el veredicto de arriba es el del 2026-11-08 y se queda como se emitió. Una semana después apareció el fallo H-6 (formularios del correo, hotfix `1.0.1`), que esta auditoría no detectó por no recorrer los flujos de una persona en un navegador real. Eso confirma que «sin hallazgos Bloqueantes ni Altos» se refería solo a lo que se comprobó.

## 2. Criterios de cierre

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | (B) `verify` verde y CI verde | **Cumple** | `./mvnw -B verify` en esta sesión: salida 0. Informes frescos: 214 clases / **1 619 pruebas unitarias**, 0 fallos, 0 omitidas; Failsafe 46 clases / **389 de integración**, 0 fallos, **1 omitida** (`ContratoOpenApiIT`, un ayudante que solo corre con `-Dopenapi.regenerar`, no una prueba). Cobertura JaCoCo: 95,2 % de instrucciones, 83,8 % de ramas. CI de `develop` (Backend CI, Contenedores y dependencias, Escaneo de secretos, Frontend CI, Simulación): todos `success` en `gh run list` |
| 2 | (B) RF y ADR con implementación y prueba | **No verificado** | No se armó la matriz RF → prueba / ADR → prueba (§6) |
| 3 | (B) Invariantes ante concurrencia y caídas | **No verificado** | Solo se apoya en las pruebas del repo; no se provocaron fallos a mano |
| 4 | (B) Contrato, código y `docs/api/` coinciden | **Cumple** | `node scripts/generar-referencia-api.mjs` → 91 operaciones, 65 esquemas y `git status` sin cambios en `docs/api/referencia-de-rutas.md`. El prompt decía 81 rutas: era una cifra vieja y se corrigió |
| 5 | (B) Sin vulnerabilidad sin exención, sin secretos, autorización en cada endpoint | **Cumple con reservas** | `SecurityConfig.java:159` termina en `anyRequest().denyAll()`. Un recorrido de todos los controladores buscando rutas `/api/veedor`, `/api/vecino`, `/admin`, `/sim`, `/iot`, `/api/analitica` sin `@PreAuthorize` dio solo `/api/sim/**` e `/api/iot/presion` (protegidos por clave propia, no por permiso) y dos falsos positivos de mi expresión (`FotoController` y `ReenvioDeEnlacesController` sí llevan el permiso: leído a mano). `git ls-files` no lista ningún `.env`, `.pem` ni `.key`; `.env` está en `.gitignore`; `docker-compose.yml` pasa `JWT_SECRET`, `IOT_KEY` y `VEEDOR_PASSWORD_HASH` sin valor. Reserva: Trivy y gitleaks no se ejecutaron en local (no están instalados); se apoya en sus jobs verdes del CI |
| 6 | (B) Ética de datos | **Cumple con reservas** | `AcuacarApiCollector.java:58-98` y `RssCollector.java:61-80` se niegan a funcionar con `User-Agent` vacío y lo envían en cada petición. Reserva: el código **no lee `robots.txt` en tiempo de ejecución**; el respeto a `robots.txt` descansa en la verificación manual de cada fuente (skill `verificar-fuente`) |
| 7 | (B) Índices, TTL, transacciones, respaldo | **Cumple con reservas** | Las IT con Mongo y PostgreSQL reales pasan (389). `BitacoraInmutableIT` y la verificación del respaldo de PostgreSQL se ejecutaron el 2026-11-06 (ADR-113). No se corrió `explain` de las consultas críticas ni se repitió el respaldo hoy |
| 8 | Arquitectura Limpia con ArchUnit no vacío | **Cumple con reservas** | `ReglaDeOroArchitectureTest` corre dentro de las 214 clases y pasa. No se revisó una por una que ninguna regla sea vacía |
| 9 | La guía de arranque reproduce un sistema sano desde cero | **No verificado** | No se hizo `docker compose down -v` hoy: el Docker de trabajo tiene datos |
| 10 | Deuda clasificada | **Cumple** | §5 |

## 3. Hallazgos

| Id | Severidad | Dónde | Qué ocurría | Estado |
|---|---|---|---|---|
| H-1 | Bajo | `docs/07` línea 15 | Decía «el siguiente libre es el 111» cuando el 111 a 113 ya estaban usados (entonces el libre era el 114; tras el hotfix 1.0.1 es el 116) | **Corregido en esta rama** |
| H-2 | Bajo | `docs/07` §5, `docs/README.md`, `CLAUDE.md` | Seguían anunciando las fases 2 y 3 de PostgreSQL como pendientes o «sin hacer»; las cerró el ADR-113 | **Corregido en esta rama** |
| H-3 | Bajo | `docs/prompts/auditoria-final-backend.md` | Decía que las fases 2 y 3 «no están hechas por decisión», pedía leer hasta el ADR-100 y hablaba de 81 rutas | **Corregido en esta rama** |
| H-4 | Bajo | `docs/frontend/FE7-integracion-y-entrega.md` | Daba como pendientes las claves del panel en el CI, aplicadas en el PR #134 | **Corregido en esta rama** |
| H-6 | Alto (descubierto después) | `SecurityConfig` y `PaginaDeCortesia` | La `1.0.0` entregada tenía un fallo que esta auditoría **no vio**: los formularios de las páginas HTML de los enlaces del correo (activar cuenta, confirmar correo, restablecer clave, avisos) respondían 403 «Invalid CORS request» desde un navegador, porque la política `no-referrer` hace que el navegador mande `Origin: null`. Se corrigió el 2026-11-16 en el hotfix `1.0.1` (ADR-114, PR #140). La auditoría probó rutas con `curl` y leyó código, y ninguna prueba del repo mandaba `Origin`; no se recorrió un formulario en un navegador real | **Corregido en `1.0.1`**; añadido a esta rama el 2026-11-16 |
| H-5 | Informativo | Instancia real | `GET /api/sistema/modo` en la instancia real devuelve `cuentasSinteticas: 30000`: la base real conserva las cuentas del ADR-094; el valor 300 (ADR-111) solo aplica a bases nuevas | Abierto; decisión del dueño (§5) |

## 4. Comprobaciones hechas contra la instancia real (puerto 8081, solo lectura)

| Petición | Resultado |
|---|---|
| `GET /actuator/health` | 200 |
| `GET /api/cumplimiento` y `GET /api/analitica/cumplimiento` | 200 los dos y con los mismos números globales: prometido 28 800 s, real 7 200 s, 100 % |
| `GET /api/sim/reloj` | **404** (la simulación no existe en la instancia real) |
| `GET /api/veedor/analitica/vigilancia` sin sesión | **401** |
| Puertos publicados en `docker-compose.yml` | Todos en `127.0.0.1` (Mongo, Redis, Mailhog, PostgreSQL, API real y simulación) |

## 5. Deuda aceptada

- **Exenciones de Trivy** `CVE-2026-47884` y `CVE-2026-47890` (Spring Framework 6.2.19), vencen el **2026-12-31**. No hay vistas XSLT ni `FragmentsRendering`; la corrección real solo existe en Spring Framework 7 (Spring Boot 4).
- **PostgreSQL con autenticación `trust`**, puerto solo en `127.0.0.1` (riesgo aceptado en `docs/05` §5).
- **Cuentas sintéticas de la base real:** 30 000. Reducirlas a 300 es destructivo y exige copia previa; hoy no estorba y no se ha hecho.
- **Prueba de los cinco segundos** (FE7 §8): la hace una persona, no una IA.
- **`POST /api/sim/oleada`** no se construyó (desviación del plan, registrada en `docs/10` §9).
- **Rama remota `chore/launch-json-frontend`** sin PR; decide el dueño (A7).

## 6. Lo que no se verificó

- Matrices RF → prueba, ADR → prueba y endpoint × rol completas.
- Provocar a mano fallos concurrentes o la caída de Redis/Mongo/correo (solo cuentan las pruebas del repo).
- `explain` de las consultas críticas, índices huérfanos y crecimiento de colecciones.
- `docker compose -p auditoria up` desde cero con `down -v` y la guía `docs/01`.
- Trivy, gitleaks y SpotBugs en local.
- Que ninguna regla ArchUnit sea vacía, y que `ValidacionDeSecretos` sea efectiva en el perfil de producción (se vio que existe y que tiene su prueba, no se ejecutó en producción).
- Carga y escalabilidad (cifras de ADR-097).
- **Los flujos de una persona en un navegador real** (formularios de las páginas HTML del backend, cabeceras `Origin`/`Referer`, CORS). Es justo lo que ocultó el H-6; una auditoría futura debe incluirlos.
- Cualquier cosa de `frontend/`: es de Yordy y está fuera del alcance.
- Que el total de 1 619 pruebas unitarias de hoy difiera de las 1 842 que anotó el cierre del 2026-11-06: no se investigó el motivo. El conteo de hoy sale de los informes frescos de Surefire (los 214 archivos de `*Test.java` tienen su informe de hoy); los 287 informes restantes de `target/` eran de ejecuciones de octubre.

## 7. Repetir las comprobaciones

```bash
cd backend && ./mvnw verify                                  # pruebas, ArchUnit, IT con Testcontainers y cobertura
node scripts/generar-referencia-api.mjs && git status --short docs/api   # el contrato no debe dejar diferencias
gh run list --branch develop --limit 12                      # CI de la rama
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/api/sim/reloj   # 404 en la instancia real
```
