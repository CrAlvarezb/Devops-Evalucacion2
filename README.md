# Tienda Perritos — Evaluación Parcial 2 de Ingeniería DevOps (DOY0101)

**Integrantes:** Cristian Alvarez B. (`CrAlvarezb`) y Cristian Caceres G. (`cristianzintro`).

## Descripción y arquitectura

Tienda Perritos permite consultar, buscar, crear, editar y eliminar productos desde una página web. El navegador solicita los datos a una API, que los guarda en MySQL. El pipeline de GitHub Actions busca comprobar los cambios mediante pruebas, análisis de seguridad, construcción de imágenes y un despliegue temporal con Docker Compose.

El trabajo técnico de EP2 llegó a `main` mediante el [Pull Request #3](https://github.com/CrAlvarezb/Devops-Evalucacion2/pull/3), integrado el 30 de octubre de 2026. La actualización posterior del README quedó registrada en el commit [`446c819`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/446c819) de `feature/ep2-auditoria-cicd`.

| Componente | Tecnología y función | Puerto |
|---|---|---|
| `tienda-frontend` | Nginx sirve HTML y JavaScript; envía `/api/` al backend | 80 interno; `127.0.0.1:8080` en el equipo |
| `tienda-backend` | Node.js 22, Express y `mysql2`; API de productos y endpoint de salud | 3001, solo en la red de Compose |
| `tienda-db` | MySQL 8; almacena productos y ejecuta `db/init.sql` al crear una base nueva | 3306, solo en la red de Compose |

La configuración está en [docker-compose.yml](docker-compose.yml). Nginx dirige las solicitudes a `tienda-backend:3001`; el backend se conecta a `tienda-db:3306`. Los contenedores comparten la red `tienda-net` y `mysql_data` conserva los datos. Hay tres Dockerfiles: [frontend](frontend/Dockerfile), [backend](backend/Dockerfile) y [base de datos](db/Dockerfile). El frontend y la API son dos componentes de aplicación separados; la base de datos es infraestructura, no un microservicio. El repositorio no demuestra dos servicios de negocio independientes, como podría exigir una interpretación estricta de la pauta.

## Instalación y ejecución local

Se necesitan Docker con contenedores Linux y Docker Compose. Para ejecutar las pruebas fuera de Docker se necesitan Node.js 22 y npm. Desde la raíz del repositorio, copia `.env.example` a `.env` y reemplaza `DB_ROOT_PASSWORD` y `DB_APP_PASSWORD` por valores propios. `.env` figura en [.gitignore](.gitignore). No publiques ese archivo. Si `mysql_data` ya fue inicializado con otras credenciales, la base seguirá usando las anteriores hasta que se cambien allí o se recree deliberadamente el volumen.

```sh
docker compose config --quiet
docker compose build
docker compose up -d --wait --wait-timeout 180
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
curl --fail http://127.0.0.1:8080/api/productos
docker compose down
```

`build` construye las tres imágenes; `up` inicia los servicios y `--wait` espera sus *healthchecks*. Las consultas HTTP comprueban además la respuesta de la API a través de Nginx. `down` detiene los contenedores y conserva `mysql_data`; `docker compose down -v` elimina también los datos del volumen. Compose etiqueta las imágenes con `APP_VERSION`, cuyo valor local predeterminado es `local`.

Compose aplica límites de CPU y memoria, reinicio `unless-stopped` y *healthchecks* a los tres servicios. MySQL debe estar saludable antes de iniciar el backend, y el backend antes del frontend. Para levantar dos instancias del backend se puede usar `docker compose up -d --scale tienda-backend=2 --wait --wait-timeout 180`. Esto es escalado manual; no hay autoescalado en el flujo Compose de esta evaluación. Los manifiestos de `k8s/` y los workflows `*.disabled` corresponden a despliegues anteriores y no se ejecutan en el pipeline EP2 activo.

## Pruebas y calidad

La suite de [backend/test.js](backend/test.js) usa `node:test` con respuestas simuladas de MySQL. Comprueba validación de productos e identificadores, códigos HTTP del CRUD, parámetros de las consultas SQL y la respuesta de salud cuando la base de datos funciona o falla. `node --check` solo revisa la sintaxis del JavaScript del frontend; no prueba su comportamiento. Los comandos definidos por [backend/package.json](backend/package.json) y el workflow son:

```sh
cd backend
npm ci
npm test
cd ..
node --check frontend/app.js
```

El [informe técnico](INFORME_EVALUACION.md) y el README anterior registran verificaciones locales del 29 de octubre de 2026, incluidas pruebas y consultas HTTP. No se repitieron localmente durante esta actualización de documentación. El job `pruebas` de la [ejecución del commit `817d484`](https://github.com/CrAlvarezb/Devops-Evalucacion2/actions/runs/41143418593) terminó correctamente. No hay reporte LCOV de cobertura integrado al análisis SonarQube.

## Pipeline CI/CD y seguridad

El workflow de `main`, [.github/workflows/ci.yml](.github/workflows/ci.yml), se activa por `push` a `main`, `develop` o `feature/ep2-auditoria-cicd`, por pull requests hacia `main` o `develop`, y manualmente. Sus jobs se encadenan en este orden:

1. **`pruebas`:** instala con `npm ci`, ejecuta `npm test` en el backend y revisa la sintaxis del frontend.
2. **`seguridad`:** exige el secret `SONAR_TOKEN`, ejecuta SonarQube Cloud y espera el Quality Gate. Luego Trivy escanea vulnerabilidades, configuración y secretos, omitiendo `k8s/` y `tools/`. Con severidad `HIGH,CRITICAL` y `exit-code: "1"`, un hallazgo de esas severidades hace fallar el job.
3. **`construccion`:** valida Compose, construye las imágenes y comprueba las etiquetas del backend y frontend. Depende del éxito de `seguridad`.
4. **`despliegue-simulado`:** genera credenciales temporales, vuelve a construir y levanta Compose en su propio runner, espera los *healthchecks* y consulta `/api/health` y `/api/productos` por Nginx. Registra estado y logs y elimina los recursos al terminar. No publica un entorno permanente.

El workflow etiqueta las imágenes con `GITHUB_SHA`, lo que permite relacionar una ejecución con el commit. Cada job usa un runner distinto; la construcción del tercer job y el despliegue del cuarto no comparten imágenes locales. [Dependabot](.github/dependabot.yml) está configurado para proponer actualizaciones semanales de npm, imágenes Docker y GitHub Actions. Hay propuestas abiertas en [Pull Requests](https://github.com/CrAlvarezb/Devops-Evalucacion2/pulls); cada una requiere revisión y sus propios checks antes de integrarse.

[sonar-project.properties](sonar-project.properties) define el proyecto y el alcance del análisis. El token de SonarQube se guarda como `SONAR_TOKEN` en **GitHub → Settings → Secrets and variables → Actions**, sin incluir su valor en el repositorio. Las contraseñas locales se proporcionan mediante `.env`; el workflow genera otras efímeras en los runners. La configuración espera el Quality Gate (`sonar.qualitygate.wait=true`) y, si falla el análisis o el gate, no llega a construcción ni despliegue.

El historial local de Compose contiene contraseñas antes versionadas. Si se usaron en algún entorno real, corresponde rotarlas; retirarlas de los archivos actuales no las elimina del historial. El informe técnico anterior también registra que `npm test` encontró un error `spawn EPERM` en Windows durante una verificación, aunque las pruebas pasaron al ejecutarse sin aislamiento de archivo. Ese resultado no se repitió en esta revisión.

En la [ejecución del commit `817d484`](https://github.com/CrAlvarezb/Devops-Evalucacion2/actions/runs/41143418593), `pruebas` y el paso de análisis SonarQube con espera del Quality Gate terminaron correctamente. El paso de Trivy falló, por lo que `construccion` y `despliegue-simulado` quedaron omitidos. El [log del PR de documentación](https://github.com/CrAlvarezb/Devops-Evalucacion2/actions/runs/41144917040/job/124367722167) muestra el mismo bloqueo: Trivy reporta `DS-0002` de severidad HIGH por la falta de una instrucción `USER` con usuario no privilegiado en `db/Dockerfile` y `frontend/Dockerfile`. Estas ejecuciones no acreditan un despliegue aprobado.

## Trazabilidad y evidencias

Los commits identifican los cambios de cada integrante. El [PR #3](https://github.com/CrAlvarezb/Devops-Evalucacion2/pull/3) y su [commit de merge `1b62306`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/1b62306) registran la integración técnica de EP2 en `main`. [GitHub Actions](https://github.com/CrAlvarezb/Devops-Evalucacion2/actions) relaciona cada ejecución y sus jobs con el SHA correspondiente. Los números de PR citados en mensajes de merge del historial anterior no identifican necesariamente los mismos PR de este repositorio de entrega.

| Indicador | Evidencia en el repositorio | Límite de la evidencia |
|---|---|---|
| IE1: contenedores y Dockerfiles | `docker-compose.yml` y los Dockerfiles de `frontend/`, `backend/` y `db/` | Dos componentes de aplicación; no se acreditan dos servicios de negocio distintos. |
| IE2: pruebas automatizadas | `backend/test.js`, `backend/package.json` y job `pruebas` | El job citado terminó correctamente; la sintaxis del frontend no es prueba unitaria. |
| IE3: seguridad y escalabilidad | `sonar-project.properties`, `.github/dependabot.yml`, job `seguridad` y límites de Compose | En la ejecución citada, SonarQube terminó correctamente y Trivy bloqueó el flujo; autoescalado no acreditado. |
| IE4: despliegue y trazabilidad | Jobs `construccion` y `despliegue-simulado`, etiquetas con SHA y commits | Despliegue temporal configurado, pero omitido en la ejecución citada por el fallo de Trivy. |
| IE5: orquestación | `docker-compose.yml`: red, volumen, dependencias y *healthchecks* | El estado saludable de contenedores se complementa con consultas HTTP; no se repitieron aquí. |

## Trabajo de los integrantes

- **Cristian Alvarez B. (`CrAlvarezb`):** el historial muestra cambios de interfaz para modo oscuro y búsqueda ([`2862af0`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/2862af0), [`25d2701`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/25d2701)), validación de precio y stock en la API ([`3e4109c`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/3e4109c)), el workflow inicial, Dependabot y el README ([`f9d2bcc`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/f9d2bcc)), además del ajuste de SonarQube previo al PR #3 ([`09f7acb`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/09f7acb)).
- **Cristian Caceres G. (`cristianzintro`):** los cambios incluyen el entorno local de Compose ([`554b80a`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/554b80a)), trabajo en backend y documentación ([`d5d702c`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/d5d702c), [`5a3ba69`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/5a3ba69)), la revisión EP2 de API, pruebas, contenedores, seguridad y pipeline ([`2a9bd5a`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/2a9bd5a)) y la actualización posterior del README ([`446c819`](https://github.com/CrAlvarezb/Devops-Evalucacion2/commit/446c819)).

Estas atribuciones describen cambios observados en los commits, no la autoría de todo el código anterior. El historial también contiene commits de `MP-Alumno`; no hay datos suficientes para atribuirlos a uno de los dos integrantes. Las verificaciones que faltan y el alcance final de la entrega deben revisarse en GitHub.

## Uso de inteligencia artificial

Codex apoyó la revisión del repositorio y la actualización de este README. El README anterior y el informe técnico registran además apoyo de Codex en una auditoría técnica previa; el equipo debe revisar el alcance de esa declaración antes de entregar. Los usos de otras herramientas mencionados en versiones anteriores no están confirmados aquí. La pauta sobre uso de IA está en [Bibliotecas Duoc UC](https://bibliotecas.duoc.cl/ia). Las justificaciones, conclusiones y reflexiones personales corresponden a los integrantes.

## Reflexiones personales

Se conservan a continuación las reflexiones que ya estaban en el README, sin reescribirlas. Cada integrante debe revisar su propio texto antes de la entrega.

**Cristian Caceres G.**

Como equipo esta evaluación fue un gran desafío, ya que con mi compañero al fin pudimos trabajar desde diferentes ramas integrando estratégicamente cada cambio con su respectivo mensaje, para que no haya ningún cambio sin documentar, como también los errores sean vistos y corregidos a tiempo dentro del flujo de trabajo.

**Cristian Alvarez B.**

Gracias a la ayuda de la IA, las cuales nos sirven de soporte, pudimos llevar una estructura sencilla y sin caer en errores de sintaxis a la hora de ejecutar los comandos de Git. También nos ayuda a mantener un flujo constante dentro de nuestro proyecto, garantizando un pipeline robusto sin perder la autoría técnica de nuestro trabajo.
