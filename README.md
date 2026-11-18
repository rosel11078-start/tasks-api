# Tasks API

API REST para gestionar tareas con Node.js, TypeScript, NestJS, Prisma y PostgreSQL.

## Cómo ejecutarlo

Requisitos: Node.js 20.12 o superior y Docker.

```bash
npm install
cp .env.example .env
npm run db:up        # PostgreSQL 17 en Docker, puerto 5433
npm run migrate      # aplica las migraciones
npm run build && npm start   # http://localhost:3000
```

Para desarrollo: `npm run start:dev`.

### Tests

```bash
npm test             # unitarios (no necesitan base de datos)
npm run test:e2e     # e2e por HTTP contra PostgreSQL (con la base levantada)
```

Los e2e usan un esquema propio (`test`) dentro de la misma base y lo migran solos antes de empezar, así que no tocan los datos de desarrollo. Se puede apuntar a otra base con `TEST_DATABASE_URL`.

## Endpoints

| Método | Ruta | Respuesta |
|---|---|---|
| `POST` | `/tasks` | 201 con la tarea creada |
| `GET` | `/tasks?status=&assignee=&page=1&limit=20` | 200 con `{ data, meta: { page, limit, total, totalPages } }` |
| `GET` | `/tasks/:id` | 200 con la tarea |
| `PATCH` | `/tasks/:id` | 200 con la tarea actualizada (solo los campos enviados) |
| `DELETE` | `/tasks/:id` | 204 sin cuerpo |

Una tarea:

```json
{
  "id": "f789ebf8-8ad4-445e-b753-50d615031476",
  "title": "Preparar demo",
  "description": "",
  "status": "pending",
  "assignee": "Ana",
  "dueDate": "2026-12-01",
  "createdAt": "2026-11-18T19:48:37.668Z",
  "updatedAt": "2026-11-18T19:48:37.668Z"
}
```

- `status`: `pending`, `in_progress` o `done` (pendiente, en curso, hecha). Si no se envía, es `pending`.
- `title` (máx. 200), `assignee` (máx. 100) y `dueDate` (`YYYY-MM-DD`) son obligatorios; `description` es opcional.

Errores:

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos, campos que no existen, `id` que no es un UUID, `PATCH` vacío, `page`/`limit` fuera de rango |
| 404 | La tarea no existe |

El cuerpo de los 400 lista cada problema (`"message": ["title should not be empty", ...]`).

Ejemplo:

```bash
curl -X POST localhost:3000/tasks -H 'content-type: application/json' \
  -d '{"title":"Preparar demo","assignee":"Ana","dueDate":"2026-12-01"}'
curl 'localhost:3000/tasks?status=pending&assignee=ana&page=1&limit=10'
```

## Decisiones

- **NestJS + Prisma + PostgreSQL.** Es el stack con el que trabajo en proyectos reales. Prisma da migraciones versionadas en SQL (`prisma/migrations`) y tipos generados del esquema.
- **`dueDate` como `DATE`.** Una fecha límite es un día, no un instante: se guarda sin hora y se devuelve en el mismo formato `YYYY-MM-DD` en que se envía, sin problemas de zona horaria. La validación rechaza fechas imposibles como `2026-02-30`.
- **`assignee` como texto.** La prueba no pide usuarios; un texto mantiene el alcance. El filtro por responsable no distingue mayúsculas.
- **`PATCH` y no `PUT`.** Editar suele ser cambiar uno o dos campos (por ejemplo, solo el estado).
- **Validación estricta.** `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`: un campo desconocido es un 400, no se ignora en silencio.
- **404 sin consultas extra.** `PATCH` y `DELETE` van directo a la base; si la tarea no existe, Prisma responde `P2025` y un filtro de excepciones lo convierte en 404. Así no hay una consulta previa ni una carrera entre comprobar y borrar.
- **Orden del listado:** por fecha límite y luego por creación, para que la paginación sea estable.
- **La misma configuración en los tests.** `configureApp` aplica los pipes y filtros tanto en `main.ts` como en los e2e, así que los tests prueban lo mismo que corre en producción.

## Qué haría con más tiempo

- Documentación OpenAPI/Swagger generada desde los DTOs.
- Autenticación y una tabla de usuarios, con `assignee` como relación en vez de texto.
- Ordenar y filtrar por más campos (rango de fechas, búsqueda por título) y paginación por cursor para listas grandes.
- Índice sobre `lower(assignee)` para que el filtro sin mayúsculas use índice.
- Dockerfile de la API, CI con los tests y la base en un servicio, logs estructurados y health check.

## Cómo usé la IA

Usé Claude Code (modelo Claude Opus 5.5) durante toda la prueba.

**Qué le pedí:** revisar mis proyectos por si había una base reutilizable, proponer el stack, escribir el código, los tests y este README por pasos, con un commit por avance.

**Qué acepté:**
- Empezar desde cero en vez de adaptar un proyecto anterior de tareas (NestJS + TypeORM con SQLite): solo tenía título y completado, sin filtros, paginación, validación ni migraciones, así que adaptarlo era rehacerlo.
- La estructura NestJS + Prisma, que es la misma que uso en proyectos reales, y la propuesta de validación, errores y tests.

**Qué se corrigió al probar la API a mano con curl:**
- `dueDate` salía como `2026-12-01T00:00:00.000Z`; se cambió para devolver `2026-12-01`, igual que se envía.
- Al clonar el repositorio desde cero no compilaba: el cliente de Prisma no se generaba al instalar. Se añadió `prisma generate` en `postinstall`.
- Y `npm start` fallaba con `Environment variable not found: DATABASE_URL`: Prisma solo lee `.env` desde su CLI. `main.ts` ahora carga `.env` si existe.
- La primera versión de `PATCH` y `DELETE` buscaba la tarea antes de modificarla: dos consultas y una carrera si otra petición la borraba en medio, que acababa en 500. Se cambió por el filtro de `P2025` a 404.
