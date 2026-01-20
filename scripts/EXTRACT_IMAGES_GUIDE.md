# Guía para Extraer Imágenes de PDFs

## 📋 Resumen

Esta guía explica cómo extraer imágenes de los catálogos PDF y asociarlas con los productos en la base de datos.

## 🎯 Opciones Disponibles

### Opción 1: pdf-poppler (Recomendado - Más Simple)

**Ventajas:**
- ✅ Más simple de usar
- ✅ Extrae páginas completas como imágenes
- ✅ Buena calidad

**Desventajas:**
- ❌ Requiere instalar `poppler-utils` como dependencia del sistema

**Instalación:**

1. **Instalar poppler-utils:**
   ```bash
   # macOS
   brew install poppler

   # Linux (Ubuntu/Debian)
   sudo apt-get install poppler-utils

   # Linux (CentOS/RHEL)
   sudo yum install poppler-utils

   # Windows
   # Descargar desde: https://github.com/oschwartz10612/poppler-windows
   ```

2. **Instalar paquete npm:**
   ```bash
   cd Aquatech_api
   npm install pdf-poppler
   ```

3. **Usar el script:**
   ```bash
   node scripts/extract-pdf-images-simple.js
   ```

### Opción 2: pdfjs-dist (Más Complejo - Extrae imágenes individuales)

**Ventajas:**
- ✅ Extrae imágenes individuales (no páginas completas)
- ✅ No requiere dependencias del sistema
- ✅ Solo paquetes npm

**Desventajas:**
- ❌ Más complejo de implementar
- ❌ Puede no extraer todas las imágenes correctamente

**Instalación:**

```bash
cd Aquatech_api
npm install pdfjs-dist canvas
```

**Usar el script:**
```bash
node scripts/extract-images-from-pdf.js
```

## 📝 Proceso Recomendado

### Paso 1: Extraer imágenes de todas las páginas

Usando `pdf-poppler`, extrae todas las páginas de los PDFs como imágenes PNG:

```bash
node scripts/extract-pdf-images-simple.js
```

Esto generará imágenes como:
- `TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-1.png` (página 1)
- `TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-2.png` (página 2)
- etc.

### Paso 2: Asociar imágenes con productos

Las imágenes se mapean a productos basándose en el `pageNumber` del producto:

- Producto con `pageNumber: 5` → Usa `...-5.png`
- Producto con `pageNumber: 8` → Usa `...-8.png`

### Paso 3: Actualizar base de datos

Actualiza la columna `images` en la tabla `tiwater_products`:

```sql
UPDATE tiwater_products 
SET images = '["/assets/product-images/TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-5.png"]'::jsonb
WHERE code = 'TW-SUM-001' AND page_number = 5;
```

## 🔧 Script de Actualización Automática

Puedes crear un script SQL que actualice automáticamente todas las imágenes:

```sql
-- Update images based on catalog_source and page_number
UPDATE tiwater_products
SET images = jsonb_build_array(
  '/assets/product-images/' || 
  REPLACE(REPLACE(REPLACE(catalog_source, '.pdf', ''), ' ', '_'), '-', '_') || 
  '-' || page_number::text || '.png'
)::jsonb
WHERE page_number IS NOT NULL 
  AND catalog_source IS NOT NULL;
```

## 📁 Estructura de Archivos

```
TI_water/
  public/
    assets/
      product-images/          # Imágenes extraídas de PDFs
        TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-1.png
        TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-2.png
        ...
```

## 🎨 Uso en Frontend

Las imágenes estarán disponibles en:

```typescript
// En el frontend
const imageUrl = `/assets/product-images/${product.catalogSource}-${product.pageNumber}.png`;

// O desde la base de datos
const imageUrl = product.images?.[0]; // Ya viene con la URL completa
```

## ⚠️ Consideraciones

1. **Tamaño de archivos:** Las imágenes PNG pueden ser grandes. Considera:
   - Comprimir imágenes después de extraer
   - Usar formato WebP
   - Optimizar imágenes para web

2. **Nombres de archivos:** Los PDFs tienen nombres con espacios y caracteres especiales. El script los sanitiza automáticamente.

3. **Páginas múltiples:** Si un producto tiene imágenes en múltiples páginas, puedes actualizar el array `images` en la base de datos.

4. **Extracción automática:** El script puede actualizar automáticamente la base de datos si configuras la conexión.

## 🚀 Comando Rápido

```bash
# 1. Instalar poppler (una vez)
brew install poppler  # macOS

# 2. Instalar npm package
cd Aquatech_api && npm install pdf-poppler

# 3. Extraer imágenes
node scripts/extract-pdf-images-simple.js

# 4. Actualizar base de datos (SQL)
# Ver script SQL arriba
```

## 📊 Resultado Esperado

Después de ejecutar el script, deberías tener:

- ✅ Imágenes PNG en `TI_water/public/assets/product-images/`
- ✅ URLs actualizadas en la columna `images` de `tiwater_products`
- ✅ Productos mostrando imágenes en el frontend

---

**¿Necesitas ayuda?** Revisa los logs del script para ver qué productos fueron mapeados correctamente.
