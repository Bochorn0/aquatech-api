# Guía de Migraciones en CentOS - TI Water

## 🐧 Configuración para CentOS

En CentOS, PostgreSQL generalmente se instala en una ubicación no estándar. Esta guía te ayudará a ejecutar las migraciones correctamente.

## 📋 Verificaciones Previas

### 1. Verificar Ubicación de PostgreSQL

```bash
# En CentOS, busca psql en las ubicaciones comunes
ls -la /usr/pgsql-*/bin/psql

# O verifica la versión instalada
find /usr -name psql 2>/dev/null

# Verificar si está en PATH
which psql
```

**Ubicaciones comunes en CentOS:**
- `/usr/pgsql-15/bin/psql` (PostgreSQL 15)
- `/usr/pgsql-16/bin/psql` (PostgreSQL 16)
- `/usr/pgsql-14/bin/psql` (PostgreSQL 14)
- `/usr/pgsql-13/bin/psql` (PostgreSQL 13)

### 2. Verificar Base de Datos Existe

```bash
# Opción 1: Usando la ubicación específica de PostgreSQL
/usr/pgsql-15/bin/psql -U postgres -l | grep ti_water

# Opción 2: Si está en PATH
psql -U postgres -l | grep ti_water
```

### 3. Verificar Variables de Entorno

```bash
# Revisar .env file
cat .env | grep -i postgres
cat .env | grep -i tiwater

# Verificar que las variables estén configuradas
echo $POSTGRES_TIWATER_DB
echo $POSTGRES_TIWATER_USER
echo $POSTGRES_TIWATER_PASSWORD
```

## 🚀 Ejecutar Migraciones

### Opción 1: Usando Script NPM (Recomendado)

```bash
# Navegar al directorio del proyecto
cd /path/to/Aquatech_api

# Ejecutar migración de productos
npm run migrate:tiwater:products

# Ejecutar migración de cotizaciones
npm run migrate:tiwater:quotes
```

### Opción 2: Usando Script Directo

```bash
# Ejecutar script de migración
bash scripts/migrations/run-tiwater-migration.sh scripts/migrations/004_create_tiwater_products_table.sql

# Con output visible
bash -x scripts/migrations/run-tiwater-migration.sh scripts/migrations/004_create_tiwater_products_table.sql
```

### Opción 3: Manualmente con psql

```bash
# Si conoces la ubicación de psql
/usr/pgsql-15/bin/psql -U tu_usuario -d ti_water -f scripts/migrations/004_create_tiwater_products_table.sql

# O con password en variable de entorno
export PGPASSWORD=tu_password
/usr/pgsql-15/bin/psql -h localhost -U tu_usuario -d ti_water -f scripts/migrations/004_create_tiwater_products_table.sql
```

## 🔍 Verificar Migración

### Script de Verificación

```bash
# Ejecutar script de verificación
npm run verify:tiwater

# O directamente
bash scripts/migrations/verify-tiwater-tables.sh
```

### Verificación Manual

```bash
# Conectar a la base de datos
/usr/pgsql-15/bin/psql -U tu_usuario -d ti_water

# Listar tablas
\dt

# Verificar tabla específica
\d tiwater_products
\d tiwater_quotes
\d tiwater_quote_items

# Salir
\q
```

## ⚙️ Configuración del .env en CentOS

**Archivo:** `Aquatech_api/.env`

```env
# TI Water Database Configuration (CentOS)
POSTGRES_TIWATER_HOST=localhost
POSTGRES_TIWATER_PORT=5432
POSTGRES_TIWATER_DB=ti_water
POSTGRES_TIWATER_USER=tu_usuario
POSTGRES_TIWATER_PASSWORD=tu_password
POSTGRES_TIWATER_SSL=false

# Si no tienes variables específicas TI Water, usa las regulares
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
# POSTGRES_USER=tu_usuario
# POSTGRES_PASSWORD=tu_password
```

## 🐛 Solución de Problemas

### Problema: "psql: command not found"

**Solución:**
```bash
# Agregar PostgreSQL al PATH (temporal)
export PATH="/usr/pgsql-15/bin:$PATH"

# O permanente (agregar a ~/.bashrc)
echo 'export PATH="/usr/pgsql-15/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Problema: "role does not exist"

**Solución:**
```bash
# Crear usuario de PostgreSQL
sudo -u postgres createuser -s tu_usuario

# O con psql
sudo -u postgres /usr/pgsql-15/bin/psql -c "CREATE USER tu_usuario WITH PASSWORD 'tu_password';"
sudo -u postgres /usr/pgsql-15/bin/psql -c "ALTER USER tu_usuario CREATEDB;"
```

### Problema: "database does not exist"

**Solución:**
```bash
# Crear base de datos
sudo -u postgres /usr/pgsql-15/bin/psql -c "CREATE DATABASE ti_water;"

# Dar permisos
sudo -u postgres /usr/pgsql-15/bin/psql -c "GRANT ALL PRIVILEGES ON DATABASE ti_water TO tu_usuario;"
```

### Problema: "connection refused" o "authentication failed"

**Solución:**
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql-15

# O si es otro servicio
sudo systemctl status postgresql

# Iniciar si no está corriendo
sudo systemctl start postgresql-15

# Verificar puerto
sudo netstat -tlnp | grep 5432
```

### Problema: No hay output del script

**Solución:**
```bash
# Ejecutar con verbose
bash -x scripts/migrations/run-tiwater-migration.sh scripts/migrations/004_create_tiwater_products_table.sql

# O ejecutar manualmente para ver output
/usr/pgsql-15/bin/psql -U tu_usuario -d ti_water -f scripts/migrations/004_create_tiwater_products_table.sql
```

## ✅ Checklist para CentOS

- [ ] PostgreSQL está instalado y corriendo
- [ ] Conoces la ubicación de `psql` (ej: `/usr/pgsql-15/bin/psql`)
- [ ] Base de datos `ti_water` existe
- [ ] Usuario de PostgreSQL tiene permisos
- [ ] Variables de entorno están configuradas en `.env`
- [ ] Script tiene permisos de ejecución: `chmod +x scripts/migrations/run-tiwater-migration.sh`
- [ ] Puedes conectarte manualmente: `psql -U usuario -d ti_water`

## 📝 Comandos Útiles en CentOS

```bash
# Ver versiones de PostgreSQL instaladas
ls -la /usr/pgsql-*/

# Ver qué servicios de PostgreSQL están corriendo
sudo systemctl list-units | grep postgres

# Conectar con usuario específico
sudo -u postgres /usr/pgsql-15/bin/psql

# Ver configuraciones de PostgreSQL
sudo cat /var/lib/pgsql/15/data/postgresql.conf | grep port
```

## 🎯 Comando de Verificación Rápida

```bash
# Este comando verifica todo de una vez
cd /path/to/Aquatech_api && \
  echo "Checking PostgreSQL..." && \
  ls -la /usr/pgsql-*/bin/psql 2>/dev/null || which psql && \
  echo "Checking database..." && \
  /usr/pgsql-15/bin/psql -U tu_usuario -l 2>/dev/null | grep ti_water && \
  echo "Checking .env..." && \
  cat .env | grep TIWATER && \
  echo "✅ All checks passed!"
```

---

**¿Problemas?** Ejecuta el script con `bash -x` para ver qué está pasando:
```bash
bash -x scripts/migrations/run-tiwater-migration.sh scripts/migrations/004_create_tiwater_products_table.sql
```
