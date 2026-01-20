# Guía para Importar Productos desde Catálogos PDF

## 📋 Resumen

Esta guía explica cómo extraer productos de los catálogos PDF e importarlos a la base de datos `ti_water`.

## 📂 Archivos Disponibles

1. **`006_import_tiwater_products_sample.sql`** - Ejemplo con productos de muestra
2. **`007_import_tiwater_products_template.sql`** - Template SQL para llenar manualmente
3. **`extract-products-from-pdf.js`** - Script helper (no extrae automáticamente de PDFs)

## 🎯 Método Recomendado: Extracción Manual

### Paso 1: Revisar Catálogos PDF

Abre cada catálogo y extrae la siguiente información:

- **Código del producto** (si está disponible)
- **Nombre del producto**
- **Descripción**
- **Categoría** (verificar qué catálogo es)
- **Precio** (si está disponible)
- **Especificaciones técnicas** (dimensiones, materiales, etc.)
- **Página** donde aparece el producto

### Paso 2: Crear Archivo SQL

Usa el template `007_import_tiwater_products_template.sql` o crea uno nuevo:

```sql
INSERT INTO tiwater_products (
  code, 
  name, 
  description, 
  category, 
  price, 
  specifications,
  catalog_source, 
  page_number, 
  is_active
)
VALUES
  ('TW-GEN-001', 'Nombre Producto 1', 'Descripción...', 'general', 1500.00, NULL, 'TI Water General.pdf', 1, true),
  ('TW-GEN-002', 'Nombre Producto 2', 'Descripción...', 'general', 2000.00, NULL, 'TI Water General.pdf', 1, true);
  -- Agregar más productos...
```

### Paso 3: Ejecutar SQL

```bash
export PGPASSWORD=TIW4terMa1nS3rv3r
/usr/pgsql-15/bin/psql -h localhost -U TIWater_user -d ti_water -f scripts/migrations/007_import_tiwater_products_template.sql
```

## 📊 Estructura de Datos

### Campos Requeridos:
- `code`: Código único (ej: "TW-GEN-001")
- `name`: Nombre del producto
- `category`: Una de: `general`, `presurizadores`, `valvulas_sistemas`, `sumergibles`, `plomeria`

### Campos Opcionales:
- `description`: Descripción detallada
- `price`: Precio (puede ser NULL)
- `specifications`: JSON con especificaciones técnicas
- `images`: JSON array con URLs de imágenes
- `catalog_source`: Nombre del PDF
- `page_number`: Número de página
- `is_active`: true/false (default: true)

## 📝 Ejemplo Completo

```sql
INSERT INTO tiwater_products (
  code, 
  name, 
  description, 
  category, 
  price, 
  specifications,
  catalog_source, 
  page_number, 
  is_active
)
VALUES
  (
    'TW-PRES-001',
    'Bomba Presurizadora Modelo 2024',
    'Sistema de presurización de agua para uso residencial con capacidad de 1500 litros por hora',
    'presurizadores',
    3500.00,
    '{"capacidad": "1500 L/h", "potencia": "0.75 HP", "material": "Acero inoxidable"}'::jsonb,
    'TI Water PRESURIZADORES.pdf',
    5,
    true
  );
```

## 🔄 Actualizar Productos Existentes

El SQL usa `ON CONFLICT DO UPDATE` para evitar duplicados:

```sql
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  specifications = EXCLUDED.specifications,
  catalog_source = EXCLUDED.catalog_source,
  page_number = EXCLUDED.page_number,
  updated_at = CURRENT_TIMESTAMP;
```

Esto significa que si ejecutas el mismo SQL dos veces, actualizará los productos existentes en lugar de crear duplicados.

## 📚 Mapeo de Catálogos a Categorías

| Catálogo PDF | Categoría |
|-------------|-----------|
| TI Water General.pdf | `general` |
| TI Water PRESURIZADORES.pdf | `presurizadores` |
| TI Water valvulas y sistemas.pdf | `valvulas_sistemas` |
| TI WATER EQUIPOS Y ACCESORIOS SUMERGIBLES.pdf | `sumergibles` |
| TI Water Plomeria.pdf | `plomeria` |

## 🚀 Proceso Recomendado

### Opción 1: Importación por Lotes (Recomendado)

1. **Producto por producto**: Abre cada PDF, extrae 5-10 productos, crea SQL, ejecuta
2. **Verifica**: `SELECT * FROM tiwater_products;`
3. **Repite**: Continúa con más productos

### Opción 2: Importación Completa

1. **Extrae todos los productos** de un catálogo
2. **Crea un archivo SQL** por catálogo
3. **Ejecuta cada archivo** por separado

### Opción 3: Usar API (Futuro)

Una vez que tengas algunos productos, puedes usar la API para agregar más:

```bash
curl -X POST http://localhost:3009/api/v2.0/tiwater/products \
  -H "X-TIWater-API-Key: tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TW-GEN-001",
    "name": "Producto",
    "description": "Descripción",
    "category": "general",
    "price": 1000.00,
    "catalogSource": "TI Water General.pdf"
  }'
```

## ✅ Verificación

Después de importar, verifica:

```sql
-- Ver todos los productos
SELECT code, name, category, price FROM tiwater_products ORDER BY category, code;

-- Contar por categoría
SELECT category, COUNT(*) as total 
FROM tiwater_products 
GROUP BY category;

-- Productos sin precio
SELECT code, name, category 
FROM tiwater_products 
WHERE price IS NULL;
```

## 🔧 Herramientas Útiles

### Ver estructura de tabla:
```sql
\d tiwater_products
```

### Limpiar productos de prueba:
```sql
DELETE FROM tiwater_products WHERE code LIKE 'TW-GEN-%';
```

### Exportar productos a CSV:
```bash
/usr/pgsql-15/bin/psql -h localhost -U TIWater_user -d ti_water -c "
  COPY (SELECT * FROM tiwater_products) 
  TO STDOUT WITH CSV HEADER
" > products_export.csv
```

## 📝 Notas Importantes

1. **Códigos únicos**: Cada producto debe tener un `code` único
2. **Precios**: Si no hay precio en el PDF, usa `NULL`
3. **Especificaciones**: Usa formato JSON: `'{"key": "value"}'::jsonb`
4. **Categorías**: Debe coincidir exactamente con las categorías válidas
5. **Scripts**: Los scripts son helpers, no extraen automáticamente de PDFs

## 🎯 Próximos Pasos

1. Comienza con `006_import_tiwater_products_sample.sql` para ver el formato
2. Extrae 5-10 productos manualmente de un PDF
3. Crea tu propio archivo SQL con esos productos
4. Ejecuta y verifica
5. Continúa con más productos gradualmente

---

**¿Necesitas ayuda?** Revisa los archivos de ejemplo para ver el formato correcto.
