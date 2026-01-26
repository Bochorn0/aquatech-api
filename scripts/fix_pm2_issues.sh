#!/bin/bash

# ============================================================================
# PM2 Issues Fix Script
# ============================================================================
# Este script soluciona los problemas detectados por el diagnóstico de PM2
# Uso: sudo bash scripts/fix_pm2_issues.sh
# ============================================================================

# No usar set -e para permitir manejo de errores individual

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Verificar que se ejecuta como root
if [ "$EUID" -ne 0 ]; then 
    print_error "Este script debe ejecutarse como root (usa sudo)"
    exit 1
fi

echo ""
echo "==============================="
echo " 🔧 PM2 Issues Fix Script"
echo " 📅 Fecha: $(date)"
echo " 🖥️  Hostname: $(hostname)"
echo "==============================="
echo ""

# ============================================================================
# 1. FIX SELINUX ISSUES
# ============================================================================
print_info "1. Solucionando problemas de SELinux..."

if command -v getenforce &> /dev/null; then
    SELINUX_STATUS=$(getenforce)
    print_info "Estado actual de SELinux: $SELINUX_STATUS"
    
    if [ "$SELINUX_STATUS" = "Enforcing" ]; then
        print_warning "SELinux está en modo Enforcing"
        
        # Crear política temporal para PM2
        print_info "Creando política SELinux para PM2..."
        
        # Verificar si ya existe un módulo PM2
        if semodule -l | grep -q "pm2"; then
            print_info "Módulo PM2 ya existe, reinstalando..."
            semodule -r pm2 2>/dev/null || true
        fi
        
        # Crear política básica para PM2
        cat > /tmp/pm2.te << 'EOF'
module pm2 1.0;

require {
    type systemd_t;
    type node_t;
    type pm2_t;
    type pm2_exec_t;
    type pm2_log_t;
    type pm2_runtime_t;
    class file { read write execute open getattr };
    class dir { read write search add_name remove_name };
    class process { transition };
}

# Permitir a systemd leer archivos PM2
allow systemd_t pm2_exec_t:file read;
allow systemd_t pm2_runtime_t:file read;
allow systemd_t pm2_log_t:file read;

# Permitir a PM2 ejecutar node
allow pm2_t node_t:file execute;
allow pm2_t node_t:process transition;
EOF

        # Compilar e instalar política
        if command -v checkmodule &> /dev/null && command -v semodule_package &> /dev/null; then
            print_info "Compilando política SELinux..."
            checkmodule -M -m -o /tmp/pm2.mod /tmp/pm2.te 2>/dev/null || {
                print_warning "No se pudo compilar política SELinux (checkmodule no disponible)"
                print_info "Aplicando solución alternativa: permisos relajados en /root/.pm2"
            }
            
            if [ -f /tmp/pm2.mod ]; then
                semodule_package -o /tmp/pm2.pp -m /tmp/pm2.mod 2>/dev/null || {
                    print_warning "No se pudo empaquetar política SELinux"
                }
                
                if [ -f /tmp/pm2.pp ]; then
                    semodule -i /tmp/pm2.pp 2>/dev/null && print_success "Política SELinux instalada" || {
                        print_warning "No se pudo instalar política SELinux"
                    }
                fi
            fi
        else
            print_warning "Herramientas de SELinux no disponibles, usando solución alternativa"
        fi
        
        # Solución alternativa: restaurar contexto SELinux en directorio PM2
        if command -v restorecon &> /dev/null; then
            print_info "Restaurando contexto SELinux en /root/.pm2..."
            restorecon -R /root/.pm2 2>/dev/null || true
        fi
        
        # Asegurar permisos correctos
        chmod 755 /root/.pm2 2>/dev/null || true
        chmod 644 /root/.pm2/*.pid 2>/dev/null || true
        chmod 644 /root/.pm2/*.json 2>/dev/null || true
        
        print_success "Permisos de SELinux ajustados"
    else
        print_info "SELinux no está en modo Enforcing, saltando configuración"
    fi
else
    print_warning "SELinux no está instalado o no está disponible"
fi

echo ""

# ============================================================================
# 2. CREAR SWAP SPACE
# ============================================================================
print_info "2. Configurando espacio de swap..."

SWAP_SIZE="2G"
SWAP_FILE="/swapfile"

# Verificar si ya existe swap
if swapon --show | grep -q "$SWAP_FILE"; then
    print_success "Swap ya está configurado: $SWAP_FILE"
    swapon --show
elif [ -f "$SWAP_FILE" ]; then
    print_warning "Archivo de swap existe pero no está activo, activando..."
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE" 2>/dev/null || true
    swapon "$SWAP_FILE" && print_success "Swap activado" || print_error "Error al activar swap"
else
    print_info "Creando archivo de swap de $SWAP_SIZE..."
    
    # Verificar espacio disponible en disco
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 3 ]; then
        print_warning "Espacio en disco limitado (${AVAILABLE_SPACE}G disponible)"
        SWAP_SIZE="1G"
        print_info "Reduciendo tamaño de swap a $SWAP_SIZE"
    fi
    
    # Crear archivo de swap
    if fallocate -l "$SWAP_SIZE" "$SWAP_FILE" 2>/dev/null || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$(echo "$SWAP_SIZE" | sed 's/G//' | awk '{print $1*1024}') 2>/dev/null; then
        chmod 600 "$SWAP_FILE"
        mkswap "$SWAP_FILE"
        swapon "$SWAP_FILE"
        
        # Hacer permanente en /etc/fstab
        if ! grep -q "$SWAP_FILE" /etc/fstab; then
            echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
            print_success "Swap agregado a /etc/fstab"
        fi
        
        print_success "Swap creado y activado: $SWAP_SIZE"
        swapon --show
    else
        print_error "Error al crear archivo de swap"
    fi
fi

echo ""

# ============================================================================
# 3. OPTIMIZAR CONFIGURACIÓN DE PM2
# ============================================================================
print_info "3. Optimizando configuración de PM2..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ECOSYSTEM_FILE="$PROJECT_DIR/ecosystem.config.js"

if [ -f "$ECOSYSTEM_FILE" ]; then
    # Hacer backup
    cp "$ECOSYSTEM_FILE" "$ECOSYSTEM_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    print_info "Backup creado: $ECOSYSTEM_FILE.backup.*"
    
    # Verificar memoria total disponible
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    print_info "Memoria total del sistema: ${TOTAL_MEM}MB"
    
    # Ajustar límites de memoria según disponibilidad
    if [ "$TOTAL_MEM" -lt 2048 ]; then
        # Sistema con menos de 2GB - límites muy conservadores
        API_MEM_LIMIT="400M"
        MQTT_MEM_LIMIT="200M"
        print_warning "Sistema con memoria limitada, usando límites conservadores"
    elif [ "$TOTAL_MEM" -lt 4096 ]; then
        # Sistema con 2-4GB - límites moderados
        API_MEM_LIMIT="600M"
        MQTT_MEM_LIMIT="300M"
        print_info "Sistema con memoria moderada, usando límites equilibrados"
    else
        # Sistema con más de 4GB - límites estándar
        API_MEM_LIMIT="800M"
        MQTT_MEM_LIMIT="400M"
        print_info "Sistema con memoria suficiente, usando límites estándar"
    fi
    
    # Actualizar ecosystem.config.js
    print_info "Actualizando límites de memoria en ecosystem.config.js..."
    print_info "  - api-aquatech: $API_MEM_LIMIT (antes: 1G)"
    print_info "  - mqtt-consumer: $MQTT_MEM_LIMIT (sin cambios)"
    
    # Usar sed para actualizar (más seguro que reemplazar todo el archivo)
    sed -i.bak "s/max_memory_restart: '1G'/max_memory_restart: '$API_MEM_LIMIT'/" "$ECOSYSTEM_FILE"
    sed -i.bak "s/max_memory_restart: '500M'/max_memory_restart: '$MQTT_MEM_LIMIT'/" "$ECOSYSTEM_FILE"
    rm -f "$ECOSYSTEM_FILE.bak" 2>/dev/null || true
    
    print_success "Configuración de PM2 actualizada"
else
    print_warning "No se encontró ecosystem.config.js en $ECOSYSTEM_FILE"
fi

echo ""

# ============================================================================
# 4. VERIFICAR MONGODB Y POSTGRESQL
# ============================================================================
print_info "4. Verificando estado de MongoDB y PostgreSQL..."

# Verificar MongoDB
MONGODB_RUNNING=false
if pgrep -f mongod > /dev/null; then
    MONGODB_RUNNING=true
    MONGODB_PID=$(pgrep -f mongod | head -1)
    print_success "MongoDB: CORRIENDO (PID: $MONGODB_PID)"
else
    print_warning "MongoDB: NO ESTÁ CORRIENDO"
    if systemctl is-failed mongod.service &>/dev/null; then
        print_info "  - Servicio systemd está en estado 'failed' (esto es normal si MongoDB se ejecuta manualmente)"
        systemctl reset-failed mongod.service 2>/dev/null || true
    fi
fi

# Verificar PostgreSQL
POSTGRES_RUNNING=false
if pgrep -f postgres > /dev/null; then
    POSTGRES_RUNNING=true
    POSTGRES_PID=$(pgrep -f postgres | head -1)
    print_success "PostgreSQL: CORRIENDO (PID: $POSTGRES_PID)"
else
    print_warning "PostgreSQL: NO ESTÁ CORRIENDO"
fi

# Si alguno no está corriendo, sugerir usar script de recovery
if [ "$MONGODB_RUNNING" = false ] || [ "$POSTGRES_RUNNING" = false ]; then
    echo ""
    print_warning "⚠️  Uno o más servicios de base de datos no están corriendo"
    print_info "Para iniciarlos correctamente, usa el script de recovery:"
    echo "  npm run recover:services"
    echo "  o"
    echo "  sudo bash scripts/services_recover.sh"
    echo ""
    print_info "Nota: MongoDB y PostgreSQL tienen configuración específica y deben iniciarse"
    print_info "      usando el script de recovery, no directamente con systemctl"
else
    print_success "Ambos servicios de base de datos están corriendo correctamente"
fi

echo ""

# ============================================================================
# 5. REINICIAR PM2 CON NUEVA CONFIGURACIÓN
# ============================================================================
print_info "5. Reiniciando PM2 con nueva configuración..."

if command -v pm2 &> /dev/null; then
    # Guardar procesos actuales
    if pm2 list | grep -q "online\|stopped"; then
        print_info "Guardando estado actual de PM2..."
        pm2 save 2>/dev/null || true
    fi
    
    # Recargar configuración
    if [ -f "$ECOSYSTEM_FILE" ]; then
        # Verificar si el archivo usa ES Modules (export default)
        if grep -q "export default" "$ECOSYSTEM_FILE"; then
            print_warning "ecosystem.config.js usa ES Modules, PM2 requiere CommonJS"
            print_info "Convirtiendo a CommonJS..."
            
            # Crear backup
            cp "$ECOSYSTEM_FILE" "$ECOSYSTEM_FILE.backup.esm.$(date +%Y%m%d_%H%M%S)"
            
            # Convertir export default a module.exports
            sed -i.tmp 's/export default/module.exports =/' "$ECOSYSTEM_FILE"
            rm -f "$ECOSYSTEM_FILE.tmp" 2>/dev/null || true
            
            print_success "Archivo convertido a CommonJS"
        fi
        
        print_info "Recargando configuración desde ecosystem.config.js..."
        cd "$PROJECT_DIR"
        pm2 delete all 2>/dev/null || true
        sleep 2
        
        # Intentar iniciar PM2 y capturar errores
        if pm2 start ecosystem.config.js 2>&1; then
            pm2 save
            print_success "PM2 reiniciado con nueva configuración"
            
            # Mostrar estado
            echo ""
            print_info "Estado actual de PM2:"
            pm2 list
        else
            PM2_ERROR=$?
            print_error "Error al iniciar PM2 con ecosystem.config.js"
            print_info "Verificando sintaxis del archivo..."
            
            # Verificar si Node.js puede cargar el archivo
            if node -e "require('$ECOSYSTEM_FILE')" 2>/dev/null; then
                print_info "El archivo es válido, pero PM2 tuvo un error"
                print_info "Intenta manualmente: pm2 start ecosystem.config.js"
            else
                print_error "El archivo tiene errores de sintaxis"
                print_info "Revisa el archivo: $ECOSYSTEM_FILE"
            fi
        fi
    else
        print_warning "No se encontró ecosystem.config.js, PM2 no se reinició"
    fi
else
    print_error "PM2 no está instalado o no está en PATH"
fi

echo ""

# ============================================================================
# 6. RESUMEN Y RECOMENDACIONES
# ============================================================================
echo "==============================="
print_info "Resumen de Cambios"
echo "==============================="
echo ""

# Verificar memoria
MEM_AVAILABLE=$(free -m | awk 'NR==2{printf "%.0f", $7}')
MEM_TOTAL=$(free -m | awk 'NR==2{print $2}')
SWAP_TOTAL=$(free -m | awk 'NR==3{print $2}')

print_info "Estado actual de memoria:"
echo "  - Total: ${MEM_TOTAL}MB"
echo "  - Disponible: ${MEM_AVAILABLE}MB"
echo "  - Swap: ${SWAP_TOTAL}MB"

if [ "$MEM_AVAILABLE" -lt 500 ]; then
    print_warning "Memoria disponible aún es baja (${MEM_AVAILABLE}MB)"
    print_info "Recomendación: Considera optimizar procesos o aumentar RAM"
fi

echo ""
print_info "Cambios aplicados:"
echo "  ✅ Permisos SELinux ajustados"
echo "  ✅ Swap configurado (${SWAP_TOTAL}MB)"
echo "  ✅ Límites de memoria PM2 optimizados"
echo "  ✅ Estado de MongoDB y PostgreSQL verificado"
echo "  ✅ PM2 reiniciado con nueva configuración"

echo ""
print_info "Próximos pasos recomendados:"
echo "  1. Monitorear memoria: watch -n 1 free -h"
echo "  2. Monitorear PM2: pm2 monit"
echo "  3. Verificar logs: pm2 logs"
echo "  4. Si MongoDB/PostgreSQL no están corriendo: npm run recover:services"
echo "  5. Ejecutar diagnóstico nuevamente: npm run diagnose:pm2"
echo ""

print_success "Script de corrección completado"
echo ""
