# 🔍 Diagnóstico de PM2 Kill

## ⚠️ ¿Qué significa "pm2 has been killed by signal"?

Cuando ves este mensaje, significa que **PM2 fue terminado por una señal del sistema operativo**, no por un error interno. Esto puede indicar problemas serios del servidor.

## 🔴 Posibles Causas

### 1. **OOM Killer (Out of Memory)** - MÁS COMÚN
- El sistema se quedó sin memoria
- Linux mató procesos para liberar memoria
- **Síntomas**: El servidor se queda sin RAM disponible

### 2. **Reinicio del Sistema**
- El servidor se reinició (actualizaciones, fallos de hardware)
- **Síntomas**: Logs muestran reinicio del sistema

### 3. **Señal Manual (SIGTERM/SIGKILL)**
- Alguien ejecutó `kill` o `pkill` manualmente
- **Síntomas**: Comando ejecutado antes del kill

### 4. **Problemas de Recursos**
- CPU al 100% por mucho tiempo
- Disco lleno
- **Síntomas**: Recursos agotados

### 5. **Systemd o Supervisor**
- Un servicio de sistema mató PM2
- **Síntomas**: Logs de systemd muestran la acción

## 🚀 Uso del Script de Diagnóstico

```bash
# Ejecutar diagnóstico completo
npm run diagnose:pm2

# O directamente
sudo bash scripts/diagnose_pm2_kill.sh
```

## 🔧 Script de Corrección Automática

Si el diagnóstico detecta problemas, puedes usar el script de corrección automática:

```bash
# Ejecutar corrección automática
npm run fix:pm2

# O directamente
sudo bash scripts/fix_pm2_issues.sh
```

Este script soluciona automáticamente:
- ✅ Problemas de permisos SELinux
- ✅ Crea y configura swap (2GB)
- ✅ Optimiza límites de memoria en PM2 según RAM disponible
- ✅ Verifica y corrige servicio MongoDB
- ✅ Reinicia PM2 con nueva configuración

## 📊 Qué Revisa el Script

1. **OOM Killer**: Busca en `dmesg` si hay procesos matados por falta de memoria
2. **Recursos**: Muestra uso actual de memoria, CPU y disco
3. **Logs del Sistema**: Revisa `journalctl` para errores recientes
4. **Señales**: Verifica procesos PM2/Node.js activos
5. **Logs de PM2**: Busca referencias a kills en logs de PM2
6. **Systemd**: Verifica servicios relacionados
7. **Cron**: Revisa tareas programadas que puedan afectar PM2
8. **Límites**: Muestra límites de recursos del sistema
9. **Zombies**: Detecta procesos zombie

## 🚨 Problemas Comunes Detectados

### 1. OOM Killer Activo + Memoria Baja + Sin Swap

**Síntomas:**
- `❌ ⚠️  OOM KILLER ACTIVO` en diagnóstico
- Memoria disponible < 500MB
- Swap: 0B (sin swap configurado)
- `max_memory_restart: '1G'` en sistemas con < 2GB RAM

**Solución Rápida:**
```bash
# Ejecutar script de corrección automática
npm run fix:pm2
```

**Solución Manual:**
1. Crear swap (ver sección "Si es OOM Killer")
2. Reducir `max_memory_restart` en `ecosystem.config.js` a 400M
3. Reiniciar PM2: `pm2 restart all`

### 2. Problemas de SELinux

**Síntomas:**
- `SELinux is preventing systemd from read access on the file pm2.pid`
- `Permission denied` en logs de systemd
- PM2 no puede iniciar vía systemd

**Solución:**
```bash
# Opción 1: Ejecutar script de corrección
npm run fix:pm2

# Opción 2: Manual
sudo restorecon -R /root/.pm2
sudo chmod 755 /root/.pm2
sudo chmod 644 /root/.pm2/*.pid
```

### 3. MongoDB Service Failed

**Síntomas:**
- `● mongod.service loaded failed failed MongoDB Database Server`
- MongoDB corriendo como proceso pero no como servicio

**Solución:**
```bash
# Opción 1: Usar script de recovery
npm run recover:services

# Opción 2: Manual
sudo systemctl reset-failed mongod.service
sudo systemctl start mongod.service
```

### 4. Error: "require() of ES Module not supported" en PM2

**Síntomas:**
- `Error [ERR_REQUIRE_ESM]: require() of ES Module ecosystem.config.js not supported`
- PM2 no puede cargar `ecosystem.config.js`
- El archivo usa `export default` en lugar de `module.exports`

**Solución:**
```bash
# Opción 1: El script de fix lo convierte automáticamente
npm run fix:pm2

# Opción 2: Manual - convertir export default a module.exports
sed -i 's/export default/module.exports =/' ecosystem.config.js
pm2 start ecosystem.config.js
```

**Nota:** PM2 requiere CommonJS (`module.exports`), no ES Modules (`export default`) en archivos de configuración.

## 🔧 Soluciones Comunes

### Si es OOM Killer:

```bash
# 1. Verificar memoria disponible
free -h

# 2. Ver qué proceso consume más memoria
ps aux --sort=-%mem | head -20

# 3. Aumentar swap (si no existe)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 4. Reducir max_memory_restart en ecosystem.config.js
# Cambiar de 1G a 500M por ejemplo
```

### Si es Reinicio del Sistema:

```bash
# Ver cuándo se reinició
last reboot

# Ver logs de reinicio
journalctl -b -1  # Logs del boot anterior
```

### Si es Recursos Agotados:

```bash
# Ver uso de disco
df -h

# Limpiar logs antiguos
sudo journalctl --vacuum-time=7d

# Limpiar logs de PM2
pm2 flush
```

## 🛡️ Prevención

### 1. Monitoreo Continuo

```bash
# Instalar monitoreo de memoria
sudo yum install htop -y

# Monitorear en tiempo real
watch -n 1 free -h
```

### 2. Configurar Alertas

```bash
# Crear script de alerta (ejemplo)
cat > /usr/local/bin/check_memory.sh << 'EOF'
#!/bin/bash
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ $MEM_USAGE -gt 90 ]; then
    echo "ALERTA: Memoria al ${MEM_USAGE}%"
    # Enviar email o notificación
fi
EOF
chmod +x /usr/local/bin/check_memory.sh

# Agregar a cron cada 5 minutos
*/5 * * * * /usr/local/bin/check_memory.sh
```

### 3. Optimizar ecosystem.config.js

```javascript
{
  max_memory_restart: '500M',  // Reducir si hay problemas de memoria
  max_restarts: 10,
  min_uptime: '10s',
  // Agregar monitoreo
  pmx: true,
  // Agregar auto-restart más agresivo
  restart_delay: 4000,
}
```

### 4. Configurar Swap

```bash
# Verificar swap actual
swapon --show

# Si no hay swap, crear uno
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Hacer permanente
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 📝 Logs Importantes

```bash
# Logs del sistema (últimas 2 horas)
journalctl --since "2 hours ago" | grep -i "pm2\|killed\|oom"

# Logs de OOM Killer
dmesg | grep -i "oom\|killed process"

# Logs de PM2
pm2 logs

# Logs específicos de la app
tail -f logs/api-error.log
tail -f logs/mqtt-consumer-error.log
```

## 🆘 Comandos de Emergencia

```bash
# Si PM2 fue matado, reiniciar todo
npm run recover:services

# Reiniciar solo PM2
pm2 kill
pm2 resurrect
# O
cd /ruta/a/Aquatech_api
pm2 start ecosystem.config.js

# Ver estado completo
pm2 status
pm2 logs
pm2 monit
```

## 📞 Cuándo Preocuparse

- ✅ **Normal**: PM2 se reinicia ocasionalmente (1-2 veces al día)
- ⚠️ **Atención**: PM2 se reinicia frecuentemente (más de 5 veces al día)
- 🔴 **Crítico**: PM2 es matado constantemente o el servidor se reinicia

## 🔗 Recursos Adicionales

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/process-management/)
- [Linux OOM Killer](https://www.kernel.org/doc/gorman/html/understand/understand016.html)
- [Systemd Journal](https://www.freedesktop.org/software/systemd/man/journalctl.html)
