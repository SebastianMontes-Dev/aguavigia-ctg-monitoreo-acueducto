# FE7 · Integración y entrega

> **Diseño:** esta fase hereda el rediseño vigente (ADR-103 a 106). Antes de construir, lee [`rediseno-vigente.md`](rediseno-vigente.md) §4 (reglas) y §5 (qué le toca a esta fase y qué está por decidir).

**Objetivo:** cerrar el frontend para la sustentación. Cubrir todo el contrato, medir accesibilidad y rendimiento, retirar
lo provisional y dejar un guion de demostración que funcione con un solo `docker compose up`.

Rama: `feature/fe7-integracion`. Depende de FE0–FE6. Esfuerzo: 2 sesiones.

## Trabajo

1. **Cobertura del contrato.** Un script (`frontend/scripts/cobertura-contrato.mjs`) lista las rutas de `backend/openapi.yaml` que ningún módulo de `src/api` llama.
   - Solo pueden quedar las excluidas en el [README](README.md#fases): `/api/sim/**`, `/api/iot/presion`, `/api/v2/requests.json`, `/api/cuentas/enlaces/*` y `/api/analitica/cumplimiento` con su `/mensual`, más las JSON de FE6b si no se hizo.
   - Se añade al CI.
2. **Lo provisional:**
   - `/muestrario` se retira de la navegación o queda solo en desarrollo
   - `Pendiente.tsx` desaparece. `/historial` pasa a ser una página mínima con las tres vistas de historia (Cumplimiento, Bitácora, Estadísticas), en grafito y con bloques (ADR-107, D5); `NoEncontrada` pasa a su propio archivo
3. **Accesibilidad** ([`guia-frontend.md` §8.2](../diseno/guia-frontend.md#82-comprobaciones-posteriores-sobre-la-interfaz)):
   - axe sin violaciones en todas las pantallas, con `@axe-core/playwright` en e2e
   - todo recorrible con teclado y foco visible
   - el mapa tiene alternativa en lista
   - texto al 200 %
   - movimiento reducido
4. **Rendimiento:**
   - con 3G simulado, una respuesta útil antes de 3 s (RNF001)
   - con 211 sectores, un solo SSE por pestaña
   - la geometría se cachea un día
   - se anotan las cifras reales en este archivo
5. **Cinco segundos:** la prueba con una persona en las pantallas principales (mapa, ficha, cumplimiento, panel), anotando el resultado.
6. **Guion de la demo** en `docs/frontend/guion-demo.md`. Pasos exactos, desde un `docker compose up` limpio:
   - ciudadano reporta con foto
   - el veedor modera
   - el consenso cambia el mapa en vivo
   - el corte se cierra
   - el Índice se mueve
   - un suscriptor recibe el aviso y responde «ya volvió»

   Con alternativa en modo simulación, con su banner. Es la base de la guía «08 · Guion de la presentación» de `docs/README.md`.
7. **Documentación:**
   - `guia-frontend.md` §8.2 se marca con los resultados reales
   - el README de esta carpeta, con todas las fases ✅
   - `docs/api/cambios-para-frontend.md`: se anota qué secciones F0–F6 quedaron adoptadas

## Cómo quedó (2026-11-03)

Rama `feature/fe7-integracion` (sin push ni PR). Todo lo medido es de una máquina de desarrollo; los tiempos cambian de una a otra.

### 1. Cobertura del contrato

`npm run api:cobertura` (`frontend/scripts/cobertura-contrato.mjs`, paso «Cobertura del contrato» de `frontend-ci.yml`): 81 rutas y 87 operaciones, 14 excluidas a propósito, **sin huecos**. Además de las exclusiones de
[`README.md`](README.md#fases), quedaron fuera las tres `POST` JSON de FE6b (`/api/cuentas/verificacion`, `/invitacion`, `/clave`: no se hizo FE6b, decisión D-C) y `GET /api/fotos/{nombre}` (no hay lista pública de reportes que la use; el panel usa
`/api/veedor/fotos`). Si se quiere quitar esa última exclusión, hay que construir una pantalla que la consuma.

### 2. Lo provisional

`Pendiente.tsx` ya no existe; `/historial` es una página en grafito con tres bloques (ADR-110); `NoEncontrada` tiene su archivo; `/muestrario` solo existe en desarrollo y la build de producción no lo trae.

### 3. Accesibilidad

`@axe-core/playwright`: **cero violaciones** de WCAG 2.2 AA en 34 pantallas y estados (públicas, cuentas, vecino, panel, y con algo abierto: hoja de reporte, buscador con opciones, invitar, registrar un corte, confirmar una aprobación), en claro y oscuro, escritorio y
celular (`e2e/accesibilidad.spec.ts`, lista en `e2e/pantallas.ts`). Además: recorrido con teclado y foco visible, foco devuelto al cerrar (`e2e/teclado-y-zoom.spec.ts`), alternativa en lista del mapa, texto al 200 % (`e2e/texto-grande.spec.ts`) y movimiento reducido.
Se corrigió el tamaño táctil de los enlaces del pie de las cuentas y las consultas de medios pasaron de `px` a `em` (ADR-110).

**Sin resolver:** a 360 px de ancho **con la letra base al doble**, 9 de 10 pantallas se salen de la ventana entre 20 y 250 px (pestañas, selector de barrio, tablas). A 320 px con letra normal sí reflujan. Queda para Yordy.

### 4. Rendimiento (RNF001)

`node frontend/scripts/medir-rendimiento.mjs` contra la aplicación servida (`vite preview`) y un backend real con 211 sectores. Celular 390×844, caché vacía en cada carga, mediana de 5 cargas en frío (2 en Slow 3G). «Respuesta útil» es el instante en que aparece en pantalla lo que contesta la pregunta de la ruta.

| Ruta | Fast 3G, CPU 4× más lenta | Fast 3G, CPU normal | Slow 3G, CPU 4× más lenta | Transferido (Fast 3G) | Peticiones |
|---|---|---|---|---|---|
| `/` · ¿cómo está Cartagena ahora? | **2,61 s** | 2,52 s | 9,54 s | 296 KB | 9 |
| `/sectores/armenia` · ¿hay agua en mi barrio? | **2,62 s** | 2,52 s | 9,58 s | 303 KB | 13 |
| `/cumplimiento` · ¿cumplen los cortes? | **2,60 s** | 2,50 s | 9,46 s | 298 KB | 11 |

- **Con «3G simulado» (Fast 3G de DevTools: 1,6 Mbps, 562 ms de latencia) las tres respuestas llegan antes de 3 s.** Con Slow 3G (400 kbps, 2 s de latencia) tardan unos 9,5 s: la interfaz no promete nada ahí.
- Qué lo logró: pedir el listado (mapa y ficha) y el índice con su serie (Cumplimiento) desde `index.html`, mientras baja el JavaScript (`src/api/precarga.ts`); agrupar las librerías de la primera pantalla (21 peticiones pasaron a 9); y quitar las conexiones persistentes del proxy de Vite, que devolvía `502` y retrasaba la portada 5 s o más (solo afectaba a `vite preview`/`dev`, no a la build). Antes de la precarga del índice, Cumplimiento tardaba 3,1–3,2 s: no cumplía.
- **Un solo SSE a la vez por pestaña con 211 sectores.** Tras cargar la portada hay 1 abierto; al recorrer 6 pantallas sin recargar se abrieron 4 en total (el canal se cierra en las pantallas que no lo usan y se reabre al volver), nunca más de 1 a la vez. Una segunda pestaña abre 1 propio.
- **Geometría cacheada un día:** `Cache-Control: max-age=86400, public`; se descarga 1 vez por pestaña y **0 veces al recargarla** (la guarda IndexedDB).

### 5. Ejecución del guion

Sobre una pila aparte (`docker compose -p fe7demo`, puertos 28081/28025, volúmenes nuevos), con `INGESTA_MODO=local`, `RATE_LIMIT_FACTOR=100` y `RATE_LIMIT_FACTOR_CUENTAS=10`, desde `docker compose up -d` **sobre volúmenes recién borrados** (`down -v`), sin tocar nada a mano: `npm run demo:guion` con `PANEL_CORREO` y `PANEL_CLAVE` leídos del log del backend.

**Pasó de principio a fin (25,4 s)** la segunda vez, con el spec ya endurecido. Línea de tiempo (barrio Albornoz, 853 habitantes, umbral de 3 vecinos):

| Segundos | Paso | Qué se vio |
|---|---|---|
| 0,5 | 0 · base limpia | 211 barrios, ninguno con estado |
| 1,0 | 0 · el Índice antes | «Aún no hay cortes cerrados para medir» |
| 2,2 | 1 · suscriptor | confirmó su correo desde el enlace de Mailhog |
| 3,6 | 2 · el mapa abierto | «En vivo»; el barrio sin «Sin servicio» |
| 8,1 | 3 · primer vecino | reportó con ubicación y foto: «en revisión»; el mapa no cambió |
| 9,7 | 4 · el veedor | aprobó el reporte y su foto (alta del segundo factor incluida) |
| 22,8 | 5 · consenso | el barrio pasó a «Sin servicio» **3,3 s después del tercer reporte, sin recargar** |
| 22,8 | 6 · aviso | el suscriptor recibió el correo con la baja y «¿Ya volvió el agua?» |
| 23,7 | 7 · corte | el veedor lo registró y lo cerró: «Restablecido» |
| 24,0 | 8 · el Índice | «1 corte cerrado», 1 min tarde, y dice que con uno solo no se concluye |
| 24,6 | 9 · «ya volvió» | el suscriptor respondió y vio «Gracias. Tu respuesta cuenta junto con la de tus vecinos.» |

Qué pasó en el camino, tal cual:

- **Primera ejecución (sobre volúmenes borrados): pasó,** pero su comprobación del «antes» era débil: capturó la pantalla en «Consultando el cumplimiento…» y solo comparaba que el texto cambiara. Se endureció para exigir «Aún no hay cortes cerrados» y se repitió sobre otra base limpia.
- La demo **no es repetible sobre la misma base**: deja un barrio en «Sin servicio», un corte cerrado y al ADMIN con su segundo factor dado de alta. Para repetirla hay que borrar los volúmenes (`docker compose down -v`).
- **El modo simulación no se ejecutó** en FE7: está descrito en el guion, pero no se levantó `backend-sim` ni se miró su banner de punta a punta (el banner sí lo cubren los e2e simulados de FE1).
- No hay credenciales fijas del panel: la clave del ADMIN sale del log (ADR-086) y la lee la prueba sin que nadie la copie.

### 6. e2e reales del panel y flujo de invitación

Contra la misma pila (`fe7demo`), preparada como el job «backend real» del CI (`sembrar-sectores`, `sembrar-demo`, `sembrar-historico-cortes --sobre-datos-reales`, `preparar-pruebas-frontend --sobre-datos-reales` y `FLUSHDB` de Redis) y con el ADMIN inicial (`PANEL_CORREO`, `PANEL_CLAVE`):

**`npm run test:e2e:real`: 25 de 25 en una sola pasada (4,9 min)**, entre ellas las de FE2 a FE5 que nunca habían corrido (`panel.spec.ts`, `veedor-moderacion-y-cortes.spec.ts`, `veedor-ingesta.spec.ts`, `veedor-administracion.spec.ts`) y la nueva `veedor-invitacion.spec.ts`: el ADMIN invita a una persona como observador → el correo llega a Mailhog → la página HTML del backend para elegir la clave → ingreso en la SPA → ve la cola con el aviso «Tu cuenta puede ver la cola, pero no decidir», sin botones de decidir; por la API, `GET /veedor/reportes/pendientes` da `200`, `PATCH …/aprobar` da `403` y `GET /veedor/usuarios` da `403`.

Qué pasó en el camino (para no repetirlo):

- `panel.spec.ts` **cambia la clave del ADMIN** y la nueva solo queda en `test-results/estado-panel-real.json`, que Playwright borra al empezar la corrida siguiente. Entre dos corridas sobre la misma base hay que fijar de nuevo la clave y quitar el segundo factor: `scripts/restablecer-admin.mjs --correo … --clave-del-env` (con `VEEDOR_PASSWORD_HASH` de una clave conocida) y vaciar las llaves `login:*` de Redis si hubo fallos (el bloqueo dura ~15 min). En el CI no pasa: la base nace limpia.
- `debeActualizarElEstadoPorConsensoSSESinRecargarLaPagina` **no se puede repetir** sobre la misma base: deja a Arroyo Grande en «Sin servicio» y el cambio inverso choca con el anti-rebote. Con `preparar-pruebas-frontend` y `FLUSHDB` pasa.
- `debeCrearUnCorteCerrarloBarrioPorBarrioYVerloEnLaFichaPublica` tenía una carrera: contaba «Volvió» justo tras el titular, antes de que llegara la lista de cortes. Ahora espera la respuesta de `/cortes`.
- `cumplimiento.spec.ts` pide historial (≥ 5 cortes): sobre una base solo con `docker compose up` falla; con `sembrar-historico-cortes` pasa. Es lo que ya hace el CI.

**Propuesta para Sebastian (no aplicada; `preparar-env-ci.mjs` y los secretos no se tocaron).** El job «Núcleo ciudadano contra backend real» hoy no pasa `PANEL_CORREO` ni `PANEL_CLAVE`, así que las pruebas del panel se omiten. No hace falta ningún secreto nuevo: el backend ya genera la clave del ADMIN al arrancar y la imprime en el log (ADR-086; `preparar-env-ci.mjs` ya fija `ADMIN_INICIAL_CORREO=admin@example.test` y no define `VEEDOR_PASSWORD_HASH`). Dos cambios en `.github/workflows/frontend-ci.yml`:

```yaml
      - name: Levantar el backend con el límite de peticiones holgado
        env:
          RATE_LIMIT_FACTOR: "100"
          RATE_LIMIT_FACTOR_CUENTAS: "10"   # NUEVO: el flujo de invitación y el de vecino gastan peticiones de /api/cuentas/**
        run: docker compose up -d --build --wait mongo redis mailhog backend
      # ... después de «Sembrar demo y casos de borde» y antes de «npm ci» del frontend:
      - name: Leer la clave del ADMIN inicial del log del backend
        run: |
          clave=$(docker compose logs backend | grep -o 'ADMINISTRADOR INICIAL[^"]*' | sed -n 's/.*clave: \([^ ]*\) | .*/\1/p' | head -1)
          test -n "$clave"
          echo "::add-mask::$clave"
          echo "PANEL_CORREO=admin@example.test" >> "$GITHUB_ENV"
          echo "PANEL_CLAVE=$clave" >> "$GITHUB_ENV"
```

`npm run test:e2e:real` ya lee `PANEL_CORREO` y `PANEL_CLAVE` del entorno. La extracción se probó localmente contra el log de esta pila. Lo que no se probó es el job en GitHub Actions: hay que verlo correr.

### 7. Capturas y `revisar-diseno`

408 capturas (34 pantallas × 4 anchos × claro, oscuro y movimiento reducido), tomadas con `CAPTURAS=1 CAPTURAS_DIR=<carpeta> npx playwright test e2e/capturas.spec.ts --project=escritorio`. `CAPTURAS_DIR` es necesario: Playwright vacía `test-results/` al empezar **cada** corrida,
también con `-g`, y se pierde todo lo tomado. Se miraron las de las pantallas principales (mapa, ficha, Historial, Cumplimiento, Estadísticas, ingreso al panel, moderación, cortes, ingesta, cuentas, invitar, hoja de reporte) en los cuatro anchos y las tres variantes, y se revisó el CSS añadido (92 líneas:
sin hexadecimales fuera de `tokens.css`, sin `font-family` fuera de los tokens, sin `transition` ni `animation` nuevos, sin `box-shadow`).

**Sin hallazgos que bloqueen.** Para pulir (no se tocaron):

| Gravedad | Pantalla y tamaño | Elemento | Qué se ve | Corrección |
|---|---|---|---|---|
| pule | Panel, 390 y 768 | Navegación del panel | La fila de pestañas se corta a la derecha («Si…», «Vo…») y se desplaza | Está bien como patrón, pero conviene una sombra o un borde que avise que sigue |
| pule | Panel, 390 | Cabecera | «Cerrar sesión» queda en una fila propia y empuja el contenido ~50 px | Ponerlo junto al nombre, o dentro de un menú |
| pule | Historial, 1440 | Bloques | Los tres bloques ocupan solo la mitad superior; el resto queda vacío | Es una página de paso a propósito (ADR-110); se puede alinear al centro vertical |
| pule | Estadísticas, 1440 | «Barrios con más cortes» | Con 3 barrios queda un hueco entre la lista y el enlace del pie | Anclar el pie a la lista, no al fondo del bloque |

### 8. La prueba de los cinco segundos (para Yordy)

Una sesión de Claude no puede hacerla: necesita a una persona que no haya visto la página. Pasos:

1. Elige a alguien que no conozca el proyecto. No le expliques nada.
2. Con `npm run build && npm run preview` y la pila de `docker compose up` (o la simulación) arriba, abre **sin tocar nada** y de a una: el mapa (`/`), una ficha (`/sectores/armenia`), Cumplimiento (`/cumplimiento`) y el panel (`/panel`, con sesión de veedor).
3. En cada una, a 1440×900 y a 390×844, muéstrala **cinco segundos** y tápala. Pregunta: «¿qué responde esta página?» y «¿qué puedes hacer aquí?».
4. Anota la respuesta textual y si coincide con el titular de la pantalla. Pasa si lo dice sin bajar la página.
5. Si falla en alguna, anota cuál y qué entendió en su lugar; abre un ADR solo si el cambio es de diseño.
6. Anota el resultado aquí, con fecha: ______

## Terminado cuando

- Pasa la puerta completa.
- La cobertura del contrato no tiene huecos fuera de las exclusiones.
- axe está en verde.
- El guion de la demo se ejecutó de principio a fin sobre una base limpia sin tocar nada a mano.

## Prompt para Claude Code

```
Usa la skill disenar-frontend. Lee docs/frontend/README.md y docs/frontend/FE7-integracion-y-entrega.md.
En feature/fe7-integracion desde develop: crea el script de cobertura del contrato y súmalo al CI, retira lo provisional,
añade axe a los e2e, mide rendimiento con 3G simulado, escribe docs/frontend/guion-demo.md y ejecútalo de principio a fin
sobre un docker compose up limpio. Corre la puerta completa y muéstrame el resultado. Abre el PR, no lo fusiones.
Si usas subagentes, usa model sonnet.
```
