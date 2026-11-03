# Guion de la demostración

Para la sustentación: un vecino reporta con foto, el veedor modera, los vecinos coinciden y el mapa cambia en vivo, el veedor cierra el corte,
el Índice de Cumplimiento se mueve y quien se suscribió al barrio recibe el aviso y responde «ya volvió». Dura unos 10 minutos hablados y
se puede recorrer entero a mano o con un solo comando (`npm run demo:guion`, abajo). Es la base de la guía «08 · Guion de la presentación» de [`docs/README.md`](../README.md).

Todo es la instancia **real** (`http://localhost:8081`) sobre una base limpia. Lo único inventado son las 30 000 cuentas sintéticas de vecino,
y el backend las declara como tales. No hay reportes, cortes ni estados de ejemplo: lo que se ve en el mapa lo hace la propia demostración.

## Antes de empezar (una vez, 5 minutos antes de entrar al aula)

Los límites de peticiones están pensados para un uso normal desde casa. En una demo, todos los clientes comparten la IP de Docker, así que se
aflojan **solo para esta sesión** (nunca en la instancia que quede corriendo):

```bash
# 1. Base limpia: borra los volúmenes de este proyecto. Solo si la demo es de verdad desde cero.
docker compose down -v

# 2. Sube todo con la ingesta sin red (los boletines guardados en el repositorio) y los topes de la demo
INGESTA_MODO=local RATE_LIMIT_FACTOR=100 RATE_LIMIT_FACTOR_CUENTAS=10 docker compose up -d --build

# 3. La clave del ADMIN inicial: el backend la escribe una sola vez en su log (ADR-086)
docker compose logs backend | grep "ADMINISTRADOR INICIAL"
```

- `INGESTA_MODO=local` hace que no dependa de Internet ni de que Acuacar esté arriba (ADR-082).
- `RATE_LIMIT_FACTOR=100` deja que una misma máquina haga de varios vecinos (hay un tope de 10 dispositivos por hora por IP).
- `RATE_LIMIT_FACTOR_CUENTAS=10` evita el `429` en el ingreso del panel si se ensaya dos veces seguidas.
- Esperar a que `docker compose ps` muestre `backend` como `healthy` y el `sembrador` como `Exited (0)`: ya cargó los 211 barrios.
- **Memoria:** el backend usa hasta el 75 % de la memoria que Docker Desktop le dé. Con 2 GiB, una segunda pila de `docker compose` al lado
  (por ejemplo otra copia del repositorio) mata al backend por falta de memoria en bucle. Una sola pila a la vez.

Luego el frontend, en otra terminal:

```bash
cd frontend
npm ci
npm run build && npm run preview     # http://localhost:4173, con el proxy a http://localhost:8081
```

Tener abiertas tres cosas: la app (`http://localhost:4173`), Mailhog (`http://localhost:8025`) y, para la última parte, el panel (`/panel/ingreso`).

## Los pasos

Cada paso dice qué se hace, qué debe verse y cuál es la frase para el público.

| # | Quién | Qué hace | Qué debe verse | Para decir |
|---|---|---|---|---|
| 0 | Presentador | Abre `/cumplimiento` | «Aún no hay cortes cerrados para medir» y cuántos cortes vencidos sin cierre confirmado | «La base está limpia: el Índice todavía no tiene nada que medir» |
| 1 | Suscriptor | `/avisos?sector=<barrio>` → correo → «Enviar enlace de confirmación». En Mailhog abre el correo y pulsa el enlace → «Confirmar avisos» | «Avisos confirmados» | «No necesita cuenta: confirma su correo y listo» |
| 2 | Vecino que mira | Abre la ficha del barrio y la deja abierta | «En vivo» junto a la fecha; el barrio **sin** «Sin servicio» | «Esta pantalla no se va a recargar» |
| 3 | Vecino 1 | Celular, `Usar mi ubicación` → `Reportar lo que pasa en mi casa` → `No tengo agua` → sube una foto | «Reporte recibido»; «Foto recibida. Un moderador la revisa antes de que se publique.» El mapa no cambia | «Un reporte solo no mueve nada: hace falta que otros coincidan» |
| 4 | Veedor | `/panel/ingreso` con el ADMIN (la primera vez da de alta el segundo factor: [`scripts/codigo-totp.mjs`](../../scripts/codigo-totp.mjs) calcula el código). En la cola: el reporte con su foto y «Ubicación verificada dentro del barrio» → `Aprobar` → `Sí, aprobar` | El reporte sale de la cola; la foto pasa a ser pública | «Nada llega al mapa sin que una persona pueda revisarlo» |
| 5 | Vecinos 2 y 3 | Otros dos celulares, igual que el vecino 1 y sin foto | **En la pestaña del paso 2, sin recargar**, el barrio pasa a «Sin servicio» en menos de ~2 s tras el tercer reporte | «Tres vecinos distintos, con la ubicación verificada: ese es el quórum» |
| 6 | Suscriptor | Mailhog | Llegó el aviso del cambio, con el enlace de baja y «¿Ya volvió el agua?» | «Se enteró sin entrar a la página» |
| 7 | Veedor | `/panel/cortes` → `Registrar un corte` (el barrio, inicio hace 3 h, fin prometido hace 2 min, causa) → `Cerrar este barrio` con la hora real de hace 1 min | El corte pasa a «Restablecido» | «Prometieron cerrar a tal hora; volvió a tal otra» |
| 8 | Presentador | Recarga `/cumplimiento` | Ya hay **1 corte cerrado** con lo prometido y lo que duró | «Con una sola medición no se concluye nada, y la página lo dice (muestra mínima de 5 cortes)» |
| 9 | Suscriptor | Abre «¿Ya volvió el agua?» desde el aviso → `Sí, ya volvió el agua` | «Gracias. Tu respuesta cuenta junto con la de tus vecinos.» | «Su respuesta cuenta, pero no cambia el mapa por sí sola» |

### Si algo falla en vivo

- **El mapa no cambia tras el tercer reporte:** casi siempre es que los tres reportes salieron de un barrio grande (el umbral sube con la población)
  o sin ubicación verificada. Con un barrio de 3 000 habitantes o menos el umbral es 3. Repetir con otro barrio sin datos.
- **`429` en un reporte:** se agotó el cupo de un dispositivo (3 reportes por barrio cada 30 minutos). Abrir una ventana privada: es otro dispositivo.
- **El correo no llega:** mirar Mailhog (`http://localhost:8025`); si el backend se reinició, `docker compose logs backend`.
- **No entra al panel:** la clave del ADMIN solo se imprime una vez. Si se perdió: `node scripts/restablecer-admin.mjs`.

## Recorrerlo con un solo comando

El mismo guion, por la interfaz y sin tocar nada a mano, está escrito como prueba de Playwright
([`frontend/e2e/demo/guion-demo.spec.ts`](../../frontend/e2e/demo/guion-demo.spec.ts)). Con la pila de arriba arriba y la base limpia:

```bash
cd frontend
PANEL_CORREO=admin@aguavigia.local PANEL_CLAVE='<la clave del log>' npm run demo:guion
```

Deja las capturas de cada paso y una línea de tiempo en `frontend/test-results/demo/`. No forma parte de `test:e2e:real` a propósito: cambia el
mapa y el Índice y los otros specs reales suponen la base como la deja la siembra.

## Alternativa: la simulación

Si la sala no deja ensayar con vecinos de verdad (un solo teléfono, sin tiempo), la **instancia de simulación** corre un día entero de Cartagena
en minutos y comprueba lo que pasa. Es otra instancia del backend, con su propia base, que **nunca toca el mapa real**.

```bash
node scripts/simulacion/preparar.mjs                                       # genera SIMULACION_CLAVE en .env (no se muestra)
docker compose --profile simulacion up -d --build backend-sim               # API de la simulación en http://localhost:8082
cd frontend && AGUAVIGIA_BACKEND=http://localhost:8082 npm run preview      # la interfaz apuntada a la simulación
docker compose --profile simulacion run --rm simulador iniciar --velocidad 300   # ≈ 3 min
```

- La interfaz muestra una franja fija **«Simulación. Datos de una simulación; no son reales.»** en todas las pantallas mientras la API diga
  `modo: SIMULACION`. Una simulación nunca se presenta como real. Si en la sala no se ve la franja, no se está mirando la simulación.
- Qué ocurre en cada minuto y qué se comprueba: [`scripts/simulacion/README.md`](../../scripts/simulacion/README.md).
- No hay credenciales fijas del panel en la simulación (sus claves son aleatorias): si hay que mostrar la moderación, se pide una sesión de simulación a Sebastian.

## Qué dice cada pantalla de la demostración (para no improvisar)

- **Mapa y ficha:** el estado y quién lo sostiene («Reportes de vecinos», «Aviso oficial de Acuacar»); nunca un cambio sin fuente.
- **Panel:** solo las acciones que los permisos de la cuenta permiten. Un observador ve todo y no puede decidir nada.
- **Cumplimiento:** lo prometido frente a lo real **por corte**; con menos de 5 cortes dice que la muestra es pequeña y no concluye.
- **Avisos:** gratis y sin cuenta; el correo tiene tres enlaces (confirmar, baja y «¿ya volvió?»), y ninguno actúa al abrirse, solo al pulsar el botón.

## Cómo salió la última ejecución

Ver la sección «Ejecución del guion» de [`FE7-integracion-y-entrega.md`](FE7-integracion-y-entrega.md#ejecución-del-guion).
