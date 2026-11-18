# Exposición para leer (6 minutos)

**Cómo usar este guion:** lees en voz alta **solo los recuadros con el texto**. Las líneas que empiezan por **👉 ABRE** son instrucciones para ti: **no se leen**. Lee despacio y haz una pausa corta al final de cada recuadro mientras cambias de ventana. Todo está ya abierto y con los resultados ejecutados; no tienes que escribir nada.

**Antes de empezar:** en pantalla deben verse los dos diagramas de Fotos (SQL a la izquierda, NoSQL a la derecha). Ventanas listas: Fotos · Terminal (4 pestañas) · MongoDB Compass (4 pestañas) · VS Code (4 pestañas) · TablePlus (2 pestañas).

Son unas 740 palabras: a ritmo tranquilo, unos 5 minutos y 40 segundos. Si vas justo de tiempo, salta el recuadro marcado en el apartado 5.

---

## 1 · Saludo y presentación (0:00)

👉 **ABRE: Fotos** (ya está a la vista). Pasa el cursor por los dos diagramas mientras hablas.

> Buenas, profesor. Soy Sebastián Montes y vengo a exponerle cómo guardamos y conectamos los datos de AguaVigía, la plataforma ciudadana que vigila los cortes de agua en Cartagena. Voy a hablar de MongoDB, de PostgreSQL, de Redis y de las conexiones en el código, y todo lo voy a mostrar funcionando aquí, en mi computador.
>
> Usamos tres almacenes, cada uno con su papel. MongoDB es la fuente de verdad: todo dato se escribe primero ahí. PostgreSQL es una copia derivada, pensada para analizar con SQL. Y Redis guarda solo estado temporal. Si se caen Redis o PostgreSQL, el sistema sigue funcionando; si cae Mongo, no hay sistema.

## 2 · Por qué MongoDB (0:40)

👉 **ABRE: Fotos**, el diagrama de la **derecha** (NoSQL). Señala `CORTES` y luego `SECTORES`.

> Elegimos Mongo por tres razones. Primera: nuestros datos son documentos con listas dentro. Un corte lleva embebidos sus barrios afectados y sus cierres; en un esquema relacional serían varias tablas y uniones. Segunda: la geografía. Los 211 barrios de Cartagena son polígonos con un índice geoespacial. Y tercera: hay datos que caducan solos, mediante índices de tiempo de vida.

## 3 · El nodo de réplica (1:10)

👉 **ABRE: Terminal › pestaña «1 · Mongo»**. Sube con la rueda hasta el título **«1. EL NODO DE RÉPLICA»** (se ve `mongo:27017` y `PRIMARY`).

> Esto que ven es el replica set, con un solo nodo. Quiero ser claro: no es alta disponibilidad. Existe porque Mongo solo permite transacciones entre varios documentos si funciona como replica set, y las necesitamos para guardar un corte y su bitácora de forma atómica: o se guarda todo, o no se guarda nada.

## 4 · Las colecciones (1:40)

👉 **ABRE: MongoDB Compass › pestaña `aguavigia`** (la lista de las 16 colecciones).

> Estas son las dieciséis colecciones, en cuatro grupos: territorio, reportes ciudadanos, cortes con su bitácora, y cuentas y avisos. Los treinta mil usuarios son cuentas sintéticas, declaradas como tales.

👉 **ABRE: Compass › pestaña `cortes`** (el campo `cierres` ya está desplegado).

> Aquí, en cortes, el campo cierres es una lista dentro del propio documento, sin necesidad de uniones.

👉 **ABRE: Compass › pestaña `sectores`** (índices; señala `geometry_2dsphere`, etiqueta GEOSPATIAL).

> Dada una coordenada, Mongo encuentra el barrio gracias a este índice geoespacial, sin recorrer los doscientos once polígonos.

👉 **ABRE: Compass › pestaña `reportes`** (índices; señala `timestamp_1`, etiqueta TTL).

> Y este índice de tiempo de vida borra cada reporte a los trescientos sesenta y cinco días, sin que escribamos código de limpieza. Los índices los crea el backend al arrancar.

## 5 · Las conexiones y el código (2:40)

👉 **ABRE: Visual Studio Code**. Empiezas en la pestaña `application-docker.yml` (línea 8). Luego clic en `docker-compose.yml` (línea 144) y después en `application.yml` (línea 89).

> En el código, el backend se conecta a cada base por su nombre. Dentro de Docker usa mongo, en el puerto 27017, con el replica set; desde mi computador uso localhost, y PostgreSQL por el puerto 5433. La conexión a PostgreSQL viene apagada por defecto, así que el backend arranca aunque esa base no esté. Y los secretos no están en el código: vienen de un archivo .env que git ignora.

👉 **ABRE: VS Code › pestaña `CorteAguaDocumento.java`**. En el Explorador se ve la carpeta `persistence › mongo`. Señala la línea 14 y la línea 38. *(Si vas justo de tiempo, salta este recuadro.)*

> Y aquí, en la carpeta persistence mongo, está el modelo en el código: un archivo por cada una de las dieciséis colecciones. Por ejemplo, cortes declara cierres como una lista embebida. Las bases se tocan solo desde esta capa, y una prueba automática garantiza que el dominio no las conoce.

## 6 · Redis (3:35)

👉 **ABRE: Terminal › pestaña «3 · Redis»**. Sube hasta **«1. BASES EN USO»** y baja despacio hasta la sección 4.

> Redis guarda solo estado temporal. Todas las claves vencen, y si se vacía no se pierde ningún dato real. Usamos dos bases: la cero para la instancia real y la uno para la simulación. Y lo ordenamos por prefijos: uno limita las peticiones, otro bloquea tras intentos fallidos, otro recuerda las sesiones cerradas, y otro funciona como candado para que una tarea programada corra una sola vez. Además hay un canal de publicación y suscripción que avisa al mapa en vivo cuando cambia un barrio.

## 7 · PostgreSQL (4:20)

👉 **ABRE: Fotos**, el diagrama de la **izquierda** (SQL). Luego **Terminal › «2 · PostgreSQL»**, título **«2. LA COPIA DESDE MONGO»**. Luego **TablePlus › pestaña `corte_sector`**.

> Si Mongo es la principal, ¿para qué PostgreSQL? Para tener integridad relacional y análisis con SQL sobre lo más valioso del proyecto: el Índice de Cumplimiento. Es una copia derivada: un proceso la sincroniza cada cinco minutos, en una sola transacción, y Mongo nunca lee de ella. Aquí se ven las últimas copias en OK, con doscientos once barrios y siete cortes en los dos lados. Y esta tabla, corte sector, tiene clave primaria compuesta, dos claves foráneas y una restricción de validación.

👉 **ABRE: TablePlus › pestaña `v_cumplimiento_global`** (se ve 28800 · 7200 · 100.0).

> Esta vista calcula el índice directamente en SQL: se prometieron veintiocho mil ochocientos segundos y se cumplieron en siete mil doscientos, un cien por ciento. La misma fórmula existe en Java, y una prueba verifica que ambas den igual.

## 8 · El vigilante y la bitácora inmutable (5:10)

👉 **ABRE: Terminal › «2 · PostgreSQL»**. Baja hasta las secciones **6, 7 y 8** (al final se ve el error «La bitácora inmutable solo admite INSERT»).

> Cada quince minutos un vigilante compara Mongo con PostgreSQL, barrio por barrio: doscientos once revisados, cero diferencias. Y la bitácora inmutable solo admite agregar registros: aquí se intentó modificar una fila y la base lo rechaza con un disparador. Además, cada fila guarda el hash de la anterior, así que cualquier alteración queda en evidencia.

## 9 · Cierre (5:40)

👉 **No cambies de ventana.**

> En resumen: Mongo guarda la verdad, PostgreSQL la analiza sin ponerla en riesgo, y Redis guarda lo temporal. Reconozco los límites: un solo nodo, sin autenticación y en entorno local, y están documentados. Muchas gracias, profesor. Quedo atento a sus preguntas.

---

## Si te preguntan

- **¿Y si se desincronizan?** El vigilante lo detecta cada 15 minutos y avisa; la siguiente copia lo corrige.
- **¿Si cae Redis?** Se pierden caché y límites; el backend lee de Mongo. Ningún dato se pierde.
- **¿Si cae PostgreSQL?** El sistema sigue; solo las rutas `/api/analitica/**` responden 503.
- **¿Por qué un solo nodo?** Para tener transacciones entre documentos; no da alta disponibilidad.

**No digas:** «alta disponibilidad», «en producción», «respaldos automáticos» (los scripts son manuales), ni que los 30 000 usuarios son reales (son sintéticos).
**No toques al grabar:** en Compass «Create index», «Add data» ni la papelera; en TablePlus no hagas doble clic en una celda ni pulses «Yes» en el aviso de licencia; no cierres pestañas del terminal; nunca `docker compose down -v`.
