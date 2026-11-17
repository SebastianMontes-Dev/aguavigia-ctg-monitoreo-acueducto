# AguaVigía CTG

**Plataforma ciudadana de monitoreo del acueducto de Cartagena de Indias.** Cruza los avisos oficiales de corte de agua con los reportes georreferenciados de los vecinos y publica un **Índice de Cumplimiento**: qué tanto coincide la duración prometida de cada corte con la real.

![Java 21](https://img.shields.io/badge/Java-21-007396?logo=openjdk&logoColor=white)
![Spring Boot 3.5](https://img.shields.io/badge/Spring_Boot-3.5-6DB33F?logo=springboot&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![MongoDB 7](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![PostgreSQL 17](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Redis 7](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Versión](https://img.shields.io/badge/versi%C3%B3n-1.0.2-0F766E)

> Proyecto académico e independiente: no está afiliado a Aguas de Cartagena S.A. E.S.P. ni a ninguna entidad distrital. Corre en local.

## Integrantes

| Integrante | Rol en el proyecto |
|---|---|
| **Sebastian Andres Montes Olivera** | Backend: arquitectura, API, bases de datos, ingesta y simulación |
| **Yordi Pardo Pajaro** | Frontend: interfaz web (React), diseño y accesibilidad |
| **Carlos Mario Bechara Arias** | Integrante del equipo |
| **Jose Daniel Zambrano Luna** | Integrante del equipo |
| **Rafael Eduardo Sarmiento Peña** | Integrante del equipo |

## El problema

Cuando se corta el agua en un barrio, la información suele ser incompleta: el aviso oficial dice una duración y nadie mide si se cumplió. AguaVigía no intenta resolver un problema hidráulico; resuelve ese **vacío de información**. Recoge los avisos oficiales, deja que los ciudadanos reporten lo que ocurre en su sector y compara ambas fuentes para que cualquiera pueda ver qué tan cumplidos son los cortes.

## Qué hace

- **Avisos oficiales.** Un colector automático extrae los cortes anunciados por Acuacar. Nada llega al mapa público sin la frase exacta del boletín que respalde la extracción.
- **Reportes ciudadanos georreferenciados.** Los vecinos reportan cortes (con foto) y se valida el consenso entre reportes antes de darlos por ciertos.
- **Índice de Cumplimiento.** Duración prometida frente a la real de cada corte, consultable por barrio (211 barrios).
- **Cuentas y roles.** Sesión con JWT, roles de usuario y segundo factor (TOTP) para el panel de administración.
- **Moderación y bitácora.** Un veedor modera los reportes; las acciones quedan en una bitácora que solo admite agregar y encadena el hash de cada fila.
- **Límites de uso.** Control de peticiones para evitar el spam en los reportes.
- **Copia analítica en PostgreSQL.** El Índice de Cumplimiento y los reportes (contados por barrio y día, sin datos personales) se replican para análisis con ranking y tendencia (`/api/analitica/**`). Un vigilante compara ambas bases; si la copia no está disponible, el sistema sigue funcionando.
- **Tablero en Power BI.** Visualización del Índice de Cumplimiento con mapa de barrios coloreado (ver [`powerbi/`](powerbi/GUIA-TABLERO.md)).
- **Simulación con volumen.** Una segunda instancia aislada genera al azar decenas de miles de reportes, cortes y registros de bitácora, todo marcado como sintético, para demostrar el sistema sin tocar el mapa real.

## Arquitectura

El backend sigue **Arquitectura Limpia** (puertos y adaptadores), con las dependencias siempre hacia adentro:

```
domain/  ←  application/  ←  infrastructure/  (Mongo, Redis, correo, JWT, HTTP saliente)
                          ←  api/             (REST, DTO, mappers)
```

- `domain/` es Java puro: no importa nada de `org.springframework` ni de `com.mongodb`. Una prueba de **ArchUnit** lo verifica y, si se rompe la regla, la compilación falla.
- Los controladores no tienen lógica de negocio y nunca exponen entidades de dominio: se usan DTO y MapStruct.
- Cada caso de uso es una clase con una sola acción. Los errores de la API siguen el formato **RFC 7807** desde un único manejador global.

**Datos.** MongoDB (réplica de un nodo, con índices geoespaciales `2dsphere`) es la base principal y la **única fuente de verdad**. Redis se usa para caché, límite de peticiones y la ventana de consenso. PostgreSQL 17 guarda una copia analítica derivada que un job llena desde Mongo cada 5 minutos; Mongo nunca lee de ella.

**Contrato.** La API está descrita en [`backend/openapi.yaml`](backend/openapi.yaml) (91 operaciones). El frontend, hecho en React 19 y Vite, se construye contra ese contrato.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Backend | Java 21, Spring Boot 3.5, Maven, MapStruct |
| Datos | MongoDB 7, PostgreSQL 17 (Flyway), Redis 7 |
| Frontend | React 19, Vite, TypeScript, Vitest, Playwright |
| Calidad | JUnit 5, ArchUnit, pruebas de integración con Testcontainers |
| Infraestructura | Docker Compose, Mailhog (SMTP de pruebas) |
| CI | GitHub Actions: backend, frontend, contenedores y dependencias, simulación, escaneo de secretos (gitleaks) |
| Analítica | Power BI |

## Cómo levantarlo

Solo hace falta **Docker Desktop**. No se necesita Java, Node ni un `.env`.

```bash
docker compose up -d --build
```

Levanta MongoDB, Redis, PostgreSQL, Mailhog y el backend; un servicio de siembra carga los 211 barrios y el backend crea 300 cuentas sintéticas de vecino (lo único inventado en la instancia real). La API queda en `http://localhost:8081`.

Para comprobar que está lista:

```bash
curl http://localhost:8081/actuator/health/readiness
```

Para correr la interfaz web en modo desarrollo (requiere Node):

```bash
cd frontend
npm install
npm run dev
```

Para compilar y correr las pruebas del backend:

```bash
cd backend
./mvnw verify
```

Las pruebas unitarias y las de arquitectura corren sin Docker (`./mvnw test`); las de integración exigen Docker.

La **simulación** ensaya el sistema con un día de cortes acelerado y datos aleatorios en volumen, en una segunda instancia aislada de la real. Está explicada en [`scripts/simulacion/README.md`](scripts/simulacion/README.md). El recorrido paso a paso de la demostración está en [`docs/frontend/guion-demo.md`](docs/frontend/guion-demo.md).

## Ética de datos

1. El colector respeta `robots.txt` siempre y no disfraza su `User-Agent`.
2. Se identifica con el nombre del proyecto y un correo de contacto.
3. No se extraen datos de Facebook, Instagram ni X.
4. Nada llega al mapa público sin verificación: sin la frase exacta del boletín que respalde la extracción, no se publica.

Más detalle en [`docs/06-etica-de-datos.md`](docs/06-etica-de-datos.md).

## Documentación

Todo está en [`docs/`](docs/README.md), con una guía por tema:

- [Levantar y recorrer el backend paso a paso](docs/01-levantar-a-mano.md)
- [Arquitectura](docs/02-arquitectura.md)
- [Base de datos](docs/03-base-de-datos.md)
- [Seguridad y claves](docs/05-seguridad-y-claves.md)
- [Ética de datos](docs/06-etica-de-datos.md)
- [Decisiones clave (ADR)](docs/07-decisiones-clave.md)
- [Copia analítica en PostgreSQL](docs/09-postgresql-fase-1.md)
- [Plan del frontend por fases](docs/frontend/README.md)
- [Guías de la API para el frontend](docs/api/README.md)
- [Tablero de Power BI](powerbi/GUIA-TABLERO.md)

## Estado del proyecto

**Versión 1.0.2.** El backend y el frontend (fases FE0 a FE7) están construidos y documentados, y la copia analítica en PostgreSQL tiene sus tres fases. La 1.0.1 corrigió los formularios de los enlaces del correo y endureció la política de clave; la 1.0.2 solo actualiza la documentación de entrada (README). Los sensores IoT están construidos pero inactivos a propósito. El historial de cambios está en [`CHANGELOG.md`](CHANGELOG.md).

El trabajo sigue **Gitflow**: `main` y `develop` están protegidas y todo cambio entra por Pull Request con revisión y CI en verde.

## Licencia

Proyecto académico. Sin licencia de uso externo definida.
