# Plan del frontend

Plan por fases para que el frontend (`frontend/`, React 19 + Vite + TS) cubra **todo el contrato actual** del backend
(`backend/openapi.yaml`). Lo ejecuta Yordy con Claude Code. Propuesto el 2026-10-06. Reemplaza la tabla de
[`guia-frontend.md` §7](../diseno/guia-frontend.md#7-aplicación-por-claude-code).

Las fases se llaman **FE0–FE7** para no confundirse con las fases F0–F6 del backend.

**Si llegas de nuevo al proyecto, empieza por [`guia-para-yordy.md`](guia-para-yordy.md)**: el estado de hoy, todo lo que el backend ya hace, el entorno paso a paso y este plan fase por fase.

## Punto de partida (`main`, 2026-10-06)

| | Hoy |
|---|---|
| Rutas del contrato (paths, sin `/api/sim`) | 78 |
| Rutas que el frontend consume | 27 |
| `esquema.ts` (tipos generados) | Desactualizado: 58 rutas, del 2026-09-29. `npm run api:check` falla |
| Frontend CI en `main` | **Rojo por dos causas:**<br>1. `api:check`<br>2. el sembrado del job «backend real» choca con el límite de 10 `POST /api/dispositivos` por hora |
| Reportar contra el backend actual | **No funciona**: sin `X-Dispositivo`, `POST /api/reportes` responde `401 dispositivo-invalido` |
| Cambios de contrato F0–F6 adoptados | Solo `CORTE_PROGRAMADO` (F5) |

Pantallas que existen hoy:
- **Mapa y ficha:** `/`, `/sectores/:id`
- **Reporte:** la hoja sobre el mapa y `/confirmar/:id`
- **Historia pública:** `/cumplimiento`, `/estadisticas`, `/bitacora`
- **Avisos:** `/avisos`, `/avisos/confirmar`, `/avisos/baja`
- **Muestrario:** `/muestrario`

No hay panel, cuentas ni vecino. El ingreso al panel con segundo factor ya está hecho en la rama
`feat/f5-ingreso-panel` (2 commits, 81 detrás de `main`), que es la base de FE2.

**Actualización del 2026-10-18.** El contrato pasó de 78 a **81 rutas**: el 2026-10-15 el backend añadió 3 de PostgreSQL (ADR-100; ver F7 en
[`cambios-para-frontend.md`](../api/cambios-para-frontend.md)). No rompen nada ni cambian FE0–FE4 y FE6; solo suman un bloque a FE5 y una exclusión a FE7. El frontend no ha recibido commits desde el 2026-10-06,
`esquema.ts` sigue siendo del 2026-09-29 (58 rutas) y el Frontend CI sigue rojo por las dos causas de la tabla.

**Actualización del 2026-10-25 (revisión de Yordy antes de retomar).** El backend está cerrado y se comprobó ejecutándolo:
- `./mvnw verify` sobre `main`: 2142 pruebas, 0 fallos. `ContratoOpenApiTest` confirma que `backend/openapi.yaml` (81 rutas, 87 operaciones) es lo que expone el código.
- Con `docker compose up`, `scripts/verificar-flujos.mjs` pasa los 33 flujos y recorre 84 de las 87 operaciones. Las otras 3 son las de PostgreSQL: las dos públicas se probaron a mano (`200`) y la del panel responde `401` sin sesión y la cubren sus pruebas (`AnaliticaControllerTest`).
- El Frontend CI sigue rojo y **las dos causas son del frontend**. La segunda de la tabla de arriba **ya no aplica**: Sebastian subió `RATE_LIMIT_FACTOR=100` en el job «backend real» (`027bca0`, en `.github/workflows/frontend-ci.yml`) y la siembra ya pasa. Lo que falla hoy es `api:check` y 4 pruebas de `e2e/real/ciudadano.spec.ts` que reciben `401` por reportar sin `X-Dispositivo`. Las dos cosas se arreglan en FE0.
- `feat/f5-ingreso-panel` va ahora **117 commits** detrás de `main`. Sus dos commits (`95962ad`, `5dda089`) siguen siendo la base de FE2.
- El frontend no ha recibido commits desde el 2026-09-29 (`f81f6f6`). Ninguna fase FE está empezada.

**Actualización del 2026-10-30 (rediseño de las vistas de datos).** El [PR #122](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/122) rediseñó la ficha del barrio, Cumplimiento, Bitácora,
Estadísticas y Avisos (ADR-103 a 106: bloques, grafito en oscuro, muestra mínima de 5 cortes, gráficas con selector y PDF directo) y trae FE1. **Las fases FE2–FE7 heredan ese diseño**:
lo resume, con los archivos que lo llevan y las decisiones por tomar para el panel, [`rediseno-vigente.md`](rediseno-vigente.md). El frontend de hoy cubre lo público; el panel, las cuentas y el vecino
(FE2–FE6) y el cierre (FE7) están sin empezar.

**Actualización del 2026-10-31 (FE2 a FE6 construidas).** El estado real, de `git` y de los PR:
- **En `develop`:** FE0 y FE1, dentro del [PR #122](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/122) (fusionado el 2026-10-30, junto con el rediseño). El [PR #121](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/121) de FE0 se cerró sin fusionar porque su contenido ya iba en el #122.
- **En la rama `claude/fe3-moderacion-y-cortes-6979a7`, que aún no tiene PR a `develop`:** FE2 y FE3 (commits `daae0e0`, `bf34220`, `7b8f34f`) y, fusionados por squash contra ella, FE4 ([#126](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/126)), el rediseño de Avisos (ADR-108, [#128](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/128)) y FE5 ([#127](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/127)). **Esa rama es la que falta llevar a `develop`.**
- **PR abierto:** FE6, [#129](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/129), contra la rama de FE3.
- **Sin empezar:** FE7.
- **Lo que ninguna fase pudo comprobar:** el e2e real del panel (`e2e/real/panel.spec.ts` y los de FE3 a FE5) se omite sin `PANEL_CORREO` y `PANEL_CLAVE`, y el job «backend real» del CI no los pasa todavía (hay que fijar la clave del ADMIN inicial en `scripts/preparar-env-ci.mjs` y `frontend-ci.yml`: archivo compartido, se avisa a Sebastian). Solo el del vecino (FE6) corrió contra el backend local. Tampoco se hizo la prueba de los cinco segundos con otra persona en FE2 a FE6.
- **Ramas viejas:** `feat/f5-ingreso-panel` ya está integrada en FE2 (sus dos commits son `95962ad` y `5dda089`, ahora `fe0bbf9` y `daae0e0`); Yordy la archiva y borra a mano.

## Qué no cambia mientras se trabaja

- **El contrato.** `backend/openapi.yaml` es la fuente de verdad. Si una prueba contra el backend real falla sin que el contrato haya cambiado, es un defecto del backend: se avisa a Sebastian y no se adapta el frontend.
- **La identidad visual** ([`identidad.md`](../diseno/identidad.md), ADR-070/071), los cuatro estados ([`DESIGN.md`](../../DESIGN.md)) y la regla de los cinco segundos (ADR-079): el veredicto arriba, cifras que se lean solas, dos columnas en escritorio y el detalle detrás de una acción.
- **El stack:** React 19, Vite, TanStack Router y Query, `openapi-fetch`, react-aria, MapLibre y PMTiles, CSS propio. No se añaden librerías de interfaz.
- **Quién manda si hay choque (nota del backend, 2026-10-08).** El backend tiene prioridad sobre el frontend: si algo de este plan
  choca con él, se adapta el frontend. Si el backend necesitara cambiar el contrato, lo decide Sebastian y lo avisa en
  [`cambios-para-frontend.md`](../api/cambios-para-frontend.md) antes de fusionar.
- **Las dos instancias.** El backend real (`http://localhost:8081`) arranca con las 30 000 cuentas de vecinos; la simulación
  (`http://localhost:8082`, `AGUAVIGIA_BACKEND=http://localhost:8082`) arranca sin cuentas. Para que las pruebas `e2e/real` sean repetibles,
  el backend debe correr con `INGESTA_MODO=local`: con `auto` la ingesta trae boletines de Internet cada vez y la base nunca es la misma.

## Reglas de cada fase

1. **Antes de tocar la interfaz:** la skill `disenar-frontend`. **Antes de cerrar la fase:** `revisar-diseno` sobre las capturas.
2. **Tipos solo generados.** `npm run api:sync` produce `esquema.ts`; nunca se escriben tipos de la API a mano. `api:check` en verde es obligatorio.
3. **Nada que la API no devuelva.** Cada cifra, insignia o texto sale de un campo del contrato ([`guia-frontend.md` §5](../diseno/guia-frontend.md#5-matriz-de-pantallas-y-datos)). Si una pantalla nueva no está en §5, la fase la **añade a §5 antes de construirla**, con sus datos y estados.
4. **Errores por `type`, no por texto** ([`errores-y-limites.md`](../api/errores-y-limites.md)). Cada lista tiene estados de carga, vacío y error, y cada dato muestra su frescura.
5. **Permisos:** el panel pinta solo lo que `permisos[]` permite. Un `401` con un `type` distinto de `credencial-invalida`/`segundo-factor-requerido` borra la sesión y vuelve al ingreso.
6. **Seguridad del cliente** ([`cuentas-y-sesion.md` §Notas](../api/cuentas-y-sesion.md#notas-de-seguridad-para-el-cliente)):
   - el token nunca va en la URL
   - las pantallas que reciben `?token=` lo quitan con `history.replaceState` y usan `referrer no-referrer`
   - sin scripts de terceros
7. **Escala** ([`escalabilidad-para-el-cliente.md`](../api/escalabilidad-para-el-cliente.md)):
   - el token de dispositivo se pide **una vez**
   - un solo SSE por pestaña
   - geometría cacheada un día
   - reintentos con `Retry-After`

## La puerta: lo que se comprueba al cerrar cada fase

Desde `frontend/`:

1. `npm run lint`, `npm run typecheck`, `npm run api:check`, `npm test` y `npm run build`, todos en verde.
2. `npm run test:e2e`: e2e contra la API simulada. Cada pantalla nueva trae su spec.
3. `npm run test:e2e:real` contra `docker compose up` con el backend de `main`, `INGESTA_MODO=local` y `RATE_LIMIT_FACTOR=100`. Cada flujo nuevo trae su spec en `e2e/real/`.
   - **Desde FE2, también `RATE_LIMIT_FACTOR_CUENTAS=10`.** `RATE_LIMIT_FACTOR` no afloja, a propósito, los topes de ingreso, segundo factor, cuentas, suscripciones y cambio de clave: `/api/cuentas/**` admite 10 peticiones cada 10 minutos por IP y `/api/veedor/sesion` 10 cada 5 minutos ([`errores-y-limites.md`](../api/errores-y-limites.md)). Con Docker Desktop todo el equipo comparte una IP, así que una pasada de e2e de cuentas los agota. El 2026-10-25, `verificar-flujos.mjs` falló 3 pasos por `429` con el valor por defecto y pasó entero con 10. En el CI hay que sumar la misma variable al job «backend real» de `frontend-ci.yml` (archivo compartido: se avisa a Sebastian en el PR).
   - Si el entorno no tiene Docker (una sesión en la nube, por ejemplo), este paso lo corre el job «backend real» del CI del PR. Se dice así en el PR; nunca se da por pasado sin haberlo visto en verde.
4. **Capturas** en 1440×900, 1024×768, 768×1024 y 390×844, en claro y en oscuro, más una con movimiento reducido:
   - se guardan en `frontend/test-results/capturas/<fase>/`, ignorado por git; no se commitean binarios
   - se miran
   - se pasa `revisar-diseno` y se corrige lo que encuentre
5. **Prueba de los cinco segundos:** en cada pantalla nueva, alguien que no la conoce dice qué responde sin hacer scroll. Se anota quién y el resultado.
6. **El CI de la rama, en verde**, incluido el job contra el backend real.

## Cómo se trabaja

- **Una rama por fase** desde `develop`: `feature/fe<n>-<tema>`, por ejemplo `feature/fe0-contrato-al-dia`. Se fusiona a `develop` por PR con la puerta en verde (Gitflow, ver `CLAUDE.md`).
- **Una fase por sesión** de Claude Code, `/clear` entre fases. Cada guía termina con un prompt listo para pegar. Si se usan subagentes, con Sonnet.
- **Al cerrar una fase** se marca ✅ en la tabla de abajo, con la fecha y el PR. Mientras el PR espera, la fase se marca «PR abierto» con su enlace, para que la sesión siguiente sepa dónde quedó.
- **Sesiones en la nube:** el prompt de arranque está en [`prompt-sesion-nube.md`](prompt-sesion-nube.md). Sirve para cualquier fase: lee esta tabla y toma la siguiente.
- **Autoría:** todo commit lleva la identidad de Yordy (`git config user.name "Yordy Pardo"` y su correo de GitHub), sin `Co-Authored-By`. Una sesión en la nube firma por defecto como `Claude <noreply@anthropic.com>`, que es justo lo que `autoria.yml` rechaza (BUG-104). Antes de abrir el PR: `scripts/verificar-autoria.sh origin/main..HEAD`.
- **Ramas:** ninguna sesión borra ni archiva ramas o etiquetas. Lo hace Yordy a mano, también con `feat/f5-ingreso-panel` (integrada ya en FE2; pendiente de archivar).

## Fases

| Fase | Guía | Qué entrega | Rutas del contrato que suma | Estado |
|---|---|---|---|---|
| FE0 | [Contrato al día](FE0-contrato-al-dia.md) | CI en verde; reportar funciona; se adoptan todos los cambios que **rompen** (F0–F3) | `POST /api/dispositivos` y `GET /api/fotos/{n}` | ✅ en `develop` (2026-10-30) dentro del [#122](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/122); el [#121](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/121) se cerró sin fusionar porque su contenido ya iba en el #122 |
| FE1 | [Lo público, completo](FE1-publico-completo.md) | Insignias del estado del barrio, calidad del Índice, Índice por corte, banner de simulación, «¿ya volvió el agua?» | `cumplimiento/calidad`, `cumplimiento/cortes/{id}`, `sistema/modo`, `sectores/{id}/restablecimiento` | ✅ en `develop` (2026-10-30), [#122](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/122), junto con el rediseño. Su puerta de cierre no se comprobó aparte |
| FE2 | [Ingreso al panel](FE2-ingreso-al-panel.md) | Rebasar `feat/f5-ingreso-panel`: ingreso, alta de TOTP con QR, marco con permisos, seguridad de la cuenta | `veedor/sesion`, `sesion/cierre`, `yo`, `segundo-factor/*`, `cuenta/clave` | Construido (2026-10-30) y dentro de `claude/fe3-moderacion-y-cortes-6979a7` (commits `fe0bbf9`, `daae0e0`, `bf34220`); aún no está en `develop`. Sus pantallas se rediseñaron a dos columnas el 2026-10-31 (commit `7a5e674`, dentro del #127). e2e real escrito (`e2e/real/panel.spec.ts`) y omitido sin `PANEL_CORREO`/`PANEL_CLAVE`: no se ha corrido |
| FE3 | [Moderación y cortes](FE3-moderacion-y-cortes.md) | Cola de reportes, fotos del panel, cortes (crear, cerrar, por barrio, confirmar, anular), vencidos, disputas | 14 operaciones de `veedor/reportes`, `veedor/fotos`, `veedor/cortes`, `veedor/disputas` | Construido (2026-10-30) en `claude/fe3-moderacion-y-cortes-6979a7`, commit `7b8f34f`, sobre FE2; esa rama aún no tiene PR a `develop`. Pasan `lint`, `typecheck`, `api:check`, `npm test` (544) y `build`, y el e2e simulado (225; 22 pruebas nuevas por proyecto). Capturas en 4 anchos, claro y oscuro, y movimiento reducido miradas y pasadas por `revisar-diseno`. **Sin comprobar:** el e2e real (`e2e/real/veedor-moderacion-y-cortes.spec.ts`) está escrito pero se omitió por falta de `PANEL_CORREO` y `PANEL_CLAVE`; falta correrlo con un ADMIN conocido (y que `frontend-ci.yml` los pase). Falta también la prueba de los cinco segundos con otra persona |
| FE4 | [Ingesta](FE4-ingesta.md) | Propuestas (aprobar, descartar, anular), documentos fallidos, salud de los colectores | 6 operaciones de `veedor/ingesta` | ✅ fusionado en la rama de FE3 por el [#126](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/126) (2026-10-31); aún no está en `develop`. Pasan `lint`, `typecheck`, `api:check`, `npm test` (585) y `build`, y el e2e simulado (268; 15 pruebas nuevas por proyecto en `e2e/ingesta.spec.ts`). Capturas en 4 anchos, claro y oscuro, y movimiento reducido miradas y pasadas por `revisar-diseno`. **Sin comprobar:** el e2e real (`e2e/real/veedor-ingesta.spec.ts`: solo lee, no decide nada) está escrito y se omitió por falta de `PANEL_CORREO` y `PANEL_CLAVE`; la prueba de los cinco segundos con otra persona. **Límite del contrato:** `GET /propuestas` solo devuelve las `PENDIENTE`, así que «Anular» solo se ofrece sobre lo aprobado en la visita en curso; no hay forma de listar aprobadas anteriores. Tampoco hay ruta de reintento manual de fallidos |
| FE5 | [Administración](FE5-administracion.md) | Cuentas, invitaciones y permisos, auditoría, métricas del sistema y estado de la copia analítica | 10 operaciones de `veedor/usuarios`, `auditoria`, `sistema/metricas`, `veedor/analitica/copia` | ✅ fusionado en la rama de FE3 por el [#127](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/127) (2026-10-31); aún no está en `develop`. Pasan `lint`, `typecheck`, `api:check`, `npm test` (659) y `build`, y el e2e simulado (313; 29 pruebas nuevas por proyecto en `e2e/administracion.spec.ts`). Capturas en 4 anchos, claro y oscuro, y movimiento reducido miradas y pasadas por `revisar-diseno` (corregidas: nav con dos secciones activas, tabla de cuentas en celular, auditoría de 8 300 px a 5 300 px en 390). Nuevas rutas `/panel/cuentas`, `/panel/auditoria` y `/panel/sistema` (métricas + copia, `VER_PANEL`). **Sin comprobar:** el e2e real (`e2e/real/veedor-administracion.spec.ts`, solo lee) está escrito y se omitió por falta de `PANEL_CORREO` y `PANEL_CLAVE`; el flujo real invitar → correo → observador sin acciones no está escrito; la prueba de los cinco segundos con otra persona. **Límite del contrato:** no hay filtro `sintetica` ni `rol` en `GET /veedor/usuarios`, así que las sintéticas se ocultan en el cliente saltando páginas (detalle en [FE5](FE5-administracion.md#cómo-quedó-construido-2026-10-31)) |
| FE6 | [Cuentas públicas y vecino](FE6-cuentas-y-vecino.md) | Solicitar cuenta, olvidé mi clave, reenviar verificación; registro, ingreso y perfil del vecino; reportar con su sesión | `cuentas/registro`, `restablecimiento`, `verificacion/reenvio`, `cuentas/vecino` y las 5 de `vecino/*` | PR abierto: [#129](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/129) (2026-10-31), contra la rama de FE3 (la de FE5 se borró al fusionar). Las cifras de abajo son de antes de reubicar la rama; tras reubicarla se repitieron `lint`, `typecheck`, `api:check`, 707 unitarias y 400 e2e simulados, y no el e2e real. Pasan `lint`, `typecheck`, `api:check`, `npm test` (707), `build`, el e2e simulado (400 en dos pasadas seguidas; 44 pruebas nuevas por proyecto en `e2e/cuentas.spec.ts` y `e2e/vecino.spec.ts`) y el **e2e real contra el backend local** (`e2e/real/vecino.spec.ts`: registro → correo en Mailhog → página HTML del backend para elegir la clave → ingreso → verificar el barrio → reportar con `CUENTA_VERIFICADA` → el token del vecino da `403` en el panel → cierre de sesiones; 16 pasadas y 8 omitidas, las del panel, por falta de `PANEL_CORREO` y `PANEL_CLAVE`). El backend de la prueba corría con `RATE_LIMIT_FACTOR=100` **sin** `RATE_LIMIT_FACTOR_CUENTAS=10`: el flujo gasta 3 de las 10 peticiones de `/api/cuentas/**` cada 10 minutos, así que cabe una pasada, no tres seguidas. Capturas en 4 anchos, claro y oscuro, y movimiento reducido miradas (no las 121 una a una: registro, perfil, ingreso, solicitar, olvidé, reporte con sesión y el ingreso del panel en los cuatro anchos) y pasadas por `revisar-diseno`. Nuevas rutas públicas `/cuenta/solicitar`, `/cuenta/olvide`, `/cuenta/reenviar`, `/vecino/registro`, `/vecino/ingreso` y `/vecino/perfil`, y «Mi cuenta» en la cabecera. **Cambio transversal que sale de esta fase:** el orden de las capas CSS se fija en `index.html` (la build enlazaba la hoja compartida de `GlifoEstado`, que solo trae `componentes`, antes que `index.css`; con eso `reset` y `base` pisaban a `componentes`: el botón principal salía con el texto del color de la tinta —ilegible en el grafito— y los enlaces de la navegación en verde). Cambia el aspecto de **todas** las pantallas de la build respecto a lo que se veía antes; hay que mirar las de FE2–FE5. **Sin comprobar:** la prueba de los cinco segundos con otra persona; FE6b (las pantallas de verificar, invitación y restablecer dentro de la SPA) no se hizo, a propósito: el correo sigue llevando a las páginas HTML del backend |
| FE7 | [Integración y entrega](FE7-integracion-y-entrega.md) | Cobertura total del contrato, accesibilidad, rendimiento, guion de la demo | — | — |

**Fuera del frontend:**
- `/api/sim/**`: la usa el simulador.
- `POST /api/iot/presion`: es para sensores, inactivo.
- `GET /api/v2/requests.json`: Open311, una API para máquinas.
- `GET /api/analitica/cumplimiento` y `/mensual`: el Índice desde la copia SQL; duplican `/api/cumplimiento` y pueden dar `503` (F7 de `cambios-para-frontend.md`).
- Las páginas HTML de `/api/cuentas/enlaces/*`: el backend las sirve y el frontend solo depende de que existan (ver FE6).

### Orden y dependencias

```
FE0 ──▶ FE1
  └───▶ FE2 ──▶ FE3 ──▶ FE4
                 └───▶ FE5
FE0 ──▶ FE6 (usa el marco de sesión de FE2)
todas ──▶ FE7
```

FE0 va primero porque sin él nada compila contra el esquema nuevo y reportar no funciona. FE1 y FE2 pueden ir en paralelo.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **FE0 es grande**: regenerar el esquema rompe la compilación en muchos sitios a la vez (`finReal`, `huella`, tipos de bitácora) | Se hace en una sola rama con commits por causa. La guía de FE0 lista cada punto con su archivo |
| **La rama `feat/f5-ingreso-panel` está 117 commits atrás** (2026-10-25) y usa el esquema viejo | Se trae con `cherry-pick` **después** de FE0. Solo `router.tsx` cambió en los dos lados. El mayor trabajo es adaptar sus tipos al esquema nuevo |
| **Los topes de cuentas agotan el e2e real** (10 por 10 min en `/api/cuentas/**`, 10 por 5 min en `/api/veedor/sesion`) | `RATE_LIMIT_FACTOR_CUENTAS=10` en local y en el job «backend real» desde FE2 (puerta, paso 3). Nunca se sube en la instancia real |
| **Una sesión en la nube** puede no tener Docker, ni el `cartagena.pmtiles` (va por Git LFS), ni los MCP locales | Corre la puerta 1, 2 y 4 en su entorno y deja la 3 al CI del PR. `git lfs pull` antes de las capturas: sin él, `frontend/public/mapa/cartagena.pmtiles` es solo el puntero de LFS, la capa base del mapa no carga y las capturas del mapa no sirven. Capturas con Playwright por `npx`, no con un MCP |
| **El backend cambia mientras se construye el panel** | Los cambios de contrato se avisan en [`cambios-para-frontend.md`](../api/cambios-para-frontend.md). Las pruebas `e2e/real` son además una red de seguridad para Sebastian: si fallan sin cambio de contrato, se le avisa |
| **El e2e real depende del límite de dispositivos** (10 por hora por IP) | `RATE_LIMIT_FACTOR=100` en el CI y en local (FE0). El cliente pide el token una vez y lo reutiliza |
| **Los enlaces de los correos de cuenta abren páginas HTML del backend, no la SPA** | Funcionan tal cual. Que el correo apunte a la SPA exige cambiar `MailCuentaAdapter` (backend), que queda **después de FE7** (decisión D-C de [`guia-para-yordy.md`](guia-para-yordy.md#8-decisiones-abiertas)) y coordinado con Sebastian. FE6 lo deja opcional |
| **El panel con 30 000 cuentas sintéticas** | La lista de cuentas filtra `sintetica` y pagina por cabeceras. Nunca se cuentan como personas (frase fija de `cambios-para-frontend.md` F4) |
| **La guía §5 no define pantallas** de vecino, disputas, vencidos, métricas ni «¿ya volvió el agua?» | Cada fase añade sus filas a §5 antes de construir (regla 3) |
| **Documentos que citaban archivos retirados** (la skill `disenar-frontend`, `guia-frontend.md`, `identidad.md`, `docs/api/README.md`, `escalabilidad-para-el-cliente.md`) | Corregido el 2026-10-25: apuntan a este plan, a `docs/01`, `docs/07` o al historial (`git show pre-limpieza-docs:<ruta>`) |
