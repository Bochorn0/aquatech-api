#!/bin/bash
# Script para configurar el certificado MQTT en .env
# Uso: ./scripts/setup-mqtt-cert.sh

echo "🔐 Configuración de Certificado MQTT CA"
echo "======================================"
echo ""

# Verificar si existe .env
if [ ! -f .env ]; then
    echo "⚠️  Archivo .env no encontrado. Creando desde .env-example..."
    cp .env-example .env
fi

# Certificado CA (el mismo que está en el ESP32)
CA_CERT="-----BEGIN CERTIFICATE-----
MIIECTCCAvGgAwIBAgIUaeT7mWBE0krpOQdDiG/akjnNe9MwDQYJKoZIhvcNAQEL
BQAwgZMxCzAJBgNVBAYTAk1YMQ8wDQYDVQQIDAZTb25vcmExEzARBgNVBAcMCkhl
cm1vc2lsbG8xETAPBgNVBAoMCEFxdWF0ZWNoMQswCQYDVQQLDAJUSTETMBEGA1UE
AwwKQXF1YXRlY2hUSTEpMCcGCSqGSIb3DQEJARYaYXF1YXRlY2guaXQuMjAyNUBn
bWFpbC5jb20wHhcNMjUxMjI2MTQwMzE4WhcNMzUxMjI0MTQwMzE4WjCBkzELMAkG
A1UEBhMCTVgxDzANBgNVBAgMBlNvbm9yYTETMBEGA1UEBwwKSGVybW9zaWxsbzER
MA8GA1UECgwIQXF1YXRlY2gxCzAJBgNVBAsMAlRJMRMwEQYDVQQDDApBcXVhdGVj
aFRJMSkwJwYJKoZIhvcNAQkBFhphcXVhdGVjaC5pdC4yMDI1QGdtYWlsLmNvbTCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKY2bVSij845H6cMaX3CHHdu
zN/EAa5bYHCt8Y5ACphCzLmS5BwBCG0MTgKBLckYaH3qdzjEvMt+jeZ37N2f/Kmh
DDj1LXeSzXAG/tKeNt/dp2FgsF2mblCRaYZxwyBpZjaa/pv30kahNmeiU1euLoBi
BaKOKgyXbSvU7AJ3trT09ZDWUIzicoEw7zr4zPe4eL/0A7yE03JSNNrsb06QJjcz
JIJUeg15GlzIi2hWmYYg/rX11znYq94CUNEf6wbbwZmh7oaEYwO/ru9nq0JaCzDs
lqpKEkSo4VedfamD2zE7v8ncD+SSWzR/gSI+dJejAxsJ3HCVCeUzA1IOsVqkZG0C
AwEAAaNTMFEwHQYDVR0OBBYEFMJCox/DWSVVUDcl0+AOZyxGkMy8MB8GA1UdIwQY
MBaAFMJCox/DWSVVUDcl0+AOZyxGkMy8MA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZI
hvcNAQELBQADggEBAJ2q5IZdQSg1lLG2nKu9/HY2QUVf2lsi2lD+x9bA1DX6rw5+
s8Fz+ytZKrsDEciVcYgs9BhEVmP8AnZPcaE9pimJXqSBK8tehh/ZJtUZv2Vvp5g/
K6EvShFcvHqXsXQW8nhPvESRaE7bucSCONNS8Cuy/BDQ+ffE6USWzeVY4YwYcJ4g
C0l3buWSVNfbwL5HHTupUze06pn9zZgJbfcFk+WlwNwIizK3DPg39bom/0HT8+Fz
BYZgMEvHi/6B83pecj+MoAVPhpwl8549NE92Sszv8OIKpR59WOuC+a4NiVktCctS
U0YBXM/WsHxY/PyQl3qShJMZT3Q65aQAnC2Wocg=
-----END CERTIFICATE-----"

# Escapar el certificado para uso en .env (reemplazar saltos de línea con \n)
CA_CERT_ESCAPED=$(echo "$CA_CERT" | sed ':a;N;$!ba;s/\n/\\n/g')

# Verificar si MQTT_CA_CERT ya existe en .env
if grep -q "MQTT_CA_CERT=" .env; then
    echo "⚠️  MQTT_CA_CERT ya existe en .env"
    read -p "¿Deseas sobrescribirlo? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operación cancelada"
        exit 1
    fi
    # Eliminar la línea existente
    sed -i.bak '/^MQTT_CA_CERT=/d' .env
fi

# Agregar el certificado al .env
echo "" >> .env
echo "# MQTT CA Certificate (agregado automáticamente)" >> .env
echo "MQTT_CA_CERT=\"$CA_CERT_ESCAPED\"" >> .env

echo "✅ Certificado CA agregado a .env"
echo ""
echo "📝 Verifica que las siguientes variables estén configuradas:"
echo "   - MQTT_PORT=8883"
echo "   - MQTT_USE_TLS=true"
echo "   - MQTT_USERNAME=Aquatech001"
echo "   - MQTT_PASSWORD=Aquatech2025*"
echo ""
echo "🔄 Reinicia el servicio para aplicar los cambios:"
echo "   pm2 restart aquatech-api"
echo "   # o"
echo "   npm restart"
