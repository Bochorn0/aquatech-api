# 🖼️ Extraer Imágenes Localmente y Subir al Servidor

## ✅ Sí, puedes ejecutarlo localmente!

Puedes extraer las imágenes en tu máquina local y luego subirlas al servidor. Esto es más rápido y no requiere acceso al servidor para la extracción.

## 📋 Proceso Recomendado

### **Paso 1: Instalar poppler localmente (solo una vez)**

```bash
# macOS
brew install poppler

# Linux (Ubuntu/Debian)
sudo apt-get install poppler-utils

# Windows
# Descargar desde: https://github.com/oschwartz10612/poppler-windows
```

### **Paso 2: Instalar dependencia npm**

```bash
cd Aquatech_api
npm install pdf-poppler
```

### **Paso 3: Extraer imágenes localmente**

```bash
npm run extract:pdf:images
```

Esto generará todas las páginas de los PDFs como imágenes PNG en:
```
TI_water/public/assets/product-images/
```

Ejemplo de archivos generados:
```
TI_water/public/assets/product-images/
  ├── TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-1.png
  ├── TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-2.png
  ├── TI_WATER_EQUIPOS_Y_ACCESORIOS_SUMERGIBLES-3.png
  ├── TI_Water_General-1.png
  ├── TI_Water_General-2.png
  └── ...
```

### **Paso 4: Subir imágenes al servidor**

Sube la carpeta completa al servidor:

```bash
# Opción 1: SCP (desde tu máquina local)
scp -r TI_water/public/assets/product-images/ user@server:/path/to/TI_water/public/assets/

# Opción 2: SFTP
# Conecta con FileZilla o similar y sube la carpeta

# Opción 3: Git (si tienes el repo)
# Agrega las imágenes al repo y haz push
# Nota: Las imágenes pueden ser grandes, considera Git LFS
```

### **Paso 5: Actualizar base de datos en el servidor**

Una vez que las imágenes estén en el servidor, conecta al servidor y ejecuta:

```bash
# En el servidor
cd Aquatech_api
npm run update:product:images
```

Esto actualizará automáticamente la columna `images` en la tabla `tiwater_products` con las URLs correctas.

## 🔄 Workflow Completo

```
┌─────────────────────────────────────────────────────────────┐
│ LOCAL (Tu máquina)                                          │
│                                                             │
│ 1. npm run extract:pdf:images                               │
│    ↓                                                        │
│ 2. Genera imágenes en:                                      │
│    TI_water/public/assets/product-images/                   │
│    ↓                                                        │
│ 3. Sube carpeta al servidor (SCP/SFTP/Git)                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ SERVER                                                      │
│                                                             │
│ 4. npm run update:product:images                            │
│    ↓                                                        │
│ 5. Actualiza URLs en base de datos                          │
│    ↓                                                        │
│ 6. ✅ Imágenes disponibles en frontend                      │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Tamaño de Archivos

Las imágenes PNG pueden ser grandes (1-3 MB cada una). Considera:

- **Comprimir antes de subir:** Usa herramientas como `tinypng` o `jpegoptim`
- **Usar Git LFS:** Si vas a versionar las imágenes en Git
- **Subir por FTP/SCP directamente:** Más rápido para muchos archivos

## ⚠️ Importante

1. **Las imágenes se generan automáticamente:** El script extrae TODAS las páginas de TODOS los PDFs
2. **No requiere base de datos:** Puedes ejecutarlo sin conexión a la BD
3. **El mapeo es automático:** El script SQL en el servidor mapea automáticamente basándose en `catalog_source` y `page_number`

## 🎯 Comandos Rápidos

```bash
# LOCAL
cd Aquatech_api
npm run extract:pdf:images

# Subir (ejemplo con SCP)
scp -r TI_water/public/assets/product-images/ user@164.92.95.176:/ruta/a/TI_water/public/assets/

# SERVER (después de subir)
cd Aquatech_api
npm run update:product:images
```

## ✅ Ventajas de Ejecutarlo Localmente

- ✅ Más rápido (no depende de conexión al servidor)
- ✅ Puedes verificar las imágenes antes de subirlas
- ✅ No consume recursos del servidor
- ✅ Puedes procesar offline

---

**¿Listo?** Ejecuta `npm run extract:pdf:images` localmente y luego sube las imágenes al servidor.
