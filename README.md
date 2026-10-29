# Evaluación Parcial N°2 - Ingeniería DevOps (DOY0101)
## Proyecto: Tienda Perritos - Pipeline CI/CD y Orquestación de Microservicios

**Institución:** Duoc UC  
**Curso:** Ingeniería DevOps (DOY0101)  

### Integrantes
* Cristian Alvarez B.
* Cristian Caceres G.

---

## 1. Descripción del Proyecto

Tienda Perritos es un sistema basado en una arquitectura de microservicios contenedorizados compuesto por un frontend web (Nginx), un backend de API REST (Node.js con Express) y un motor de base de datos relacional (MySQL 8). 

El objetivo principal de este proyecto es automatizar completamente el ciclo de vida del software mediante un pipeline de Integración Continua y Entrega Continua (CI/CD) alojado en GitHub Actions. El flujo garantiza la validación de código, ejecución de pruebas unitarias, escaneo estático de vulnerabilidades con bloqueo automático y despliegue orquestado mediante Docker Compose.

---

## 2. Matriz de Cumplimiento de Indicadores de Logro (IE1 - IE5)

| Indicador de Logro | Requisito de Evaluación | Implementación en el Proyecto | Estado |
|---|---|---|---|
| **IE1: Uso de Contenedores** | Creación de Dockerfiles distintos y optimizados para microservicios. | Dockerfile en backend (node:18-alpine) y Dockerfile en frontend (nginx:alpine). Reducción de tamaño e imágenes livianas. | Cumplido |
| **IE2: Pruebas Automatizadas** | Integración de pruebas unitarias dentro del pipeline de CI. | Ejecución de npm test (backend/test.js) y chequeo sintáctico (node --check) en GitHub Actions. | Cumplido |
| **IE3: Seguridad y Escalabilidad** | Escaneo de dependencias y políticas de bloqueo por vulnerabilidades. | Implementación de Trivy Scanner con exit-code: 1 ante fallas críticas y automatización con Dependabot. | Cumplido |
| **IE4: Despliegue y Trazabilidad** | Despliegue en entorno simulado y documentación de trazabilidad. | Pipeline en .github/workflows/ci.yml que realiza build y despliegue simulado con Docker Compose. | Cumplido |
| **IE5: Orquestación** | Coordinación de servicios mediante Docker Compose. | Archivo docker-compose.yml con red privada (tienda-net), volúmenes persistentes y verificación de salud (healthcheck). | Cumplido |

---

## 3. Arquitectura del Sistema

La arquitectura está distribuida en tres capas independientes que se comunican internamente mediante una red privada virtual de Docker denominada `tienda-net`:

| Componente | Tecnología | Puerto Interno | Puerto Host / Exposición | Descripción |
|---|---|---|---|---|
| **Frontend** | Nginx + HTML/JS | 80 | 8080 | Servidor web estático y proxy reverso que redirige las peticiones /api/ al backend. |
| **Backend** | Node.js + Express | 3001 | 3001 | API RESTful para la gestión del CRUD de productos de la tienda. |
| **Base de Datos** | MySQL 8 | 3306 | N/A (Red interna) | Base de datos relacional persistente inicializada mediante script SQL. |

---

## 4. Estrategia de Control de Versiones (GitFlow)

Para organizar el trabajo colaborativo de forma estructurada y trazable, implementamos la metodología GitFlow:

* **main:** Rama principal que contiene exclusivamente código estable y probado listo para producción.
* **develop:** Rama de integración continua donde se unen las funcionalidades completadas antes de pasar a main.
* **feature/nombre:** Ramas temporales creadas desde develop para desarrollar tareas específicas por cada integrante.
* **hotfix/nombre:** Ramas temporales creadas desde main para solucionar errores urgentes surgidos en producción.

### Convenciones de Mensajes de Commit
Seguimos una nomenclatura estandarizada para garantizar el rastreo de cambios en el historial de Git:

| Prefijo | Definición | Ejemplo de Commit |
|---|---|---|
| feat | Nueva funcionalidad o módulo | feat: agregar prueba unitaria para backend |
| fix | Corrección de errores o fallas | fix: corregir puerto de conexión a mysql |
| docs | Modificaciones en la documentación | docs: actualizar matriz de rúbrica en readme |
| ci | Ajustes en workflows de GitHub Actions | ci: configurar escaneo de seguridad trivy |
| refactor | Optimización de código sin alterar función | refactor: simplificar dockerfile de frontend |

### Flujo de Merge y Revisión de Código (Pull Requests)
1. Cada integrante crea una rama feature/nombre a partir de la rama develop.
2. Se realiza el desarrollo local y se suben commits siguiendo las convenciones.
3. Se abre un Pull Request (PR) hacia la rama develop.
4. El pipeline de CI/CD debe ejecutar y finalizar correctamente (en verde) antes de realizar el merge.
5. El compañero de equipo revisa el código, verifica que no existan credenciales expuestas y aprueba el PR.
6. Se realiza el merge y se elimina la rama temporal.

---

## 5. Pipeline CI/CD y Prácticas DevSecOps

El pipeline de automatización está definido en `.github/workflows/ci.yml` y se ejecuta ante eventos de push en `develop` o pull requests hacia `main`.

### Etapas del Workflow

1. **Checkout y Preparación de Entorno:** Descarga el código fuente del repositorio y configura Node.js versión 18 en el runner de GitHub Actions.
2. **Pruebas Unitarias y Validación Sintáctica (IE2):** Ejecuta `npm test` sobre la suite de pruebas del backend (`backend/test.js`) y valida la sintaxis de JavaScript en el frontend mediante `node --check`.
3. **Escaneo de Seguridad Estático - Trivy (IE3):** Examina el sistema de archivos y librerías. La acción está configurada con `exit-code: 1` para la severidad `CRITICAL`. Si se detecta una vulnerabilidad grave, el pipeline se bloquea inmediatamente y detiene el despliegue.
4. **Gestión de Dependencias - Dependabot (IE3):** El archivo `.github/dependabot.yml` realiza revisiones automáticas semanales de paquetes npm y de las imágenes base de Docker.
5. **Despliegue Simulado (IE4 e IE5):** Si las etapas previas son exitosas, el job `despliegue-simulado` ejecuta `docker compose build` y `docker compose up -d` en el entorno virtual, verificando el estado final de los contenedores con `docker compose ps`.

---

## 6. Guía de Ejecución y Pruebas Locales

### Requisitos Previos
* Docker Desktop instalado y ejecutándose.
* Git instalado.

### Comandos de Despliegue

1. Construir las imágenes e iniciar la aplicación en segundo plano:
```bash
docker compose up -d --build   



Para el desarrollo de esta evaluación se utilizó asistencia de Inteligencia Artificial Gemini  ChatGP como herramienta de apoyo técnico. El alcance de su uso se limitó a la consulta de sintaxis para archivos de configuración YAML GitHub Actions y Dependabot, estructura de comandos en PowerShell/Bash y revisión de formato Markdown.

Toda la arquitectura del sistema, la lógica del backend en Node.js, las pruebas unitarias y la ejecución de la orquestación fueron implementadas, probadas y validadas directamente por los integrantes del equipo.

7. Reflexiones Personales
Cristian Caceres G.
Como equipo esta evaluación fue un gran desafío, ya que con mi compañero al fin pudimos trabajar desde diferentes ramas integrando estratégicamente cada cambio con su respectivo mensaje, para que no haya ningún cambio sin documentar, como también los errores sean vistos y corregidos a tiempo dentro del flujo de trabajo.

Cristian Alvarez B.
Gracias a la ayuda de la IA, las cuales nos sirven de soporte, pudimos llevar una estructura sencilla y sin caer en errores de sintaxis a la hora de ejecutar los comandos de Git. También nos ayuda a mantener un flujo constante dentro de nuestro proyecto, garantizando un pipeline robusto sin perder la autoría técnica de nuestro trabajo.