# Guion de la exposición: MongoDB, PostgreSQL, Redis y conexiones

**Duración:** 13 a 14 minutos. **Dónde:** todo en tu PC, **ya abierto y con los resultados ya ejecutados**.
**No hay que teclear nada.** Solo cambias de ventana o de pestaña con el ratón, miras y explicas. Cada escena dice: 🖥 *Mira* (qué ventana y pestaña), 👆 *Clic* (solo cuando hace falta) y 🎤 *Di* (el texto, casi palabra por palabra).
Todo se preparó y se comprobó en pantalla el 2026-11-16. Los números pueden variar un poco (por ejemplo, el id de la última copia o los segundos de vencimiento en Redis); lo que debe coincidir es lo que va en negrita.

---

## A. Lo que ya está abierto

| Ventana | Qué contiene | Para qué escenas |
|---|---|---|
| **Fotos** (2 ventanas, una al lado de la otra) | A la izquierda el diagrama SQL, a la derecha el diagrama NoSQL | 1, 2, 9 |
| **MongoDB Compass** (4 pestañas) | `aguavigia` (vista general de las 16 colecciones) · `sectores` (índices) · `reportes` (índices) · `cortes` (con sus cierres) | 4, 5 |
| **TablePlus** (3 pestañas, PostgreSQL) | `corte_sector` · `v_cumplimiento_global` · `vigilancia`, en el esquema `analitica` | 9, 10, 11 |
| **Visual Studio Code** (12 archivos en pestañas) | El código señalado, cada uno en su línea | 3, 5, 7, 8, 9, 11 |
| **Terminal de la app**, 4 pestañas (ya con los resultados) | **1 · Mongo** · **2 · PostgreSQL** · **3 · Redis** · **4 · Contenedores** | 1, 3, 4, 5, 8, 9, 10, 11 |

**Cómo se usa el terminal:** en cada pestaña ya está escrito y ejecutado todo, con títulos numerados (`══ 1. … ══`). No escribas nada: solo desplázate con la rueda del ratón hasta la sección que toque.

### Las 12 pestañas de VS Code, en orden de la exposición
`docker-compose.yml` (línea 28) · `TransaccionMongoAdapter.java` (24) · `IndicesMongo.java` (51) · `application-docker.yml` (8) · `application.yml` (89) · `MongoPoolConfig.java` (19) · `RedisConfig.java` (10) · `SseSectoresBroadcaster.java` (50) · `SqlConfig.java` (38) · `CopiaAnaliticaJob.java` (34) · `V1__esquema_analitico.sql` (25) · `V4__vigilancia_bitacora_y_lector.sql` (56, la última abierta).

### Qué NO tocar durante la grabación
- **En Compass:** no pulses **«Create index»**, **«Add data»**, el icono de la papelera, ni edites un documento. Compass a veces muestra un aviso azul que sugiere crear un índice: ciérralo con la ×.
- **En TablePlus:** no hagas doble clic dentro de una celda (se puede editar), no pulses **«Yes»** si aparece el aviso de licencia (compra) ni instales la actualización.
- **En el terminal:** si cierras una pestaña, se pierde lo que estaba en pantalla.
- Nunca ejecutes `docker compose down -v`: borra los volúmenes y todos los datos.

### Si algo se cierra o se ve mal
Pídeselo a Claude, por ejemplo: «reabre Compass» o «vuelve a dejar el terminal de Redis». Lo reabre con todo ya cargado.

---

## B. El guion, escena por escena

### Escena 1 · La idea central (0:00 – 0:40)

🖥 *Mira:* **Fotos**, los dos diagramas lado a lado. (Si prefieres, el terminal **4 · Contenedores**.)

🎤 *Di:*
> «AguaVigía guarda sus datos en tres sitios, y cada uno tiene un papel distinto. **MongoDB es la fuente de verdad**: ahí vive todo lo que el sistema sabe. **PostgreSQL es una copia derivada**, pensada para analizar esos datos con SQL. Y **Redis guarda solo estado temporal**: límites de peticiones, candados y avisos. La regla que lo une todo es esta: si Redis o PostgreSQL se caen, el sistema sigue funcionando. Si Mongo se cae, no hay sistema.»

---

### Escena 2 · MongoDB: por qué (0:40 – 1:40)

🖥 *Mira:* **Fotos**, el diagrama **NoSQL** (el de la derecha).

🎤 *Di:*
> «Elegimos Mongo por tres razones. Primera: nuestros datos son **documentos con listas dentro**. Fíjense en `CORTES`: cada corte lleva dentro la lista de barrios afectados y la lista de cierres, uno por barrio. En una base relacional serían tres tablas y uniones; aquí es un solo documento.
> Segunda: necesitamos **geografía**. Los 211 barrios de Cartagena están guardados como polígonos GeoJSON con un índice `2dsphere`, y eso nos permite preguntar a qué barrio pertenece un punto.
> Tercera: hay datos que **caducan solos**: los reportes, los enlaces de correo, los dispositivos y la auditoría. Eso lo hacen los índices TTL, sin que escribamos código de limpieza.»

---

### Escena 3 · El nodo de réplica (1:40 – 3:00)

🖥 *Mira:* **Terminal › pestaña «1 · Mongo»**, sección **1. EL NODO DE RÉPLICA**.
> Debe verse: **`mongo:27017` y `PRIMARY`**, un solo miembro.

🎤 *Di:*
> «Esto es el replica set. Se llama `rs0` y tiene **un solo nodo**: `mongo:27017`, en estado PRIMARY. Quiero ser claro: **esto no es alta disponibilidad**. No hay copia en otro nodo.
> Entonces, ¿por qué existe? Porque Mongo solo permite **transacciones entre varios documentos** si funciona como replica set. Y las necesitamos: cuando registramos o cerramos un corte, guardamos el corte, su bitácora y el estado de sus barrios, y tiene que ser todo o nada.»

🖥 *Mira:* **VS Code › `docker-compose.yml`** (línea 28: `--replSet rs0`; baja hasta la línea 46: el contenedor `mongo-init-replica`).

🎤 *Di:*
> «En el `docker-compose.yml` se ve cómo se monta: Mongo arranca con `--replSet rs0`, y un contenedor de un solo uso, `mongo-init-replica`, ejecuta `rs.initiate` la primera vez. Si ya está iniciado, no hace nada, así que repetir `docker compose up` no falla.»

🖥 *Mira (opcional, 20 s):* **VS Code › `TransaccionMongoAdapter.java`**.

🎤 *Di:*
> «En el código, las transacciones pasan por un puerto y un adaptador con reintento ante errores transitorios. Lo usan cinco casos de uso: gestionar un corte oficial, moderar un reporte, recalcular un barrio, expirar cortes vencidos y revisar propuestas de la ingesta.»

---

### Escena 4 · Las colecciones (3:00 – 5:00)

🖥 *Mira:* **MongoDB Compass › pestaña `aguavigia`**. Se ve la tabla de las **16 colecciones**, con documentos, tamaño e índices de cada una.

🎤 *Di:*
> «Tenemos 16 colecciones y las agrupamos en cuatro temas. **Territorio**: `sectores`, los 211 barrios. **Reportes ciudadanos**: `reportes`, `dispositivos` y `subidas_foto`. **Cortes y bitácora**: `cortes`, `eventos_bitacora` y las de la ingesta de Acuacar. Y **cuentas y avisos**: usuarios, tokens, auditoría y suscripciones.
> `usuarios` tiene unos 30 mil documentos porque casi todos son cuentas sintéticas de demostración, declaradas como tales. Los reportes llevan la ubicación redondeada a tres decimales, unos 110 metros, por privacidad.»

🖥 *Mira:* **Compass › pestaña `cortes`**. Ya está filtrada para mostrar los cortes con cierres; el primero tiene el campo `cierres` desplegado.

🎤 *Di:*
> «Miren este corte: el campo `cierres` es una **lista dentro del propio documento**, con el barrio, la hora, la fuente y si es provisional. Eso es lo que decía antes: un solo documento en vez de varias tablas.»

🖥 *Mira (si quieres reforzar):* **Terminal › «1 · Mongo»**, secciones **2** (las 16 colecciones) y **7** (un corte con sus cierres).

---

### Escena 5 · Índices: geográfico y TTL (5:00 – 6:10)

🖥 *Mira:* **Compass › pestaña `sectores`** (abierta en *Indexes*): `slug_1` único y **`geometry_2dsphere` (GEOSPATIAL)**.
🖥 *Mira:* **Terminal › «1 · Mongo»**, sección **4**: el punto (-75.5365, 10.41236) devuelve **MANGA**, con plan **IXSCAN** sobre `geometry_2dsphere`.

🎤 *Di:*
> «Los 211 barrios tienen un índice geográfico. Le doy a Mongo un punto, una longitud y una latitud, y me devuelve el barrio: **MANGA**. Eso usa el índice `2dsphere`; no recorre los 211 polígonos. Y `slug` tiene un índice único.»

🖥 *Mira:* **Compass › pestaña `reportes`** (abierta en *Indexes*): `timestamp_1` con la etiqueta **TTL**.
🖥 *Mira:* **Terminal › «1 · Mongo»**, secciones **6** y **8**: «se borra a los 365 días» y la lista de todas las colecciones con TTL.

🎤 *Di:*
> «Y aquí está el índice **TTL** de los reportes: 31 millones 536 mil segundos, que son **365 días**. Pasado ese tiempo, Mongo borra el reporte solo. También lo tienen los enlaces de correo, los dispositivos, la auditoría y las subidas de foto.»

🖥 *Mira:* **VS Code › `IndicesMongo.java`** (línea 51).
🎤 *Di:* «Los índices no se crean a mano: los asegura el backend al arrancar, en esta clase.»

---

### Escena 6 · El límite que debes decir tú (6:10 – 6:40)

🖥 *Mira:* **Terminal › «1 · Mongo»**, sección **9. LO QUE MONGO NO TIENE**.

🎤 *Di:*
> «Y quiero decir lo que Mongo **no** nos da. No tiene claves foráneas: los ids entre colecciones son texto y los valida la aplicación. Y corre sin autenticación, algo aceptable solo porque el puerto está publicado únicamente en 127.0.0.1, es decir, nadie de la red lo ve.»

🖥 *Mira (opcional):* **Terminal › «4 · Contenedores»**: todos los puertos aparecen como `127.0.0.1`.

---

### Escena 7 · Cómo se conecta todo en el código (6:40 – 8:40)

🖥 *Mira:* **VS Code**, en este orden: `application-docker.yml` (línea 8) → `docker-compose.yml` (línea 144, `SPRING_DATA_MONGODB_URI`; usa Ctrl+G y escribe 144 si quieres ir directo) → `application.yml` (línea 89, bloque `sql`) → `SqlConfig.java` (línea 38, `@ConditionalOnProperty`).

🎤 *Di:*
> «Estas son nuestras tres conexiones. Dentro de Docker, el backend usa los **nombres de los contenedores**: `mongo` para Mongo, `postgres` para PostgreSQL. La cadena completa de Mongo es `mongodb://mongo:27017/aguavigia?replicaSet=rs0`. Desde mi PC uso `localhost`, y PostgreSQL en el **puerto 5433**, porque el 5432 suele estar ocupado en Windows. Y a Mongo me conecto con `directConnection=true`, porque el miembro del replica set se llama `mongo:27017`, un nombre que mi PC no conoce.
> Fíjense en el bloque de PostgreSQL: viene **apagado por defecto**, `habilitado: false`, y solo se enciende en Docker. Si está apagado, ni siquiera se crea la conexión JDBC ni se ejecuta Flyway. Por eso el backend arranca aunque PostgreSQL esté caído.
> Y ninguna clave está escrita aquí: los secretos van en el archivo `.env`, que git ignora.»

🎤 *Cierre de la escena:*
> «Las bases se tocan solo desde la capa de infraestructura, con adaptadores. El dominio no sabe que existe Mongo, y una prueba automática lo vigila.»

---

### Escena 8 · Redis (8:40 – 10:40)

🖥 *Mira:* **Terminal › «3 · Redis»**, de arriba abajo, secciones 1 a 5.
> Debe verse: `db0` (instancia real) y `db1` (simulación) con pocas claves, todas con vencimiento; los canales pub/sub `aguavigia:sse:sectores` y `…:simulacion`.

🎤 *Di:*
> «Redis solo guarda **estado temporal**. Ninguna clave es dato del negocio. Si lo vaciamos, se pierde la caché, los límites y la ventana de consenso, pero **ni un solo dato real**.
> Usamos dos bases de Redis: la 0 para la instancia real y la 1 para la simulación. Y lo organizamos por **prefijos de clave**. `rate-limit:` limita las peticiones por IP y ruta. `cupo:` limita cuántos reportes puede hacer un dispositivo. `consenso:` guarda la ventana con la que decidimos cuándo cambia el color de un barrio. `login:fallos:` y `login:bloqueo:` bloquean tras intentos fallidos. `sesion:revocada:` recuerda las sesiones cerradas antes de vencer. `ingesta:visto:` evita procesar dos veces el mismo documento. Y `tarea-unica:` es un candado para que una tarea programada corra en una sola instancia a la vez.
> Hay una pieza más: el **canal pub/sub**. Cuando un barrio cambia de estado, el backend publica un aviso aquí y todas las conexiones en vivo del mapa se actualizan. Hay un canal por modo, para que la simulación no moleste a la instancia real.»

🎤 *Si preguntan qué pasa si Redis cae:*
> «La caché de sectores falla y el backend lee directamente de Mongo. Las sesiones revocadas se tratan como denegadas, por seguridad. No se pierde ningún dato.»

🖥 *Mira (opcional):* **VS Code › `RedisConfig.java`** y **`SseSectoresBroadcaster.java`** (línea 50, el canal).

---

### Escena 9 · PostgreSQL: por qué y cómo se llena (10:40 – 11:50)

🖥 *Mira:* **Fotos**, el diagrama **SQL** (el de la izquierda).
🖥 *Mira:* **Terminal › «2 · PostgreSQL»**, secciones **1** (tablas y vistas) y **2** (las últimas copias).
🖥 *Mira (alternativa visual):* **TablePlus**, la barra lateral izquierda con las tablas y vistas del esquema `analitica`.
> Debe verse: 8 tablas (una es `flyway_schema_history`, el registro de migraciones), 8 vistas y copias en **`OK`** con **211 y 211** barrios y **7 y 7** cortes.

🎤 *Di:*
> «Si Mongo es la principal, ¿para qué PostgreSQL? Para tener un **modelo relacional de verdad** sobre lo más importante del proyecto: el Índice de Cumplimiento. Claves foráneas, restricciones CHECK y vistas con funciones de ventana.
> Es una **copia derivada**. Un job copia desde Mongo **cada 5 minutos**, en **una sola transacción**: es idempotente, y si algo falla a la mitad, queda la copia anterior. Mongo **nunca** lee de PostgreSQL. Y no lleva datos personales: ni correos, ni dispositivos, ni coordenadas.
> Aquí lo vemos: las últimas copias dicen OK, con 211 barrios en Mongo y 211 en SQL, y 7 cortes en los dos lados.»

🖥 *Mira (opcional):* **VS Code › `CopiaAnaliticaJob.java`** (línea 34).

---

### Escena 10 · El modelo y las vistas (11:50 – 12:40)

🖥 *Mira:* **TablePlus › pestaña `corte_sector`**: cada fila trae una flecha **→** hacia el barrio (la clave foránea).
🖥 *Mira:* **Terminal › «2 · PostgreSQL»**, sección **3** (`\d corte_sector`: clave primaria compuesta, dos claves foráneas y el CHECK).
🖥 *Mira:* **TablePlus › pestaña `v_cumplimiento_global`**: **28800 / 7200 / 100.0**.
🖥 *Mira (opcional):* **VS Code › `V1__esquema_analitico.sql`** (líneas 25 a 31).

🎤 *Di:*
> «Esta tabla, `corte_sector`, tiene **clave primaria compuesta**, dos claves foráneas y un CHECK. Cada fila apunta a su barrio y a su corte; si borro un corte, sus pares se borran en cascada.
> Y esta vista calcula el Índice en SQL: se prometieron 28 mil 800 segundos y se cumplieron en 7 mil 200, un 100 %. La misma fórmula existe en Java para Mongo, y una **prueba de paridad** compara las dos con casos de borde, para asegurarnos de que dan lo mismo.
> El ranking de barrios usa `RANK()`, una función de ventana, algo muy natural en SQL.»

🖥 *Mira (para el ranking):* **Terminal › «2 · PostgreSQL»**, sección **5**.

---

### Escena 11 · El vigilante y la bitácora inmutable (12:40 – 14:00)

🖥 *Mira:* **TablePlus › pestaña `vigilancia`**: **OK, 211 barrios, 0 diferencias, 0 eslabones rotos**, y las filas de cada revisión.
🖥 *Mira:* **Terminal › «2 · PostgreSQL»**, secciones **6** (el vigilante), **7** (la cadena de hashes) y **8** (el intento de modificar).
> Debe verse en la sección 8: **`ERROR: La bitácora inmutable solo admite INSERT (se rechazó UPDATE)`**.

🎤 *Di:*
> «Cada 15 minutos un **vigilante** compara Mongo y PostgreSQL barrio por barrio: 211 revisados, cero diferencias. Si encuentra algo, **avisa; no corrige a ciegas**.
> Y ahora, lo más llamativo: la **bitácora inmutable**. Esta tabla solo admite agregar. Aquí se intentó modificar una fila... y la base lo rechaza: *la bitácora inmutable solo admite INSERT*. Es un disparador, y también bloquea el DELETE y el TRUNCATE.
> Además cada fila guarda el **hash de la anterior**, como una cadena. Aquí se ve: `enlace_ok` y `hash_ok` en verdadero. Aunque alguien lograra saltarse el bloqueo, reescribir una fila rompería la cadena, y esta vista lo delataría.»

🖥 *Mira (opcional):* **VS Code › `V4__vigilancia_bitacora_y_lector.sql`** (líneas 56, 63 y 65: los disparadores). Esta pestaña es la que quedó abierta al final.

> Aclaración si te preguntan por esa prueba: el intento de modificar se ejecutó dentro de una transacción que no se confirma (`begin; … rollback;`), así que no cambió ningún dato.

---

### Escena 12 · Cierre y límites honestos (14:00 – 14:40)

🎤 *Di:*
> «Resumiendo: **tres almacenes, tres papeles**. Mongo guarda la verdad; PostgreSQL la analiza sin ponerla en riesgo; Redis guarda lo temporal. Todo está detrás de adaptadores, así que cambiar una base no toca el dominio.
> Y para ser honestos con lo que no hicimos: Mongo corre con un solo nodo y sin claves foráneas ni autenticación, PostgreSQL usa autenticación `trust`, todo funciona en local y no en producción, y al plan de PostgreSQL le faltan algunas vistas, como la de picos por hora. Son decisiones y límites documentados, no descuidos.»

---

## C. Preguntas probables y cómo responderlas

| Pregunta | Respuesta |
|---|---|
| ¿Por qué dos bases de datos? | Mongo es la fuente de verdad: documentos y geografía. PostgreSQL añade SQL analítico y relaciones sin arriesgar lo principal. |
| ¿Y si se desincronizan? | El vigilante lo detecta cada 15 minutos y avisa. La copia se reconstruye sola en la siguiente pasada. |
| ¿Por qué copia cada 5 minutos y no en tiempo real? | La analítica no necesita ser instantánea y así Mongo no depende de PostgreSQL. Es configurable (`copia-intervalo-ms`). |
| ¿Cómo sabes que la fórmula coincide en Java y SQL? | Una prueba de paridad (`ParidadMongoPostgresIT`) compara ambas con casos de borde. Además, hoy las dos rutas dan 28 800 s y 7 200 s. |
| ¿Por qué un replica set de un nodo? | Para tener transacciones entre documentos. No da alta disponibilidad. |
| ¿Qué es un TTL? | Un índice que borra el documento solo, pasado un tiempo. Lo usamos en reportes, enlaces, dispositivos, auditoría y subidas de foto. |
| ¿Qué pasa si cae Redis? | Se pierde caché y límites; el backend lee de Mongo y las sesiones revocadas se deniegan. Ningún dato se pierde. |
| ¿Qué pasa si cae PostgreSQL? | El sistema sigue; solo `/api/analitica/**` responde 503. |
| ¿Por qué no hay claves foráneas en Mongo? | Mongo no las ofrece; la aplicación valida los ids. En PostgreSQL sí las hay y la base las exige. |
| ¿Es seguro? | Todo escucha solo en 127.0.0.1; hay JWT, segundo factor TOTP y límites de peticiones; los secretos no están en el código. Mongo y Redis no tienen autenticación y PostgreSQL usa `trust`: riesgo aceptado porque corre en local. |
| ¿Hay respaldos? | Hay scripts de respaldo y restauración de Mongo y PostgreSQL (`scripts/backup-*.sh`, `restore-*.sh`). Son manuales, no automáticos. |
| ¿Cómo se prueba? | 1 619 pruebas unitarias y 389 de integración con Testcontainers (Mongo y PostgreSQL reales); cobertura del 95 % de instrucciones. |

## D. Qué NO afirmar

- **No digas** «alta disponibilidad»: es un solo nodo.
- **No digas** «en producción»: corre en local.
- **No digas** «respaldos automáticos»: los scripts son manuales.
- **No digas** que los 30 000 usuarios son reales: son cuentas sintéticas declaradas.
- **No digas** que la relación `dispositivos → reportes` está comprobada con datos: sale de la documentación («según el diseño»).
- **No digas** que el plan de PostgreSQL está completo: faltan `v_pico_horario`, `v_reportes_por_corte`, la ruta `por-corte` y la vista materializada.
