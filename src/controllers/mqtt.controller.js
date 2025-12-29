// src/controllers/mqtt.controller.js
// Controlador para endpoints relacionados con MQTT

import archiver from 'archiver';
import archiverZipEncrypted from 'archiver-zip-encrypted';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Contraseña para el ZIP (puedes cambiarla o hacerla configurable)
const ZIP_PASSWORD = process.env.MQTT_CERT_ZIP_PASSWORD || 'Aquatech2025*';

/**
 * Descargar certificado CA en un ZIP protegido con contraseña
 */
export const downloadCertificateZip = async (req, res) => {
  try {
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

