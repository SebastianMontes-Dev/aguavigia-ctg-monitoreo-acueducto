# El rediseño vigente y cómo se continúa

Resumen de lo que trabajó el rediseño de las vistas de datos ([PR #122](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/122),
2026-10-25 a 2026-10-30) y de lo que **falta** del plan ([`README.md`](README.md), FE2–FE7), para que cada fase nueva
herede ese diseño en vez de volver a la composición de ADR-070. Documento del 2026-10-30. Las decisiones están en los ADR-103 a 106 y,
para el panel, en el ADR-107 de [`07-decisiones-clave.md`](../07-decisiones-clave.md) §7–§11; este archivo solo las junta con los archivos
que las llevan y con lo que falta.

## 1. Qué cambió, en una tabla

| ADR | Pantallas | Qué quedó |
|---|---|---|
| [103](../07-decisiones-clave.md) (2026-10-25) | Ficha del barrio (`/sectores/:id`) | Composición en bloques: nombre, **estado en un recuadro teñido de su color**, «Último aviso», botón de reporte a todo el ancho y, tras una regla, el historial de cortes. Iconos funcionales junto a una palabra |
| [104](../07-decisiones-clave.md) (2026-10-25) | Cumplimiento, Bitácora, Estadísticas, Avisos y los enlaces de avisos | El lenguaje de la ficha en cuatro páginas: bloques de `--tarjeta`, el titular es la respuesta, **una cifra y una forma que se leen solas** (la línea de tiempo de Cumplimiento) |
| [105](../07-decisiones-clave.md) (2026-10-25) | Las mismas cuatro | **Grafito** en oscuro, ancho de 1320 px, bordes de campo a 3:1, **muestra mínima de 5 cortes**, bitácora por día con una fila por evento, errores junto a cada campo en Avisos |
| [106](../07-decisiones-clave.md) (2026-10-30) | Estadísticas | Un bloque con **cuatro gráficas y un selector** (Por día, Duración, Cierres, Novedades) y un **PDF A4 de descarga directa** compuesto en el navegador |

Fuente única de cada cosa: los colores en [`DESIGN.md`](../../DESIGN.md) §3.1; las reglas de composición y la excepción a
ADR-070 en [`identidad.md`](../diseno/identidad.md) §4 y §6; los datos de cada pantalla en [`guia-frontend.md`](../diseno/guia-frontend.md) §5.

## 2. Lo que no cambió

- **El mapa y sus colores.** Lee los colores de `:root` mientras corre (`estilo-base.ts`, `capas-sectores.ts`); por eso el grafito
  nunca se declara en `:root`.
- **Los cuatro estados** (ADR-042), el latón y el **tema claro**.
- **El contrato.** Ningún cambio en `src/api/` ni en los hooks de datos del rediseño: todo sale de rutas que ya existían.
- **Las pantallas que no se tocaron:** el reporte (hoja sobre el mapa) y `/confirmar/:id`, el Historial del celular (`Pendiente.tsx`) y `/muestrario`.

## 3. Las piezas que se reutilizan

| Pieza | Dónde | Para qué |
|---|---|---|
| `.bloque`, `.tenido`, `.cifras`, `.fila`, `.pastilla`, `.circulo`, `.rotulo`, `.titulo`, `.bajada`, `.compacto`, `.conIcono` | `frontend/src/componentes/Bloques.module.css` | El bloque sin sombra (`--tarjeta`, borde `--linea`, radio `--radio-flotante`), el recuadro teñido, la fila de cifras, la fila compacta y la pastilla |
| `.vista` y el titular | `frontend/src/pantallas/publico/Pagina.module.css` | Ancho de 1320 px, un solo rótulo, titular y espaciado |
| `--tarjeta` | `frontend/src/estilos/tokens.css` | Fondo de un bloque; fuera del grafito vale `--elevada` |
| `[data-paleta='grafito']` | `tokens.css`; lo pone `Marco.tsx` con `usaGrafito(ruta)` sobre `<body>` | La paleta oscura de las páginas de lectura. Se añade una ruta a la lista `CON_GRAFITO` de `Marco.tsx` |
| `GlifoEstado`, `Icono` | `frontend/src/componentes/` | El glifo del estado (forma + palabra, nunca solo color) y los iconos funcionales |
| `MUESTRA_SUFICIENTE = 5` | `frontend/src/dominio/muestra.ts` | Por debajo, se muestra la cantidad pero no se concluye |
| `imprimirEnClaro`, `InformeEstadisticas` | `frontend/src/` (ADR-106) | Solo `/estadisticas`; no es un patrón general |
| `contraste.test.ts`, `tokens.test.ts` | `frontend/src/estilos/` | Fijan los contrastes del grafito y que `tokens.css` copie lo de `DESIGN.md` |

## 4. Reglas que cada pantalla nueva hereda

Salen de los ADR-103 a 106 y de [`identidad.md`](../diseno/identidad.md) §4.1; ninguna es nueva.

1. **El titular es la respuesta** (ADR-079): la pantalla se entiende en 5 s, sin scroll largo, con una cifra grande y una forma que se lea sola.
2. **Bloques, no reglas de 1 px.** `--tarjeta`, borde `--linea`, radio 12 px, sin sombra. Dos columnas en escritorio.
3. **Iconos solo funcionales y siempre junto a una palabra.** El estado se dice con glifo y palabra, no solo con color.
4. **Color de estado solo para el estado del servicio.** El recuadro principal de una página sin estado se tiñe de `--cardenillo`. Sin dato verificado, sin tinte (ADR-014).
5. **El dato pequeño se dice como pequeño:** menos de 5 cortes, sin veredicto, sin tendencia y sin «el día con más». Un día sin dato no es un día con cero.
6. **Nada que la API no devuelva.** Cada cifra sale de un campo del contrato; lo que no se sabe se dice (por ejemplo, que el contrato no enlaza la fuente de un corte concreto, ADR-102).
7. **Errores junto a su campo** (`aria-invalid`, `aria-describedby`, foco en el primer error) y **borde de control a 3:1** (`--tinta-3`), también en claro.
8. **Una sola representación de cada dato por tamaño** y el detalle detrás de una acción (ADR-077, ADR-079).
9. **Ambos temas, cuatro anchos** (1440, 1024, 768, 390) y movimiento reducido; ninguna sombra ni animación decorativa.
10. **El mapa no se toca** al cambiar un token: se comprueba con tokens computados y píxeles antes y después.

## 5. Lo que falta, y cómo lo recibe el rediseño

Estado de las fases al 2026-10-31 (la tabla de [`README.md`](README.md) tiene el detalle y los PR):
FE0 y FE1 están en `develop` desde el [PR #122](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/122); **FE2 a FE5 están construidas** y viven en la rama
`claude/fe3-moderacion-y-cortes-6979a7`, que falta llevar a `develop`; FE6 está en el [PR #129](https://github.com/SebastianMontes-Dev/aguavigia-ctg-monitoreo-acueducto/pull/129); FE7 sin empezar. Las decisiones D1 a D5 se aplicaron
(grafito, bloques con tablas, 1320 px); D5 sigue pendiente porque es de FE7. Lo que sigue, FE7, hereda además el rediseño de Avisos (ADR-108) y el del ingreso y el alta del segundo factor a dos columnas.

### Decisiones del panel (ADR-107, 2026-10-30)

Yordy las decidió el 2026-10-30 y están en el [ADR-107](../07-decisiones-clave.md) (§11). Si una fase choca con ellas, se vuelve a decidir con Yordy y se registra un ADR nuevo.

| # | Decisión | Qué implica |
|---|---|---|
| D1 | **Sin colores nuevos.** El ingreso, las cuentas, el perfil del vecino y el panel usan el grafito del rediseño | Sus rutas se suman a `CON_GRAFITO` de `Marco.tsx`. Los colores de estado siguen siendo del servicio de agua: no pintan estados de cuenta ni decisiones de moderación (guía §4.2) |
| D2 | **Bloques con tablas dentro** | Cuentas y auditoría, como tabla con columnas dentro de un bloque `--tarjeta`, paginada por cabeceras. La cola de reportes usa la fila compacta de la Bitácora |
| D3 | **1320 px** | El ancho de las páginas de lectura (`.vista`); la guía decía 1200 px |
| D4 | **Iconos como hasta ahora** (no se preguntó) | Solo funcionales y junto a una palabra; aprobar y descartar con texto y confirmación |
| D5 | **`/historial` pasa a una página mínima** con las tres vistas de historia | En grafito y con bloques. `Pendiente.tsx` se elimina en FE7 y `NoEncontrada` pasa a su propio archivo |

### Qué le toca a cada fase

| Fase | Qué falta | Cómo hereda el rediseño |
|---|---|---|
| **FE2** · [ingreso al panel](FE2-ingreso-al-panel.md) | Ingreso, segundo factor con QR, marco con permisos, seguridad de la cuenta. Base: `feat/f5-ingreso-panel`, que usa el diseño de antes del rediseño | Con el grafito (D1), los formularios toman el patrón de Avisos: un bloque, errores junto al campo, borde a 3:1. **Hay que re-vestir** lo que traiga la rama vieja con las reglas de §4 al integrarla, no solo adaptar sus tipos |
| **FE3** · [moderación y cortes](FE3-moderacion-y-cortes.md) | Cola de reportes, fotos, cortes, vencidos, disputas | La cola usa la fila compacta de la Bitácora (glifo en círculo, qué pasó, hora). La señal de red es una señal, no una acusación (ya dicho en la guía). Confirmación antes de aprobar o descartar |
| **FE4** · [ingesta](FE4-ingesta.md) | Propuestas, documentos fallidos, salud de los colectores | La **frase exacta del boletín** que respalda la extracción va a la vista (ética 4). La salud de los colectores, como fila de cifras en un bloque |
| **FE5** · [administración](FE5-administracion.md) | Cuentas, permisos, auditoría, métricas, copia analítica | Cuentas y auditoría como tabla dentro de un bloque, paginada por cabeceras (D2). Las cuentas sintéticas nunca se cuentan como personas. Las cifras, en una fila como Estadísticas, y con la regla de la muestra pequeña donde aplique |
| **FE6** · [cuentas y vecino](FE6-cuentas-y-vecino.md) | Registro, restablecimiento, ingreso y perfil del vecino; reportar con su sesión | Formularios de 480 px en un bloque, como Avisos; los enlaces del correo siguen siendo páginas HTML del backend |
| **FE7** · [integración y entrega](FE7-integracion-y-entrega.md) | Convertir `/historial` en la página mínima de D5, quitar `Pendiente.tsx` y sacar `/muestrario` de la navegación; axe sin violaciones con el grafito; guion de la demo; capturas y prueba de los cinco segundos | `/muestrario` hoy muestra el sistema de ADR-070: debe mostrar `--tarjeta`, grafito, bloques y glifos o retirarse. Revisar el PDF en Safari y Firefox |

## 6. Pendientes del propio rediseño

Quedaron fuera del PR #122 y no son de una fase:

- **El rediseño del ingreso y del alta del segundo factor a dos columnas** (commit `7a5e674`, 2026-10-31) **no tiene ADR.** La skill `disenar-frontend` pide registrar una decisión visual nueva en `docs/07-decisiones-clave.md` y `identidad.md`; el siguiente número libre es el 109. Hay que registrarlo antes de cerrar FE7.
- **El orden de las capas CSS** se fija ahora en `frontend/index.html` (commit `8b1861d`, del PR #129) y debe coincidir con `frontend/src/estilos/capas.css`. Cambió el aspecto de todas las pantallas de la build: hay que mirar las de FE2 a FE5 antes de dar por buena FE7.
- **Las capturas de FE5 se perdieron** (`npm run test:e2e` borra `frontend/test-results/`): hay que sacarlas de nuevo después del último e2e, o respaldarlas fuera de esa carpeta.
- **El e2e real del panel** (FE2 a FE5) no ha corrido nunca; ver la actualización del 2026-10-31 de [`README.md`](README.md).

- **Descarga del PDF en Safari y Firefox:** sin probar (solo Chromium).
- **Backend (aviso a Sebastian):** `EstadisticasMongoAdapter` ordena los barrios solo por cantidad y limita a 5; con empates, cuáles aparecen cambia entre consultas. El frontend solo estabiliza el orden. Falta un desempate.
- **El CSV de Estadísticas** trae solo los barrios, no los días ni los meses.
- **Cumplimiento llama «91 cortes» a los cierres** (corte por barrio).
- **La Bitácora agrupa bajo «Mañana»** eventos de «hace menos de un minuto» y el mapa dice «generado mañana»: parece el reloj de la simulación, sin confirmar.
- **`npm audit`:** `seroval` (alta), que llega por TanStack Router y ya estaba antes.
- **La hoja del informe vive dos veces** (`@media print` e `InformeEstadisticas.tsx`): un cambio de composición se hace en ambas (ADR-106).
- **Dependencia nueva** `@react-pdf/renderer`, 442 KB comprimida, en un archivo aparte que solo se baja al pulsar el botón.

## 7. Para la sesión siguiente

1. Lee esto, [`guia-para-yordy.md`](guia-para-yordy.md) y la guía de la fase.
2. Antes de tocar la interfaz, la skill `disenar-frontend`; antes de cerrar, `revisar-diseno`.
3. Las decisiones del panel (D1 a D5) ya están en el ADR-107. Si algo te bloquea o choca con ellas, **se decide con Yordy y se registra como ADR-108** en `07-decisiones-clave.md` antes de construir.
4. La puerta de cierre es la del README: lint, typecheck, `api:check`, tests, e2e simulado y real, capturas en los cuatro anchos y dos temas, y la prueba de los cinco segundos.
