# Tienda Perritos — Evaluación Parcial 2, Ingeniería DevOps

**Integrantes:** Cristian Alvarez B. y Cristian Caceres G.

## Arquitectura

| Servicio | Tecnología | Función | Acceso |
|---|---|---|---|
| tienda-frontend | Nginx, HTML y JavaScript | Interfaz y proxy de `/api/` | http://127.0.0.1:8080 |
| tienda-backend | Node.js 22, Express, mysql2 | API CRUD y salud | Red interna de Compose |
| tienda-db | MySQL 8 | Datos de productos | Red interna de Compose |

Nginx envía las solicitudes API a `tienda-backend:3001`. El backend usa el usuario `tienda_app` para acceder a MySQL. Compose conecta los tres servicios en `tienda-net` y conserva los datos en `mysql_data`. Los Dockerfile de frontend, backend y base de datos están en sus respectivas carpetas. Los manifiestos `k8s/` y los workflows `*.disabled` son material heredado de otro despliegue y no forman parte del flujo EP2 activo.

## Instalación y ejecución local

Se requiere Docker Desktop con motor Linux y Docker Compose. Para ejecutar pruebas fuera de Docker se necesita Node.js 22 y npm.

1. Copiar `.env.example` a `.env`.
2. Sustituir ambos valores de ejemplo por contraseñas únicas. `.env` está excluido de Git. Si ya existe un volumen `mysql_data` inicializado con credenciales antiguas, deben usarse esas credenciales o recrearse el volumen local de forma deliberada.
3. Ejecutar:

```sh
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
curl --fail http://127.0.0.1:8080/api/productos
```

`docker compose down` detiene los contenedores y conserva los datos. `docker compose down -v` también borra el volumen, por lo que debe usarse solo si los datos locales pueden descartarse. El frontend es el único puerto publicado, limitado a localhost. Compose usa healthchecks de MySQL, API y Nginx, orden de arranque por salud y reinicio `unless-stopped`. Las imágenes se etiquetan con `APP_VERSION` (por defecto `local`); el pipeline usa el SHA del commit.

Para comprobar dos réplicas del backend: `docker compose up -d --scale tienda-backend=2 --wait --wait-timeout 180` y `docker compose ps`. El proxy sigue disponible en localhost. Esta prueba valida que las réplicas arrancan y responden; no mide balanceo de carga ni rendimiento.

## Pruebas

```sh
cd backend
npm ci
npm test
cd ..
node --check frontend/app.js
```

La suite usa `node:test` y comprueba validación, códigos HTTP, consultas parametrizadas, CRUD y salud ante falla de base de datos. `npm test` devuelve un código distinto de cero si falla una prueba. La revisión sintáctica del frontend complementa estas pruebas; no se presenta como prueba unitaria.

## Pipeline CI/CD

`.github/workflows/ci.yml` se activa con push a `main`, `develop` o `feature/ep2-auditoria-cicd`, con pull requests hacia `main` o `develop`, y manualmente. Los jobs dependen del anterior:

1. **pruebas:** `npm ci`, `npm test` y sintaxis del frontend.
2. **seguridad:** SonarQube Cloud analiza el código y espera el Quality Gate; un resultado fallido detiene el pipeline. Después, Trivy revisa dependencias, configuración y secretos del flujo activo, con bloqueo en hallazgos HIGH o CRITICAL. Excluye `k8s/` y `tools/`, que pertenecen al despliegue heredado deshabilitado. Dependabot propone semanalmente actualizaciones de npm, Docker y GitHub Actions.
3. **construccion:** valida Compose y construye imágenes Docker solo si pruebas, SonarQube y Trivy finalizaron correctamente.
4. **despliegue-simulado:** crea contraseñas efímeras, construye y levanta Compose en el runner, espera servicios saludables y consulta la API mediante el proxy Nginx. Al terminar muestra estado y logs, y elimina los recursos efímeros.

Cada ejecución identifica el commit por `GITHUB_SHA` y etiqueta las imágenes con ese SHA. La vista de GitHub Actions vincula commit, pruebas, escaneo y despliegue. Una construcción por sí sola no constituye despliegue. El despliegue del runner es temporal y no publica un entorno persistente.

El backend en Docker y el job de pruebas usan Node.js 22. El job de seguridad configura Node.js 22 de forma independiente y comprueba que sea al menos 22.11 para el análisis JavaScript; SonarScanner usa ese `node` del `PATH`. La acción SonarQube v8.3.0 se ejecuta internamente con Node.js 24 y descarga SonarScanner CLI 8.1; estas versiones no cambian el runtime de producción. `sonar-project.properties` contiene el alcance del análisis y las claves públicas `CrAlvarezb_Devops-Evalucacion2` y `CrAlvarezb`. El token solo se lee desde GitHub Secrets.

### Configuración manual en GitHub y SonarQube Cloud

1. El proyecto ya fue importado a SonarQube Cloud. En **Project Information**, confirmar que la clave sea `CrAlvarezb_Devops-Evalucacion2`, la organización `CrAlvarezb` y la región del proyecto. El workflow usa `https://sonarcloud.io` (UE); si el proyecto está en la región de EE. UU., cambiar `SONAR_HOST_URL` a `https://sonarqube.us`. Esta región aún requiere comprobación en la cuenta.
2. En **Project > Administration > Analysis Method**, seleccionar análisis por CI y desactivar el análisis automático si está activo. SonarQube Cloud no admite ambos métodos simultáneamente para el mismo proyecto. Esta opción aún requiere comprobación en la cuenta.
3. En SonarQube Cloud, abrir **My Account > Security** y generar un token con permiso de análisis. En GitHub, abrir **Settings > Secrets and variables > Actions > Secrets > New repository secret** y guardarlo como `SONAR_TOKEN`. No mostrar su valor ni colocarlo en archivos del repositorio. Las claves públicas ya están en `sonar-project.properties`; no hacen falta variables de GitHub adicionales.
4. Revisar el Quality Gate asignado al proyecto y permitir que el runner de Actions acceda a SonarQube Cloud. Los pull requests de forks no reciben secrets por defecto; en ese caso el job de seguridad fallará sin desplegar.
5. Tras un commit y push autorizados a `feature/ep2-auditoria-cicd`, abrir **GitHub > Actions > EP2 CI/CD > ejecución del commit**. Abrir también un pull request de esa rama hacia `main` y revisar su ejecución: el plan Free de SonarQube Cloud analiza `main` y los pull requests hacia `main`, pero no otras ramas por push; en ese plan la ejecución del push a la rama puede fallar en SonarQube aunque la del pull request sea válida. Confirmar `pruebas`, `seguridad` (SonarQube, Quality Gate y Trivy), `construccion` y `despliegue-simulado`, y consultar el análisis del pull request en SonarQube Cloud. Exigir `seguridad` como comprobación de rama antes de fusionar. No hay informe de cobertura LCOV integrado; si el Quality Gate exige cobertura, puede fallar hasta que el equipo agregue ese reporte o mejore las pruebas.

La integración SonarQube está configurada localmente pero aún no validada en una ejecución remota. No se ha confirmado aquí ninguna ejecución de Actions, resultado del Quality Gate, método de análisis ni región del proyecto.

## Evidencia técnica local

Durante la auditoría del 29 de octubre de 2026, las 4 pruebas pasaron, `npm audit --omit=dev --audit-level=high` reportó 0 vulnerabilidades, `node --check frontend/app.js` y `docker compose config --quiet` terminaron sin errores. `docker compose build` construyó las tres imágenes. `docker compose up -d --build --wait --wait-timeout 180` dejó los tres servicios saludables. Mediante http://127.0.0.1:8080/api se obtuvo salud HTTP 200, 5 productos iniciales y se creó, leyó, actualizó y eliminó un producto temporal. Con `--scale tienda-backend=2`, ambas réplicas quedaron saludables y la API siguió respondiendo HTTP 200. En la verificación actual, `npm ci`, `npm audit` y `docker compose build` pasaron; las 4 pruebas pasaron con `node --test --experimental-test-isolation=none test.js`. `npm test` recibió `spawn EPERM` del entorno Windows antes de cargar las pruebas, al crear el subproceso aislado del ejecutor. El escaneo local de Trivy no se ejecutó porque la revisión automática del entorno rechazó dar acceso al repositorio completo a un contenedor externo. La ejecución remota del pipeline, el análisis SonarQube y las propuestas de Dependabot requieren la configuración y ejecución en GitHub.

## Uso de IA

Codex se utilizó como apoyo para revisar código, proponer cambios técnicos y ejecutar verificaciones locales. El equipo debe revisar y validar esta descripción, completar la declaración final de uso de IA y redactar personalmente sus conclusiones, justificaciones y reflexiones conforme a la pauta.

## 7. Reflexiones Personales

Cristian Caceres G.
Como equipo esta evaluación fue un gran desafío, ya que con mi compañero al fin pudimos trabajar desde diferentes ramas integrando estratégicamente cada cambio con su respectivo mensaje, para que no haya ningún cambio sin documentar, como también los errores sean vistos y corregidos a tiempo dentro del flujo de trabajo.

Cristian Alvarez B.
Gracias a la ayuda de la IA, las cuales nos sirven de soporte, pudimos llevar una estructura sencilla y sin caer en errores de sintaxis a la hora de ejecutar los comandos de Git. También nos ayuda a mantener un flujo constante dentro de nuestro proyecto, garantizando un pipeline robusto sin perder la autoría técnica de nuestro trabajo.
