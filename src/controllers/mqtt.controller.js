// src/controllers/mqtt.controller.js
// Controlador para endpoints relacionados con MQTT

import archiver from 'archiver';
import mqttService from '../services/mqtt.service.js';
import archiverZipEncrypted from 'archiver-zip-encrypted';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import UserModel from '../models/postgres/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Registrar el formato zip-encrypted
archiver.registerFormat('zip-encrypted', archiverZipEncrypted);

// Certificado CA (el mismo que está en el ESP32)
const CA_CERT = `-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----`;

/**
 * Descargar certificado CA en un ZIP protegido con contraseña
 * La contraseña se obtiene del usuario autenticado
 */
export const downloadCertificateZip = async (req, res) => {
  try {
    // Obtener el usuario autenticado desde el token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    // Obtener el usuario completo de la base de datos
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener la contraseña del ZIP del usuario
    // Si tiene mqtt_zip_password configurado, usarlo; si no, usar el email como fallback
    const ZIP_PASSWORD = (user && (user.mqtt_zip_password || user.email)) || process.env.MQTT_CERT_ZIP_PASSWORD || 'Aquatech2025*';
    // Crear directorio temporal si no existe
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const certFileName = 'ca_cert.crt';
    const zipFileName = 'aquatech_ca_certificate.zip';
    const tempCertPath = path.join(tempDir, certFileName);
    const tempZipPath = path.join(tempDir, zipFileName);

    // Escribir el certificado a un archivo temporal
    fs.writeFileSync(tempCertPath, CA_CERT);

    // Crear ZIP protegido con contraseña usando archiver-zip-encrypted
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(tempZipPath);
      
      // Crear archivo ZIP con cifrado y contraseña
      const archive = archiver.create('zip-encrypted', {
        zlib: { level: 9 }, // Máxima compresión
        encryptionMethod: 'zip20', // Usar zip20 para mejor compatibilidad
        password: ZIP_PASSWORD // Contraseña para el ZIP
      });

      // Manejar eventos
      output.on('close', () => {
        console.log(`ZIP protegido creado: ${archive.pointer()} bytes`);
        
        // Enviar el archivo
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

        const fileStream = fs.createReadStream(tempZipPath);
        fileStream.pipe(res);

        fileStream.on('end', () => {
          // Limpiar archivos temporales
          setTimeout(() => {
            try {
              if (fs.existsSync(tempCertPath)) fs.unlinkSync(tempCertPath);
              if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
            } catch (cleanupError) {
              console.error('Error limpiando archivos temporales:', cleanupError);
            }
          }, 1000);
          resolve();
        });

        fileStream.on('error', (error) => {
          console.error('Error enviando archivo:', error);
          if (!res.headersSent) {
            res.status(500).json({ 
              message: 'Error al enviar el archivo ZIP',
              error: error.message 
            });
          }
          reject(error);
        });
      });

      archive.on('error', (error) => {
        console.error('Error creando ZIP:', error);
        reject(error);
      });

      // Conectar el archiver al output
      archive.pipe(output);

      // Agregar el certificado al ZIP
      archive.file(tempCertPath, { name: certFileName });

      // Finalizar el archivo ZIP
      archive.finalize();
    });
  } catch (error) {
    console.error('Error generando ZIP del certificado:', error);
    res.status(500).json({ 
      message: 'Error al generar el archivo ZIP del certificado',
      error: error.message 
    });
  }
};

/**
 * Publish test message to MQTT (tiwater/{codigoTienda}/data).
 * Used to test Event Grid MQTT or Mosquitto integration.
 * Frontend can call this to send sensor data; mqtt-consumer receives and saves to PostgreSQL.
 */
export const publishTestMessage = async (req, res) => {
  try {
    const { codigoTienda, payload } = req.body;

    if (!codigoTienda || typeof codigoTienda !== 'string') {
      return res.status(400).json({ message: 'codigoTienda is required (e.g. TEST-001)' });
    }

    const topic = `tiwater/${codigoTienda.trim()}/data`;

    // Default payload (mock tiwater format); merge with provided payload
    const defaultPayload = {
      'CAUDAL PURIFICADA': 1.2,
      'CAUDAL RECUPERACION': 1.5,
      'NIVEL PURIFICADA': 45.5,
      'NIVEL CRUDA': 65.2,
      'TDS': 85,
      timestamp: Math.floor(Date.now() / 1000)
    };
    const finalPayload = typeof payload === 'object' ? { ...defaultPayload, ...payload } : defaultPayload;
    const message = JSON.stringify(finalPayload);

    // Ensure MQTT is connected (for API process - publish only; consumer runs separately)
    if (!mqttService.isConnected) {
      mqttService.connect();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      if (!mqttService.isConnected) {
        return res.status(503).json({
          message: 'MQTT not connected. Ensure mqtt-consumer is running and broker is reachable.',
          broker: process.env.MQTT_BROKER || 'not set'
        });
      }
    }

    await mqttService.publish(topic, message);

    res.json({
      success: true,
      message: 'Published to MQTT',
      topic,
      payload: finalPayload
    });
  } catch (error) {
    console.error('[MQTT] Publish test error:', error);
    res.status(500).json({ message: error.message || 'Failed to publish' });
  }
};

