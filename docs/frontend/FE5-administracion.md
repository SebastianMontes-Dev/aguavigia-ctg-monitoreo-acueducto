# FE5 · Administración

> **Diseño:** esta fase hereda el rediseño vigente (ADR-103 a 106). Antes de construir, lee [`rediseno-vigente.md`](rediseno-vigente.md) §4 (reglas) y §5 (qué le toca a esta fase y qué está por decidir).

**Objetivo:** lo que solo hace un ADMIN. Gestionar cuentas (invitar, aprobar, rechazar, suspender, reactivar, ajustar
permisos), leer la auditoría y ver las métricas del sistema.

Rama: `feature/fe5-administracion`. Depende de FE2. Esfuerzo: 2 sesiones.

Contrato: [`panel-veedor.md` §Gestión de cuentas](../api/panel-veedor.md#gestión-de-cuentas-admin),
[`cuentas-y-sesion.md`](../api/cuentas-y-sesion.md#roles-y-permisos) (roles, permisos, autoprotección), y las secciones F4
(`sintetica`) y F6 (métricas) de [`cambios-para-frontend.md`](../api/cambios-para-frontend.md).

## Pantallas

**`/panel/sistema` se añade primero a [`guia-frontend.md` §5.4](../diseno/guia-frontend.md#54-panel-del-veedor).**

| Ruta | Permiso | Qué |
|---|---|---|
| `/panel/cuentas` | `GESTIONAR_USUARIOS` | **La lista:** `GET /api/veedor/usuarios?estado=`, paginada por cabeceras.<br>- **Hay 30 000 cuentas sintéticas**: por defecto se ocultan las de `sintetica: true`, con un interruptor para verlas<br>- Nunca se cuentan como personas; frase fija en F4<br><br>**Las acciones:**<br>- invitar: `POST …/usuarios/invitaciones`, con correo, nombre y rol<br>- reenviar una invitación: `POST …/usuarios/{id}/invitacion/reenvio`<br>- aprobar con rol y permisos, rechazar, suspender, reactivar: `PATCH …/{id}/aprobacion|rechazo|suspension|reactivacion`<br>- ajustar permisos sueltos: `PATCH …/{id}/permisos` con `concedidos`/`revocados`<br><br>**Reglas:**<br>- no se puede editar el propio acceso<br>- no se ofrece quitar el último ADMIN<br>- `CONFIGURAR_SEGUNDO_FACTOR` no se puede revocar<br>- un permiso no puede estar en las dos listas<br>- cada acción se confirma con el nombre de la cuenta afectada<br>- se avisa que suspender o cambiar permisos cierra las sesiones de esa persona |
| `/panel/auditoria` | `VER_AUDITORIA` | `GET /api/veedor/auditoria`, paginada y de solo lectura: fecha, quién actuó, sobre quién y qué acción |
| `/panel/sistema` * | `VER_PANEL` | `GET /api/veedor/sistema/metricas`. Son **métricas de calibración** (ADR-097): se presentan como tabla con su unidad y su guía de lectura, sin semáforos ni umbrales inventados.<br><br>**Bloque «Copia analítica»** (F7 de [`cambios-para-frontend.md`](../api/cambios-para-frontend.md#f7--postgresql-la-copia-analítica-del-índice-adr-100-2026-10-15)): `GET /api/veedor/analitica/copia`, las últimas copias con su `resultado` en texto y glifo (`OK`, `CON_DIFERENCIAS`, `FALLIDA`, `EN_CURSO`), los conteos de `enMongo` frente a `enSql` y el `detalle`. Un `503` se dice como «La copia analítica está apagada o PostgreSQL no responde; el sistema funciona igual», no como un error de la pantalla |

## Cómo quedó construido (2026-10-31)

- **Dónde viven las métricas y la copia:** en `/panel/sistema`, una sección nueva del menú («Sistema», `VER_PANEL`, entre Ingesta y Cuentas). Dos bloques lado a lado con la misma altura: «Métricas de calibración» y «Copia analítica (PostgreSQL)». Cada uno falla por separado y con su reintento; un `503` de la copia se dice como «el sistema funciona igual», sin `role="alert"`.
- **Cuentas sintéticas:** el contrato no filtra por `sintetica` ni por rol, y las 30 000 van primero (son las más nuevas) o en medio. El cliente las oculta y, si una página queda hecha solo de ellas, pide la siguiente (hasta 12 páginas seguidas; después pregunta con «Seguir buscando»). El titular y las tres cifras (esperan aprobación, invitaciones sin aceptar, suspendidas) se cuentan **sin** sintéticas, con una página de 50 por estado. **Para Sebastian:** un `?sintetica=false` (o `?rol=`) en `GET /api/veedor/usuarios` quitaría esa búsqueda por páginas; hoy una cuenta de panel creada antes del lote puede quedar a 150 páginas.
- **Autoprotección:** sobre la propia cuenta no se ofrece ninguna acción. Con eso, quien actúa siempre queda como ADMIN activo, así que «quitar al último ADMIN» solo podría pasar sobre uno mismo; no hace falta contar admins (el contrato no permite filtrar por rol). Los `409` del servidor se explican igual.
- **Permisos sueltos:** el editor parte de los `permisosEfectivos` y calcula `concedidos`/`revocados` comparando las casillas con el rol (`dominio/cuentas.ts`); un permiso no puede quedar en las dos listas. `CONFIGURAR_SEGUNDO_FACTOR` va marcado y bloqueado. Al elegir otro rol las casillas vuelven a las de ese rol.
- **Cuentas `VECINO`:** solo se ofrece suspender y reactivar; nunca cambiar rol ni aprobar (cuentas-y-sesion.md).
- **Auditoría:** 50 por página; en menos de 900 px cada asiento son cuatro líneas.
- **Fuera de esta entrega:** el e2e real de invitar → Mailhog → fijar clave → entrar como observador y verlo sin acciones (el de `e2e/real/veedor-administracion.spec.ts` solo lee). Queda para cuando haya un ADMIN conocido y Docker.

## Pruebas

- e2e simulado:
  - lista con sintéticas ocultas y visibles
  - paginación
  - invitar
  - cada acción del ciclo de una cuenta
  - autoprotección (sin botón sobre uno mismo)
  - auditoría vacía y con datos
  - métricas
  - copia analítica: `OK`, `CON_DIFERENCIAS` con detalle, `FALLIDA` y `503`
- e2e real, con `RATE_LIMIT_FACTOR_CUENTAS=10` (invitar, fijar la clave y entrar pasan por los topes de cuentas): el ADMIN invita a un OBSERVADOR y la invitación llega a Mailhog. El enlace abre la página HTML del backend, ver FE6. El observador fija su clave, entra y **no ve acciones** de veedor; esto cierra la comprobación pendiente de FE3. El ADMIN le concede `MODERAR_REPORTES` y el observador ve la acción tras volver a entrar.

## Terminado cuando

- Pasa la puerta completa.
- La lista de cuentas responde con fluidez con las 30 000 sintéticas en la base: se pagina y no se cargan todas.

## Prompt para Claude Code

```
Usa la skill disenar-frontend. Lee docs/frontend/README.md, docs/frontend/FE5-administracion.md, docs/api/panel-veedor.md
y docs/api/cuentas-y-sesion.md. En feature/fe5-administracion desde develop: añade /panel/sistema a guia-frontend.md §5.4 y
construye /panel/cuentas, /panel/auditoria y /panel/sistema con las reglas de autoprotección y el tratamiento de cuentas
sintéticas. Corre la puerta completa y muéstrame el resultado. Abre el PR, no lo fusiones. Si usas subagentes, usa model sonnet.
```
