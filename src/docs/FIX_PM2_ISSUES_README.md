# 🔧 Script de Corrección de Problemas PM2

## 📋 Resumen

Este script (`fix_pm2_issues.sh`) soluciona automáticamente los problemas más comunes detectados por el diagnóstico de PM2, especialmente relacionados con:

- **OOM Killer activo** (Out of Memory)
- **Problemas de permisos SELinux**
- **Falta de swap**
- **Límites de memoria mal configurados**
- **Servicios de base de datos**

## 🚀 Uso

```bash
# Opción 1: Usando npm
npm run fix:pm2

# Opción 2: Directamente
sudo bash scripts/fix_pm2_issues.sh
```

## 🔍 Qué Hace el Script

### 1. **Corrige Problemas de SELinux**
- Detecta si SELinux está en modo Enforcing
- Intenta crear política SELinux para PM2
- Restaura contexto SELinux en `/root/.pm2`
- Ajusta permisos de archivos PM2

### 2. **Configura Swap**
- Verifica si existe swap
- Crea archivo de swap de 2GB (o 1GB si hay poco espacio)
- Activa el swap
- Lo agrega a `/etc/fstab` para persistencia

### 3. **Optimiza Límites de Memoria PM2**
- Detecta memoria total del sistema
- Ajusta `max_memory_restart` en `ecosystem.config.js`:
  - **< 2GB RAM**: 400M para API, 200M para MQTT
  - **2-4GB RAM**: 600M para API, 300M para MQTT
  - **> 4GB RAM**: 800M para API, 400M para MQTT
- Crea backup del archivo antes de modificar
- **Convierte automáticamente ES Modules a CommonJS** si es necesario (PM2 requiere `module.exports`, no `export default`)

### 4. **Verifica MongoDB y PostgreSQL**
- ✅ **Solo verifica estado** (no intenta iniciarlos)
- Detecta si están corriendo como procesos
- Si no están corriendo, sugiere usar `npm run recover:services`
- Respeta la configuración específica de estos servicios

### 5. **Reinicia PM2**
- Guarda estado actual de PM2
- Recarga configuración desde `ecosystem.config.js`
- Muestra estado final

## ⚠️ Importante

### MongoDB y PostgreSQL

**El script NO intenta iniciar MongoDB o PostgreSQL directamente.** Estos servicios tienen configuración específica y deben iniciarse usando:

```bash
npm run recover:services
```

O directamente:

```bash
sudo bash scripts/services_recover.sh
```

El script de fix solo **verifica** si están corriendo y te informa del estado.

## 📊 Salida del Script

El script muestra:
- Estado de cada corrección aplicada
- Estado actual de memoria (total, disponible, swap)
- Estado de MongoDB y PostgreSQL
- Estado de PM2 después del reinicio
- Recomendaciones para próximos pasos

## 🔄 Flujo de Trabajo Recomendado

1. **Ejecutar diagnóstico:**
   ```bash
   npm run diagnose:pm2
   ```

2. **Si hay problemas, ejecutar corrección:**
   ```bash
   npm run fix:pm2
   ```

3. **Si MongoDB/PostgreSQL no están corriendo:**
   ```bash
   npm run recover:services
   ```

4. **Verificar que todo esté funcionando:**
   ```bash
   pm2 status
   pm2 monit
   ```

5. **Monitorear memoria:**
   ```bash
   watch -n 1 free -h
   ```

## 🛡️ Seguridad

- El script requiere ejecutarse como `root` (usa `sudo`)
- Crea backups antes de modificar archivos
- No modifica configuraciones críticas sin verificación
- Respeta la configuración específica de servicios

## 📝 Archivos Modificados

- `ecosystem.config.js` - Límites de memoria optimizados
- `/swapfile` - Archivo de swap creado
- `/etc/fstab` - Swap agregado para persistencia
- `/root/.pm2/` - Permisos y contexto SELinux ajustados

## 🔗 Scripts Relacionados

- `diagnose_pm2_kill.sh` - Diagnóstico de problemas PM2
- `services_recover.sh` - Recuperación de MongoDB y PostgreSQL
- `PM2_KILL_DIAGNOSIS.md` - Documentación completa del diagnóstico

## ❓ Preguntas Frecuentes

**P: ¿El script es seguro ejecutarlo en producción?**  
R: Sí, el script es conservador y solo modifica lo necesario. Crea backups antes de cambios importantes.

**P: ¿Qué pasa si MongoDB/PostgreSQL no están corriendo?**  
R: El script te informará y sugerirá usar `npm run recover:services` para iniciarlos correctamente.

**P: ¿Puedo ejecutar el script múltiples veces?**  
R: Sí, es idempotente. Si el swap ya existe, no lo recrea. Si los límites ya están optimizados, los ajusta según la memoria disponible.

**P: ¿El script afecta otros servicios?**  
R: No, solo modifica configuración de PM2, crea swap, y verifica estado de bases de datos.

**P: ¿Qué pasa si ecosystem.config.js usa ES Modules?**  
R: El script detecta automáticamente si usa `export default` y lo convierte a `module.exports` (CommonJS) que es lo que PM2 requiere. Crea un backup antes de convertir.
