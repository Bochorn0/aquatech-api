#!/bin/bash

# ============================================================================
# Services Recovery Script
# ============================================================================
# Este script reinicia MongoDB y PostgreSQL 15 en caso de emergencia
# Uso: sudo ./scripts/services_recover.sh
# ============================================================================

set -e  # Salir si hay algún error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con colores
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
echo " 🔄 Services Recovery Script"
echo " 📅 Fecha: $(date)"
echo " 🖥️  Hostname: $(hostname)"
echo "==============================="
echo ""

# ============================================================================
# MONGODB RECOVERY
# ============================================================================
print_info "Reiniciando MongoDB..."

# Matar procesos mongod si existen
if pgrep -f mongod > /dev/null; then
    print_warning "Procesos MongoDB detectados, deteniendo..."
    pkill -f mongod 2>/dev/null || true
    sleep 2
    
    # Verificar que se detuvieron
    if pgrep -f mongod > /dev/null; then
        print_error "MongoDB no se detuvo correctamente, intentando kill -9..."
        pkill -9 -f mongod 2>/dev/null || true
        sleep 2
    fi
fi

# Verificar que no quede ningún proceso
if pgrep -f mongod > /dev/null; then
    print_error "MongoDB sigue corriendo después de intentar detenerlo"
    print_warning "Abortando reinicio de MongoDB"
else
    print_success "MongoDB detenido correctamente"
    
    # Verificar que existe el archivo de configuración
    if [ ! -f /etc/mongod.conf ]; then
        print_error "Archivo de configuración /etc/mongod.conf no encontrado"
        print_warning "Saltando reinicio de MongoDB"
    else
        # Verificar que existe el directorio de logs
        if [ ! -d /var/log/mongodb ]; then
            print_warning "Directorio /var/log/mongodb no existe, creándolo..."
            mkdir -p /var/log/mongodb
            chown mongod:mongod /var/log/mongodb 2>/dev/null || true
        fi
        
        # Iniciar MongoDB en fork
        print_info "Iniciando MongoDB..."
        if mongod --config /etc/mongod.conf --fork --logpath /var/log/mongodb/mongod.log 2>/dev/null; then
            sleep 2
            
            # Verificar estado
            if pgrep -f mongod > /dev/null; then
                print_success "MongoDB iniciado correctamente"
                print_info "PID: $(pgrep -f mongod | head -1)"
            else
                print_error "MongoDB no inició correctamente"
                print_info "Revisa los logs: tail -n 50 /var/log/mongodb/mongod.log"
            fi
        else
            print_error "Error al iniciar MongoDB"
            print_info "Revisa los logs: tail -n 50 /var/log/mongodb/mongod.log"
        fi
    fi
fi

echo ""

# ============================================================================
# POSTGRESQL 15 RECOVERY
# ============================================================================
print_info "Reiniciando PostgreSQL 15..."

# Matar procesos postgres si existen
if pgrep -f postgres > /dev/null; then
    print_warning "Procesos PostgreSQL detectados, deteniendo..."
    pkill -f postgres 2>/dev/null || true
    sleep 2
    
    # Verificar que se detuvieron
    if pgrep -f postgres > /dev/null; then
        print_error "PostgreSQL no se detuvo correctamente, intentando kill -9..."
        pkill -9 -f postgres 2>/dev/null || true
        sleep 2
    fi
fi

# Verificar que no quede ningún proceso
if pgrep -f postgres > /dev/null; then
    print_error "PostgreSQL sigue corriendo después de intentar detenerlo"
    print_warning "Abortando reinicio de PostgreSQL"
else
    print_success "PostgreSQL detenido correctamente"
    
    # Verificar que existe el directorio de datos
    PG_DATA_DIR="/var/lib/pgsql/15/data"
    PG_BIN_DIR="/usr/pgsql-15/bin"
    
    if [ ! -d "$PG_DATA_DIR" ]; then
        print_error "Directorio de datos PostgreSQL no encontrado: $PG_DATA_DIR"
        print_warning "Saltando reinicio de PostgreSQL"
    elif [ ! -f "$PG_BIN_DIR/pg_ctl" ]; then
        print_error "pg_ctl no encontrado en: $PG_BIN_DIR"
        print_warning "Saltando reinicio de PostgreSQL"
    else
        # Iniciar PostgreSQL 15
        print_info "Iniciando PostgreSQL 15..."
        if sudo -u postgres "$PG_BIN_DIR/pg_ctl" start -D "$PG_DATA_DIR" -l "$PG_DATA_DIR/logfile" 2>/dev/null; then
            sleep 2
            
            # Verificar estado
            if pgrep -f postgres > /dev/null; then
                print_success "PostgreSQL 15 iniciado correctamente"
                print_info "PID: $(pgrep -f postgres | head -1)"
            else
                print_error "PostgreSQL 15 no inició correctamente"
                print_info "Revisa los logs: tail -n 50 $PG_DATA_DIR/logfile"
            fi
        else
            print_error "Error al iniciar PostgreSQL 15"
            print_info "Revisa los logs: tail -n 50 $PG_DATA_DIR/logfile"
        fi
    fi
fi

echo ""
echo "==============================="
print_info "Recovery script finalizado"
echo "==============================="
echo ""

# ============================================================================
# RESUMEN DE ESTADO
# ============================================================================
echo "📊 Resumen de estado:"
echo ""

# MongoDB
if pgrep -f mongod > /dev/null; then
    print_success "MongoDB: CORRIENDO (PID: $(pgrep -f mongod | head -1))"
else
    print_error "MongoDB: DETENIDO"
fi

# PostgreSQL
if pgrep -f postgres > /dev/null; then
    print_success "PostgreSQL: CORRIENDO (PID: $(pgrep -f postgres | head -1))"
else
    print_error "PostgreSQL: DETENIDO"
fi

echo ""
print_info "Para ver logs detallados:"
echo "  MongoDB:    tail -n 50 /var/log/mongodb/mongod.log"
echo "  PostgreSQL: tail -n 50 /var/lib/pgsql/15/data/logfile"
echo ""
