# Prompt para continuar el frontend en una sesión en la nube

Para Yordy. Escrito el 2026-10-25, con el backend cerrado (ver la actualización de esa fecha en [`README.md`](README.md#punto-de-partida-main-2026-10-06)).

## Cómo se usa

1. Abre una sesión de Claude Code en la nube sobre `SebastianMontes-Dev/Agua-Vigia-CTG-privado`, rama `main`.
2. Pega el prompt de abajo tal cual. Es el mismo para todas las fases: la sesión lee la tabla «Fases» del plan y toma
   la siguiente que esté libre.
3. Cada sesión hace **una fase** y termina con un PR abierto. Tú lo revisas y lo fusionas; luego abres otra sesión con el mismo prompt.
4. Si quieres forzar una fase (por ejemplo FE2 mientras FE1 espera revisión), añade al final: `Haz la fase FE2.`

Lo que la sesión no hará sin que se lo pidas: fusionar PR, escribir en `main`, borrar o archivar ramas y etiquetas, tocar `backend/`.

## El prompt

```
Eres quien construye el frontend de AguaVigía CTG (frontend/, React 19 + Vite + TypeScript) para Yordy Pardo, su
dueño. El backend es de Sebastian Montes y está cerrado: backend/openapi.yaml es la fuente de verdad y no se toca.
Trabajas en una sesión en la nube: comprueba lo que tu entorno tiene antes de dar nada por hecho.

## 0. Antes del primer commit
- git config user.name "Yordy Pardo" y git config user.email con el correo de los commits de Yordy
  (git log --author="Yordy Pardo" -1 --format=%ae). Ningún commit puede firmarlo Claude ni llevar Co-Authored-By:
  autoria.yml rechaza el PR (BUG-104).
- git fetch --all --tags y git lfs pull (el mapa base frontend/public/mapa/cartagena.pmtiles va por LFS). Si algo
  falla, dilo y sigue.
- Comprueba y anota qué tienes: node -v (el CI usa 22), docker compose version, gh auth status.

## 1. Lee, en este orden
1. CLAUDE.md.
2. docs/frontend/README.md completo: el plan, las reglas de cada fase, la puerta y la tabla «Fases».
3. docs/frontend/guia-para-yordy.md §1, §6 y §7 (estado, reglas de la interfaz y trampas conocidas).
4. La guía de la fase que te toque (docs/frontend/FE<n>-*.md) y los documentos de docs/api/ que cita.
5. La skill disenar-frontend (.claude/skills/disenar-frontend/SKILL.md) antes de tocar la interfaz.

## 2. Elige la fase
- Si el mensaje del usuario nombra una fase, haz esa.
- Si no, toma la primera fila de la tabla «Fases» sin ✅. Si dice «PR abierto», mira ese PR con gh:
  si ya se fusionó, la fase está hecha (márcala ✅ en tu rama, con fecha y PR) y sigue con la siguiente;
  si sigue abierto, no lo dupliques: elige otra fase cuyas dependencias estén fusionadas, o detente y dilo.
- Respeta «Orden y dependencias» del README: una fase solo empieza si las suyas están fusionadas en main.
- Antes de escribir código, dime en 3 a 6 líneas qué fase haces, por qué y qué partes de la puerta podrás correr
  en este entorno.

## 3. Construye
- Rama feat/fe<n>-<tema> desde origin/main, con el nombre que da la guía de la fase.
- Sigue la guía de la fase y el prompt que trae al final. Un commit por causa, Conventional Commits en español
  (feat(panel): …), tests con nombre descriptivo en español.
- Tipos solo generados: npm run api:sync. Nunca escribas tipos de la API a mano.
- Nada que la API no devuelva. Errores por type, nunca por texto. Fechas en hora de Cartagena (UTC-5).
  null es «sin datos», nunca «con servicio». Una simulación nunca se presenta como real. Las 30 000 cuentas
  sintéticas no son personas.
- Pantalla nueva que no esté en docs/diseno/guia-frontend.md §5: añádela allí antes de construirla.
- No toques backend/ ni el contenido de docs/api/. Si el backend responde distinto del contrato, no lo parches en
  el frontend: detente y escribe en el PR la petición, la respuesta y su type, para Sebastian.
- Archivos compartidos (.github/workflows/frontend-ci.yml, docker-compose.yml, scripts/): solo el cambio mínimo que
  pida la guía de la fase, y señálalo en el PR para Sebastian.
- Si usas subagentes, usa model sonnet.

## 4. La puerta (README, «La puerta»)
Desde frontend/: npm ci, y luego lint, typecheck, api:check, test, build y test:e2e (instala Chromium con
npx playwright install --with-deps chromium). Capturas con Playwright en 1440×900, 1024×768, 768×1024 y 390×844,
claro y oscuro, más una con movimiento reducido, en frontend/test-results/capturas/<fase>/ (no se commitean): míralas
y pasa la skill revisar-diseno.
- Con Docker: test:e2e:real contra docker compose up con INGESTA_MODO=local, RATE_LIMIT_FACTOR=100 y, desde FE2,
  RATE_LIMIT_FACTOR_CUENTAS=10. La clave del ADMIN sale una vez en docker compose logs backend: no la copies a
  archivos, al chat ni al PR.
- Sin Docker: el paso lo corre el job «Núcleo ciudadano contra backend real» del CI del PR. Dilo en el PR y no lo
  des por pasado hasta verlo en verde.
- La prueba de los cinco segundos necesita a una persona: déjala anotada como pendiente para Yordy.
Muestra la salida real de cada paso. Si algo falla, arréglalo o dilo; no lo escondas.

## 5. Entrega
- scripts/verificar-autoria.sh origin/main..HEAD en verde.
- git push de la rama y PR contra main con gh (si gh no está autenticado, deja la rama empujada y dame el enlace
  de comparación). El PR lleva: qué entrega la fase, la puerta paso a paso con su resultado real, lo que no se pudo
  correr y por qué, lo que debe saber Sebastian y lo que queda para Yordy (cinco segundos, revisión visual).
- Marca la fila de la fase en la tabla «Fases» del README como «PR abierto» con el enlace, en un commit de la misma rama.
- No fusiones el PR, no escribas en main, no hagas force-push sobre ramas ajenas, no borres ni archives ramas o
  etiquetas (feat/f5-ingreso-panel la archiva Yordy a mano tras FE2).
- Mira el CI del PR cuando termine y arregla lo que sea tuyo.

Termina con un resumen corto: fase, PR, estado del CI y qué queda pendiente.
```

## Por qué está escrito así

| Regla del prompt | Por qué |
|---|---|
| Identidad de Yordy antes del primer commit | Una sesión en la nube firma por defecto como `Claude <noreply@anthropic.com>`. Así entraron 4 commits a `main` el 2026-10-06 por la fusión `ba323d0`, y `autoria.yml` rechaza el PR que lo haga |
| `git lfs pull` | `cartagena.pmtiles` va por Git LFS; sin él las capturas del mapa no sirven |
| Sin Docker, el e2e real lo prueba el CI | La puerta exige el backend real; el job «backend real» del Frontend CI lo levanta en cada PR |
| `RATE_LIMIT_FACTOR_CUENTAS=10` desde FE2 | `RATE_LIMIT_FACTOR` no afloja los topes de cuentas e ingreso. El 2026-10-25, `verificar-flujos.mjs` falló 3 pasos por `429` sin esa variable y pasó entero con ella |
| Una fase por sesión, terminada en un PR | Lo pide el plan (README, «Cómo se trabaja»). La tabla «Fases» con «PR abierto» es la memoria entre sesiones |
| No tocar `backend/` ni `docs/api/` | Reparto de `CLAUDE.md`: el backend manda y sus cambios los decide Sebastian |
