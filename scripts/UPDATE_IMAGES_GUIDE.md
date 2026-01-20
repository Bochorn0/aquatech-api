# 🖼️ Guía para Actualizar Imágenes de Productos

## ✅ Script Creado

Se creó un script Node.js (`scripts/update-product-images.js`) que automáticamente mapea las imágenes extraídas de los PDFs a los productos en la base de datos.

## 📋 Cómo Funciona

El script:
1. **Lee todas las imágenes** del directorio `TI_water/public/assets/product-images/`
2. **Obtiene todos los productos** de la base de datos que tienen `catalog_source` y `page_number`
3. **Mapea las imágenes** a los productos basándose en:
   - `catalog_source` (nombre del PDF) → patrón del nombre de imagen
   - `page_number` → número de página en el archivo de imagen
4. **Actualiza la columna `images`** en la base de datos con la URL correcta

## 🎯 Formato de Nombres de Imágenes

Las imágenes extraídas tienen el formato:
```
CATALOG_NAME-PAGE_NUMBER.png
```

Ejemplos:
- `TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-001.png` (página 1)
- `TI_Water_General-005.png` (página 5)
- `TI_Water_PRESURIZADORES-010.png` (página 10)

El script convierte automáticamente:
- `catalog_source`: `"TI Water General.pdf"` → `"TI_WATER_GENERAL"`
- `page_number`: `5` → `"005"`
- Resultado: busca `TI_WATER_GENERAL-005.png`

## 🚀 Ejecución

### En el Servidor (Recomendado)

```bash
# 1. Asegúrate de que las imágenes están en el servidor
#    TI_water/public/assets/product-images/

# 2. Ejecuta el script
cd Aquatech_api
npm run update:product:images
```

### Localmente (Para Testing)

Si tienes PostgreSQL configurado localmente, solo necesitas:

```bash
cd Aquatech_api
npm run update:product:images
```

## 📊 Resultado Esperado

Después de ejecutar el script, verás:

```
🖼️  Updating Product Images in Database
========================================

📁 Found 686 image file(s) in /path/to/product-images

📦 Found X product(s) with catalog_source and page_number

🔄 Updating X product(s)...

   ✓ Updated TW-GEN-001 → /assets/product-images/TI_WATER_GENERAL-001.png
   ✓ Updated TW-GEN-002 → /assets/product-images/TI_WATER_GENERAL-001.png
   ...

✅ Update complete!
   Updated: X product(s)
   Images not found: Y product(s)
   Total products checked: Z
```

## ⚠️ Requisitos

1. **Imágenes extraídas**: Debes haber ejecutado `npm run extract:pdf:images` primero
2. **Productos importados**: Los productos deben estar en la base de datos con `catalog_source` y `page_number` correctos
3. **Conexión a base de datos**: El script necesita acceso a PostgreSQL con las credenciales correctas en `.env`

## 🔍 Verificación

Para verificar que las imágenes se actualizaron correctamente:

```sql
-- Ver productos con imágenes
SELECT 
  code,
  name,
  catalog_source,
  page_number,
  images
FROM tiwater_products
WHERE images IS NOT NULL 
  AND images != '[]'::jsonb
ORDER BY catalog_source, page_number
LIMIT 10;
```

## 🐛 Troubleshooting

### Error: "role does not exist"
- El usuario de PostgreSQL no existe o las credenciales son incorrectas
- Verifica tu archivo `.env` con las credenciales correctas

### Error: "Images not found"
- Verifica que `catalog_source` en la base de datos coincida exactamente con el nombre del PDF
- Verifica que `page_number` sea correcto (empieza en 1, no en 0)
- Verifica que las imágenes estén en el directorio correcto

### Imágenes no se muestran en el frontend
- Verifica que las imágenes estén en `TI_water/public/assets/product-images/` (para Vite)
- Verifica que el servidor esté sirviendo archivos estáticos desde `/public`
- Verifica que la URL en la base de datos empiece con `/assets/product-images/`

## 📝 Notas

- El script solo actualiza productos que tienen `catalog_source` y `page_number`
- Si una imagen no se encuentra, el producto no se actualiza (mantiene su estado actual)
- El script evita actualizaciones innecesarias (no actualiza si la imagen ya está asignada)

---

**Listo para ejecutar en el servidor!** 🚀
