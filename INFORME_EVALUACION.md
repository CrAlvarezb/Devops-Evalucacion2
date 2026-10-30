# Informe de Evaluación — Tienda Perritos EKS

## Anexo técnico EP2 — auditoría del repositorio actual (29-10-2026)

Este anexo evalúa el workflow activo `.github/workflows/ci.yml` de EP2. El contenido EKS/EP3 más abajo se conserva como registro histórico; sus URL, ejecuciones remotas y capturas no se verificaron en esta auditoría y no constituyen evidencia del pipeline EP2.

| Indicador | Hallazgo inicial | Corrección técnica | Evidencia local |
|---|---|---|---|
| IE1 | Tres Dockerfile; backend con Node 18 y sin lockfile; credenciales en la imagen de MySQL. | Backend con Node 22, `npm ci`, usuario sin privilegios; frontend Nginx Alpine; credenciales retiradas del Dockerfile de DB. | `docker compose build` construyó las tres imágenes. |
| IE2 | `test.js` solo comprobaba `1 + 1`; el backend no iniciaba por un identificador indefinido. | API separada de la inicialización, validación de entradas y suite `node:test` para CRUD, errores y salud. | 4 pruebas aprobadas con `node --test --experimental-test-isolation=none test.js` en la verificación actual. `node --check frontend/app.js`: sin errores. |
| IE3 | Dependabot parcial; Trivy usaba `exit-code: 0`; faltaba SonarQube/Snyk y había contraseñas en archivos versionados. | Dependabot ampliado, Trivy bloqueante, análisis SonarQube Cloud con Quality Gate obligatorio, credenciales efímeras o locales ignoradas por Git. | `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades. SonarQube y Trivy del runner pendientes de ejecución real. |
| IE4 | El job de despliegue solo hacía `up -d` y `ps`, sin esperar salud ni consultar la API. | Dependencias de jobs: pruebas → seguridad (SonarQube y Trivy) → construcción → despliegue; Compose con `--wait`, consultas HTTP y etiquetas de imagen por SHA. | YAML parseado y dependencias de jobs comprobadas localmente. Despliegue local: salud HTTP 200 y CRUD temporal correcto. Ejecución remota pendiente. |
| IE5 | Compose tenía red y volumen, pero faltaban salud de backend/frontend, reinicios y límites de recursos. | Healthchecks, `depends_on` saludable, reinicio, límites y solo frontend publicado en localhost. | `docker compose config --quiet`: válido; `docker compose up -d --build --wait --wait-timeout 180`: tres servicios saludables. Con `--scale tienda-backend=2`, ambas réplicas saludables y API HTTP 200. |

**Configuración externa pendiente:** el propietario ya importó el proyecto a SonarQube Cloud e informó las claves públicas `CrAlvarezb_Devops-Evalucacion2` y `CrAlvarezb`, registradas en `sonar-project.properties`. Comprobar en la cuenta la región (UE `sonarcloud.io` o EE. UU. `sonarqube.us`), seleccionar análisis por CI y desactivar el automático si está activo; guardar el token de análisis únicamente como GitHub Secret `SONAR_TOKEN`; ejecutar el workflow y revisar el Quality Gate. Las credenciales antiguas estuvieron en el historial Git: el equipo debe rotarlas si se utilizaron en un entorno real. El manifiesto `k8s/mysql-secret.yaml` quedó como plantilla para el flujo EKS deshabilitado y requiere un secreto real antes de volver a habilitarse.

**Compatibilidad SonarQube:** el estado anterior de `main` usaba Node.js 18; la configuración actual de producción y pruebas usa Node.js 22. El job de seguridad, al ejecutarse en otro runner, ahora instala y comprueba Node.js 22 (mínimo 22.11) para analizar JavaScript. La acción SonarQube v8.3.0 usa internamente Node.js 24 y SonarScanner CLI 8.1; el scanner toma Node.js 22 del `PATH` para el analizador. `sonar.qualitygate.wait=true` bloquea la construcción y el despliegue si falla el Quality Gate. Debe seleccionarse análisis por CI en SonarQube Cloud y desactivarse el automático si estuviera activo. No hay LCOV integrado para acreditar cobertura ante un Quality Gate que la exija.

**Límite de validación:** el escaneo local de Trivy se intentó, pero la revisión automática del entorno rechazó montar el repositorio completo en un contenedor externo porque incluía un archivo `.env` sensible. No se dispone de resultado de Trivy ni de SonarQube para este cambio. El análisis de dependencias npm local reportó 0 vulnerabilidades. El `npm test` actual encontró `spawn EPERM` del entorno Windows antes de ejecutar las pruebas; las mismas 4 pruebas pasaron sin aislamiento de archivo. La sintaxis del workflow y las dependencias de jobs se verificaron localmente, pero GitHub Actions y la región, el método de análisis y el plan de SonarQube Cloud no fueron accesibles desde esta sesión. En el plan Free solo están disponibles los análisis de `main` y de pull requests hacia `main`; una ejecución por push a `feature/ep2-auditoria-cicd` puede fallar por esa limitación, por lo que debe verificarse además mediante un pull request hacia `main`.

**IA:** Codex apoyó la auditoría, las modificaciones técnicas y la validación local. El equipo debe revisar y completar la declaración final de uso. Las conclusiones, justificaciones personales y reflexiones estudiantiles se mantienen a cargo de los integrantes.

---

## 1. Demostración del Pipeline CI/CD con Cambios de Color

### 1.1 Flujo Completo

Se realizaron **4 cambios consecutivos** al color del header del frontend, cada uno demostrando el ciclo completo de CI/CD:

| # | Color | Código | Commit | Pipeline |
|---|---|---|---|---|
| 1 | Azul → Verde | `#3b82f6` → `#10b981` | `fix: cambiar color header a verde` | ✅ Success |
| 2 | Verde → Dorado | `#10b981` → `#f59e0b` | `fix: cambiar header a dorado` | ✅ Success |
| 3 | Dorado → Rosado | `#f59e0b` → `#ec4899` | `fix: cambiar header a rosado` | ✅ Success |
| 4 | Rosado → Negro | `#ec4899` → `#1f2937` | `fix: cambiar header a negro` | ⏳ Running |

### 1.2 Ciclo del Pipeline (por cada cambio)

```
1. EDITAR código (frontend/index.html)
        ↓
2. git add + git commit + git push origin main
        ↓
3. GitHub Actions detecta el push a main
        ↓
4. Build de la imagen Docker con el nuevo color
        ↓
5. Push de la imagen a Amazon ECR
        ↓
6. Reemplazo de {{ECR_URL}} en los manifests
        ↓
7. kubectl apply → despliegue en EKS
        ↓
8. Nuevo pod con el color actualizado
        ↓
9. URL pública refleja el cambio
```

### 1.3 Evidencia de funcionamiento

- **URL pública:** http://a3d8a2621fdeb474685bd9e62918ee17-440057208.us-east-1.elb.amazonaws.com
- **Pipeline:** https://github.com/CrAlvarezb/tienda-perritos-EKS/actions
- **API productos:** `GET /api/productos` → 200 OK con 5 productos

---

## 2. Infraestructura AWS

### 2.1 Cluster EKS
- Cluster `tienda-perritos` (K8s 1.31)
- Nodegroup `tienda-nodes`: 2 nodos `t3.medium` (escalable 1-3)
- Región: `us-east-1`

### 2.2 VPC y Redes
- VPC: `vpc-0ab3b425dce2f5f74`
- 5 subnets públicas en `us-east-1a, b, c, d, f`
- Internet Gateway conectado
- Security Groups: administrados por EKS

### 2.3 Roles IAM
- `LabEksClusterRole`: permisos del plano de control
- `LabEksNodeRole`: permisos de nodos worker (ECR, CloudWatch, EC2)

### 2.4 Amazon ECR
| Repositorio | URI |
|---|---|
| tienda-frontend | `933499830430.dkr.ecr.us-east-1.amazonaws.com/tienda-frontend` |
| tienda-backend | `933499830430.dkr.ecr.us-east-1.amazonaws.com/tienda-backend` |
| tienda-db | `933499830430.dkr.ecr.us-east-1.amazonaws.com/tienda-db` |

---

## 3. Servicios Desplegados

### 3.1 Frontend
- 2 réplicas, type LoadBalancer (público)
- Nginx con proxy reverso a backend por DNS interno
- Health probes: readiness y liveness

### 3.2 Backend
- 2 réplicas, type ClusterIP (interno)
- Node.js + Express en puerto 3001
- Variables de entorno desde Secrets de K8s
- Comunicación con MySQL vía DNS interno `tienda-db:3306`

### 3.3 Base de Datos
- 1 réplica MySQL 8
- Headless service (ClusterIP: None)
- Secret con password en base64

---

## 4. Autoscaling (HPA)

| Componente | Métrica | Target | Réplicas |
|---|---|---|---|
| Backend | CPU | 70% | 2 - 10 |
| Frontend | CPU | 60% | 2 - 6 |

**Justificación:**
- **Backend 70%:** Node.js procesa consultas a MySQL. Al escalar al 70% se evitan escalados prematuros, optimizando recursos.
- **Frontend 60%:** Nginx maneja conexiones concurrentes. Escalar al 60% asegura respuesta rápida al usuario.

---

## 5. Comunicación Front → Back

El frontend no expone el backend directamente. Usa Nginx como proxy reverso:

```nginx
location /api/ {
    proxy_pass http://tienda-backend:3001;
}
```

El frontend llama a `/api/productos` y Nginx resuelve el DNS interno `tienda-backend:3001` (ClusterIP).

---

## 6. Pipeline CI/CD — Detalle

### Archivo: `.github/workflows/deploy-eks.yml`

**Disparadores:**
- Push a rama `main`
- Ejecución manual (`workflow_dispatch`)

**Secretos requeridos (GitHub → Settings → Secrets → Actions):**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`

**Pasos:**
1. Checkout del repositorio
2. Configuración de credenciales AWS
3. Login a Amazon ECR
4. Build y push de imágenes (frontend, backend, db) con tags SHA + latest
5. Instalación de kubectl
6. Configuración de kubeconfig contra EKS
7. Reemplazo de `{{ECR_URL}}` por la URL real del registry
8. Despliegue de MySQL (secret + deployment + service)
9. Despliegue de Backend (deployment + service)
10. Despliegue de Frontend (deployment + service)
11. Aplicación de HPA
12. Obtención de URL del LoadBalancer

---

## 7. Pruebas Realizadas

### API
```bash
curl http://a3d8a2621fdeb474685bd9e62918ee17-440057208.us-east-1.elb.amazonaws.com/api/productos
# → 200 OK
# → [5 productos con id, nombre, precio, stock]
```

### Logs
```bash
kubectl logs -n tienda -l app=tienda-backend --tail=50
```

### Recuperación
```bash
kubectl rollout restart deployment tienda-frontend -n tienda
# Pods se reemplazan sin downtime
```

---

## 8. Problemas Encontrados y Soluciones

| Problema | Solución |
|---|---|
| Pipeline falló por falta de AWS Secrets | Configurar secrets en GitHub |
| Pods no actualizaban imagen `:latest` tras pipeline | `kubectl rollout restart deployment` |
| Actions mostraba commits de Basty66 | Crear orphan branch con historial limpio |
| Cambios en rama equivocada (evaluation vs main) | Mergear evaluation → main para triggerear pipeline |

---

## 9. Diagrama de Arquitectura Final

```
                    ┌──────────────┐
                    │   Usuario    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  AWS ALB     │
                    │  (puerto 80) │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Frontend   │  x2 pods
                    │   Nginx      │  t3.medium
                    └──────┬───────┘
                           │ proxy_pass
                    ┌──────▼───────┐
                    │   Backend    │  x2 pods
                    │   Node.js    │  puerto 3001
                    │   Express    │  ClusterIP
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    MySQL     │  x1 pod
                    │    puerto    │  Headless
                    │    3306      │  Service
                    └──────────────┘
```

---

*Documento generado para evaluación EP3 — Tienda Perritos EKS*
