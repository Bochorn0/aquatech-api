# Migración de product_logs: MongoDB → PostgreSQL

Migra registros de `product_logs` desde MongoDB (servidor actual) hacia PostgreSQL, filtrando por el año en curso (enero hasta la fecha actual).

## Requisitos previos

1. **MongoDB** (servidor actual): colección `productlogs` (o el nombre que use tu app)
2. **PostgreSQL** (destino): tabla `product_logs` y `products` ya creadas
3. **Mapeo product_id**: La tabla `products` en PostgreSQL debe tener los mismos `device_id` que los `product_id` en MongoDB, para poder resolver la FK `product_id`

## Información necesaria para generar el script

| Dato | Descripción | Ejemplo |
|------|-------------|---------|
| **MONGODB_URI** | Cadena de conexión a MongoDB | `mongodb://localhost:27017` o `mongodb://user:pass@host:27017/dbname` |
| **MONGODB_DB** | Nombre de la base MongoDB | `TIWater`, `aquatech`, etc. |
| **MONGODB_COLLECTION** | Nombre de la colección (opcional) | `productlogs` (default) |
| **Campo de fecha** | Campo usado para filtrar (enero–hoy) | `date` o `createdAt` |
| **PostgreSQL** | Ya configurado en `.env` (POSTGRES_*) | - |

## Estructura de datos

### MongoDB (ProductLog)
- `producto`: ObjectId ref a Product
- `product_id`: String (device_id, ej. Tuya device ID)
- `tds`, `production_volume`, `rejected_volume`, `temperature`, `flujo_produccion`, `flujo_rechazo`, `tiempo_inicio`, `tiempo_fin`, `source`, `date`

### PostgreSQL (product_logs)
- `product_id`: BIGINT (FK a products.id)
- `product_device_id`: VARCHAR (device_id)
- Mismos campos numéricos + `date`, `source`

El script usa `product_id` (device_id) de MongoDB para buscar en `products.device_id` y obtener `products.id` en PostgreSQL.

## Dónde ejecutar

El script necesita acceso a **ambas** bases de datos:
- **MongoDB** (servidor actual): para leer `product_logs`
- **PostgreSQL** (destino): para mapear `device_id` → `products.id` y opcionalmente insertar

Ejecútalo desde una máquina que pueda conectarse a ambas (por ejemplo, el servidor actual con PostgreSQL configurado, o tu PC con las URIs apuntando a cada servidor).

## Requisito: tabla products

La tabla `products` debe existir en PostgreSQL (migración 021). Si no:

```bash
npm run migrate:products
# o: bash scripts/migrations/run-migration.sh scripts/migrations/021_create_products_table.sql
```

## Uso del script

```bash
# 1. Configurar variables de entorno (o .env)
export MONGODB_URI="mongodb://localhost:27017"   # o IP del servidor MongoDB
export MONGODB_DB="TIWater"                       # nombre de la base MongoDB
# PostgreSQL: POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD (o .env)

# 2. Generar archivo de migración (para revisar)
node scripts/migrate-product-logs-mongo-to-postgres.js
# → Escribe: scripts/migrations/product_logs_migration_YYYYMMDD.sql

# Solo últimos 10 días (para pruebas con menos datos)
node scripts/migrate-product-logs-mongo-to-postgres.js --days=10

# Si products está vacío: crear productos mínimos automáticamente para los device_id en los logs
node scripts/migrate-product-logs-mongo-to-postgres.js --days=10 --auto-create-products
# (o sin el flag: se auto-crean cuando products tiene 0 filas)

# Un archivo por mes (para ejecutar en 3 pasos y dar tiempo al servidor)
node scripts/migrate-product-logs-mongo-to-postgres.js --split-months
# → product_logs_migration_2026_01.sql, _2026_02.sql, _2026_03.sql

# Formato COPY (más rápido, archivos más pequeños) - recomendado para Azure
node scripts/migrate-product-logs-mongo-to-postgres.js --format=copy
# → product_logs_2026_01.csv, _2026_02.csv, _2026_03.csv + product_logs_copy.sql

# Si ya tienes archivos INSERT, convertir a COPY:
node scripts/convert-product-logs-to-copy.js

# 3. Revisar el archivo generado
# 4. Ejecutar en PostgreSQL cuando estés listo
# Opción A: INSERT
psql -h HOST -U USER -d DB -f scripts/migrations/product_logs_migration_2026_01.sql
# Opción B: COPY (recomendado - más rápido)
cd scripts/migrations && psql -h HOST -U USER -d DB -f product_logs_copy.sql
```

### Opciones adicionales

```bash
# Ruta personalizada para el archivo
node scripts/migrate-product-logs-mongo-to-postgres.js -o /ruta/custom.sql

# Insertar directamente (sin revisar archivo)
node scripts/migrate-product-logs-mongo-to-postgres.js --execute
```

## Registros omitidos

- Logs cuyo `product_id` (device_id) no existe en `products` de PostgreSQL
- Logs con `date` nula o inválida

Estos se reportan en stderr para revisión.
