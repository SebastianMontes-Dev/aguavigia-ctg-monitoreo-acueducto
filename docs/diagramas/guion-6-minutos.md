# Exposición de 6 minutos: qué abrir, en qué orden y qué decir

**Duración máxima: 6:00.** El texto hablado tiene unas **750 palabras**: a 130 palabras por minuto son unos 5 minutos y 45 segundos, así que el margen para cambiar de ventana es corto. **Si vas justo, salta primero lo marcado como *(opcional)* y después el recuadro de la carpeta `persistence/mongo` del paso 4 (unos 15 segundos).**
**Todo ya está abierto y preparado, con los resultados ya ejecutados. No hay que teclear nada:** solo cambias de ventana o de pestaña con el ratón, señalas lo que se indica y lees el recuadro 🎤. Las palabras en **negrita** son términos técnicos que conviene pronunciar con seguridad (al final tienes un vocabulario con su significado).

---

## Antes de pulsar «grabar» (2 minutos)

**Lo que ya está abierto, y cómo llegar a cada ventana** (clic en su icono de la barra de tareas, o en la pestaña de la app de Claude para los terminales):

| Ventana | Cómo está dejada | Se usa en los pasos |
|---|---|---|
| **Fotos** (2 ventanas, **ya en primer plano**) | A la izquierda el diagrama **SQL**, a la derecha el **NoSQL** | 1, 2, 6 |
| **Terminal** (panel de la app de Claude, 4 pestañas) | **1 · Mongo** · **2 · PostgreSQL** · **3 · Redis** · **4 · Contenedores**. Ya tienen todo ejecutado; solo hay que subir o bajar con la rueda del ratón hasta el título numerado (`══ 1. … ══`) | 2, 3, 5, 6, 7 |
| **MongoDB Compass** (4 pestañas) | `aguavigia` · `cortes` · `sectores` · `reportes` | 3 |
| **Visual Studio Code** | 4 pestañas: `application-docker.yml` (línea 8, ya a la vista) · `docker-compose.yml` (línea 144) · `application.yml` (línea 89) · `CorteAguaDocumento.java` (línea 14). El Explorador de la izquierda ya muestra abierta la carpeta `persistence/mongo` | 4 |
| **TablePlus** (PostgreSQL) | Conectado al esquema `analitica`, con dos pestañas: `corte_sector` y `v_cumplimiento_global` | 6 |

**Qué hacer antes de grabar:** (1) comprueba que lo primero que ves en pantalla son los dos diagramas de Fotos; (2) ensaya una vez el recorrido de ventanas, sin hablar; (3) pon el micrófono y cierra notificaciones.

**Las cinco ideas que deben quedar claras:**
1. **Persistencia políglota:** Mongo es la **fuente de verdad**, PostgreSQL un **modelo de lectura derivado** y Redis **estado efímero**.
2. El replica set de un nodo existe por las **transacciones ACID multidocumento**, no por alta disponibilidad.
3. Mongo aporta **documentos embebidos**, **índice geoespacial (2dsphere)** y **retención automática (TTL)**.
4. PostgreSQL aporta **integridad referencial**, vistas analíticas y una **bitácora inmutable**; se sincroniza cada 5 minutos con **consistencia eventual**.
5. **Degradación controlada:** si caen Redis o PostgreSQL, el sistema sigue; si cae Mongo, no hay sistema.

| Tiempo | Paso | Ventana |
|---|---|---|
| 0:00 – 0:30 | 1. La arquitectura de datos | Fotos |
| 0:30 – 1:30 | 2. Mongo: por qué y el nodo | Fotos (NoSQL) → Terminal 1 |
| 1:30 – 2:35 | 3. Colecciones, geoespacial y TTL | Compass |
| 2:35 – 3:30 | 4. Conexiones, configuración y carpeta de colecciones | VS Code |
| 3:30 – 4:15 | 5. Redis | Terminal 3 |
| 4:15 – 5:15 | 6. PostgreSQL | Fotos (SQL) → Terminal 2 → TablePlus |
| 5:15 – 5:45 | 7. Bitácora inmutable | Terminal 2 |
| 5:45 – 6:00 | 8. Cierre | (la que estés mostrando) |

---

## Paso a paso

### PASO 1 · Lo primero que muestras: la arquitectura de datos (0:00 – 0:30)
- **Ventana:** **Fotos**. Ya están los dos diagramas lado a lado; no hay que hacer clic en nada.
- **Haz:** pasa el cursor despacio por ambos diagramas mientras hablas.

🎤
> «AguaVigía aplica **persistencia políglota**: cada almacén resuelve el problema para el que es más adecuado. **MongoDB es la fuente de verdad**: todo dato del negocio se escribe primero ahí. **PostgreSQL es un modelo de lectura derivado**, para analítica relacional con SQL. Y **Redis guarda únicamente estado efímero**. El principio que lo gobierna es la **degradación controlada**: si caen Redis o PostgreSQL, el sistema sigue operando; si cae Mongo, no hay sistema.»

### PASO 2 · MongoDB: criterio de elección y nodo de réplica (0:30 – 1:30)
- **Ventana:** **Fotos**, el diagrama **NoSQL** (derecha).
- **Haz:** con el cursor, señala `CORTES` (centro) y luego `SECTORES` (arriba).

🎤
> «Elegimos Mongo por tres razones. Primera, el **modelo de datos**: un corte es un agregado que lleva **embebidos** sus barrios afectados y sus cierres; en un esquema relacional serían tres tablas y uniones, aquí es una sola lectura. Segunda, **capacidad geoespacial nativa**: los 211 barrios son polígonos GeoJSON con un índice `2dsphere`. Tercera, **retención automática** de datos mediante índices TTL.»

- **Cambia a:** **Terminal › pestaña «1 · Mongo»**. Sube con la rueda hasta **`══ 1. EL NODO DE RÉPLICA ══`** (se ve `mongo:27017` y `PRIMARY`).

🎤
> «Este es el **replica set** `rs0`, con un único miembro. Aclaro: **no ofrece alta disponibilidad**. Existe porque MongoDB solo admite **transacciones multidocumento**, con garantías ACID, sobre un replica set. Las usamos para registrar un corte y su bitácora de forma **atómica**: o se confirma todo, o no se escribe nada.»

### PASO 3 · Colecciones, geoespacial y TTL (1:30 – 2:35)
- **Cambia a:** **MongoDB Compass**, pestaña **`aguavigia`** (la tabla de las 16 colecciones).

🎤
> «Son **16 colecciones** en cuatro dominios: territorio, reportes ciudadanos, cortes con su bitácora, y cuentas y avisos. Los 30 mil usuarios son cuentas sintéticas, declaradas como tales.»

- **Clic en la pestaña `cortes`.** Ya está filtrada y con el campo `cierres` desplegado (se ven `sectorId`, `hora`, `fuente`, `provisional`).

🎤
> «Aquí, `cierres` es un **arreglo embebido**: la relación de uno a muchos vive dentro del documento, sin necesidad de joins.»

- **Clic en la pestaña `sectores`.** Está en *Indexes*: señala **`geometry_2dsphere`** (etiqueta GEOSPATIAL). *(Opcional, 10 s: en Terminal «1 · Mongo», sección 4, está la coordenada que devuelve **MANGA**.)*

🎤
> «Dada una coordenada, Mongo resuelve el barrio, **MANGA**, apoyándose en el **índice geoespacial** en lugar de recorrer los 211 polígonos.»

- **Clic en la pestaña `reportes`.** Está en *Indexes*: señala **`timestamp_1`** con la etiqueta **TTL**.

🎤
> «Y este **índice TTL** elimina cada reporte a los **365 días**: la **política de retención** la ejecuta la propia base, sin código de limpieza. El mismo mecanismo se aplica a enlaces de correo, dispositivos y auditoría. Los índices los asegura el backend al arrancar.»

*(Opcional: Terminal «1 · Mongo», sección 9. Mongo no impone **integridad referencial**: los identificadores entre colecciones los valida la aplicación; y corre sin autenticación, algo aceptable solo porque el puerto escucha únicamente en 127.0.0.1.)*

### PASO 4 · Conexiones, configuración y carpeta de colecciones (2:35 – 3:30)
- **Cambia a:** **Visual Studio Code**. Está en la pestaña **`application-docker.yml`**, ya en la línea 8 (`uri: ${MONGODB_URI:mongodb://mongo:27017/aguavigia}`).
- **Haz:** clic en la pestaña **`docker-compose.yml`** (ya en la línea 144, la cadena `…?replicaSet=rs0`) y después en **`application.yml`** (ya en la línea 89, el bloque `sql:` con `habilitado:false`).

🎤
> «Las bases se acceden solo desde la capa de infraestructura, mediante **puertos y adaptadores**: el dominio no conoce a Mongo, y una prueba **ArchUnit** lo hace cumplir. Dentro de Docker el backend **resuelve los servicios por nombre**: `mongodb://mongo:27017/aguavigia?replicaSet=rs0`. Desde mi PC uso `localhost`, y PostgreSQL por el puerto 5433.
> La conexión SQL está tras un **interruptor de configuración**, deshabilitado por defecto: así el backend arranca aunque PostgreSQL no esté. Y los **secretos** no están en el código: se inyectan desde un `.env` que git ignora.»

- **Haz:** clic en la pestaña **`CorteAguaDocumento.java`**. En el Explorador de la izquierda se ve la carpeta **`persistence › mongo`** (ruta completa: `backend/src/main/java/com/aguavigia/ctg/infrastructure/persistence/mongo/`). Señala la línea 14 (`@Document(collection = "cortes")`) y la 38 (`List<Cierre> cierres`, el arreglo embebido que viste en Compass).
- **Dato para no equivocarte:** la carpeta tiene 51 archivos. Las **16 colecciones** son los archivos que terminan en **`…Documento.java`**; el resto son repositorios y adaptadores. Los índices están en `IndicesMongo.java`, en esta misma carpeta.

🎤
> «Y aquí está el modelo de Mongo en el código: en la carpeta `persistence/mongo`, **un archivo `Documento` por cada una de las 16 colecciones**. Por ejemplo, `cortes` declara `cierres` como una lista embebida, y los índices los define `IndicesMongo`.»

### PASO 5 · Redis (3:30 – 4:15)
- **Cambia a:** **Terminal › pestaña «3 · Redis»**. Sube con la rueda hasta **`══ 1. BASES EN USO ══`** y ve bajando despacio hasta la sección 4 (se ven `db0`, `db1`, las claves con su TTL y los canales pub/sub).

🎤
> «Redis almacena solo **estado efímero**: todas las claves vencen y, si se vacía, no se pierde ningún dato del negocio. Usamos dos bases lógicas, la 0 para la instancia real y la 1 para la simulación, con un **espacio de nombres por prefijos**. `rate-limit:` aplica **limitación de tasa**; `login:fallos:` el **bloqueo por intentos fallidos**; `sesion:revocada:` es la **lista de revocación** de sesiones; `ingesta:visto:` da **idempotencia** a la ingesta; y `tarea-unica:` es un **candado** para que una tarea programada corra una sola vez. Además, un canal **pub/sub** difunde cada cambio de un barrio al mapa en vivo.»

### PASO 6 · PostgreSQL: copia, integridad y analítica (4:15 – 5:15)
- **Cambia a:** **Fotos**, el diagrama **SQL** (izquierda).
- **Cambia a:** **Terminal › «2 · PostgreSQL»**, sube hasta **`══ 2. LA COPIA DESDE MONGO ══`**: copias `OK`, 211/211 barrios y 7/7 cortes.
- **Cambia a:** **TablePlus**, pestaña **`corte_sector`**.

🎤
> «Si Mongo es la principal, ¿para qué PostgreSQL? Para obtener **integridad relacional** y **capacidad analítica** sobre lo más valioso: el Índice de Cumplimiento. Es una **copia derivada con consistencia eventual**: un job la sincroniza cada 5 minutos, en **una sola transacción**, y si falla queda la copia anterior. El flujo es **unidireccional**: Mongo nunca lee de PostgreSQL, y la copia no tiene datos personales. Aquí: OK, con 211 barrios y 7 cortes en ambos lados.
> La tabla `corte_sector` tiene **clave primaria compuesta, dos claves foráneas y una restricción CHECK**: es la propia base la que garantiza la integridad referencial.»

- **Clic en la pestaña `v_cumplimiento_global`** de TablePlus: **28800 / 7200 / 100.0**.

🎤
> «Y esta **vista** calcula el índice en SQL: 28 800 segundos prometidos, 7 200 reales, cumplimiento del 100 %. La misma fórmula existe en Java, y una **prueba de paridad** verifica que ambas implementaciones coincidan.»

### PASO 7 · Conciliación y bitácora inmutable (5:15 – 5:45)
- **Cambia a:** **Terminal › «2 · PostgreSQL»** y baja hasta las secciones **6, 7 y 8**. Al final se ve **`ERROR: La bitácora inmutable solo admite INSERT (se rechazó UPDATE)`**.

🎤
> «Cada 15 minutos un **vigilante concilia** ambas bases barrio por barrio: 211 revisados, cero diferencias; ante una discrepancia **alerta, no corrige a ciegas**. Y la **bitácora inmutable** es de solo inserción: un **disparador** rechaza UPDATE, DELETE y TRUNCATE, como se ve aquí. Además, cada fila guarda el **hash de la anterior**, formando una **cadena de hashes**: cualquier alteración queda en evidencia.»

### PASO 8 · Cierre (5:45 – 6:00)
- **Ventana:** la que tengas en pantalla; no hace falta cambiar.

🎤
> «En síntesis: **persistencia políglota con responsabilidades separadas**. Mongo es la fuente de verdad, PostgreSQL aporta integridad y analítica sin comprometerla, y Redis resuelve lo efímero. Reconocemos los límites: un solo nodo, sin autenticación y en entorno local, y lo dejamos documentado. Gracias.»

---

## Vocabulario: qué significa cada término (por si te preguntan)

| Término | Significado en una frase | Dónde se ve en el proyecto |
|---|---|---|
| **Persistencia políglota** | Usar varias bases distintas, cada una para lo que mejor hace. | Mongo + PostgreSQL + Redis |
| **Fuente de verdad** | La base que manda; si hay diferencia, vale lo que dice ella. | MongoDB |
| **Modelo de lectura derivado** | Copia de solo lectura, calculada a partir de la principal, pensada para consultar. | Esquema `analitica` en PostgreSQL |
| **Consistencia eventual** | La copia puede ir unos minutos por detrás, pero termina igualando. | Job cada 5 minutos |
| **Idempotente** | Repetir la operación da el mismo resultado. | La ingesta (`ingesta:visto:`) |
| **ACID / atómico** | Una operación se confirma completa o no se escribe nada. | Transacciones de Mongo (corte + bitácora) |
| **Replica set** | Grupo de nodos de Mongo; aquí uno solo, necesario para las transacciones. | `rs0` |
| **Documento embebido** | Datos relacionados guardados dentro del mismo documento. | `cierres` dentro de `cortes` |
| **Índice 2dsphere** | Índice geográfico para buscar por coordenadas y polígonos. | `sectores.geometry` |
| **Índice TTL** | Índice que borra el documento solo, pasado un tiempo. | `reportes.timestamp` (365 días) |
| **Integridad referencial** | La base impide referencias a filas que no existen. | Claves foráneas de `corte_sector` |
| **Clave primaria compuesta** | Clave formada por dos o más columnas. | `corte_sector` |
| **Vista / función de ventana** | Consulta guardada con nombre / cálculo sobre un grupo ordenado (`RANK`). | `v_cumplimiento_global`, `v_ranking_barrios` |
| **Disparador (trigger)** | Código de la base que se ejecuta ante un cambio y puede rechazarlo. | Bloqueo de UPDATE/DELETE en la bitácora |
| **Cadena de hashes** | Cada registro incluye el resumen del anterior; alterar uno rompe la cadena. | `v_bitacora_cadena` |
| **Limitación de tasa** | Tope de peticiones por tiempo para evitar abusos. | `rate-limit:` |
| **Candado** | Marca que evita que dos procesos hagan lo mismo a la vez. | `tarea-unica:` |
| **Pub/sub** | Un componente publica un aviso y los suscritos lo reciben al instante. | Canal `aguavigia:sse:sectores` |
| **Puertos y adaptadores** | El dominio habla con interfaces; las bases se conectan por fuera. | Arquitectura limpia + ArchUnit |
| **Degradación controlada** | Si falla una pieza secundaria, el sistema sigue con menos funciones. | Cae Redis o PostgreSQL |

## Si te preguntan (respuestas cortas)

| Pregunta | Respuesta |
|---|---|
| ¿Por qué dos bases? | Mongo ofrece documentos y geografía; PostgreSQL ofrece integridad relacional y SQL analítico sin poner en riesgo lo principal. |
| ¿Y si se desincronizan? | Es consistencia eventual: el vigilante lo detecta cada 15 minutos y avisa, y la siguiente copia lo corrige. |
| ¿Si cae Redis? | Se pierden caché y límites; el backend lee de Mongo y las sesiones revocadas se deniegan por seguridad. Ningún dato se pierde. |
| ¿Si cae PostgreSQL? | El sistema sigue; solo `/api/analitica/**` responde 503. |
| ¿Por qué un solo nodo? | Para tener transacciones multidocumento; no da alta disponibilidad. |

## Qué NO afirmar
**No digas** «alta disponibilidad», «en producción» ni «respaldos automáticos» (los scripts son manuales); tampoco que los 30 000 usuarios son reales (son sintéticos) ni que el plan de PostgreSQL está completo (faltan algunas vistas, como la de picos por hora).

## Qué no tocar al grabar
En Compass no pulses «Create index», «Add data» ni la papelera; en TablePlus no hagas doble clic en una celda ni pulses «Yes» en el aviso de licencia; en el terminal no cierres pestañas (se pierde lo que está en pantalla); nunca `docker compose down -v`. Si algo se cierra, pídeselo a Claude: «reabre Compass».
