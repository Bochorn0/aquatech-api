// src/services/mqtt.example.js
// Ejemplo de cómo usar handlers personalizados con el servicio MQTT

import mqttService from './mqtt.service.js';
// import PresionData from '../models/presion.model.js'; // Si creas un modelo para presión

// Ejemplo 1: Handler personalizado para guardar datos de presión en la base de datos
mqttService.onMessage('aquatech/data', async (topic, message) => {
  try {
    const data = JSON.parse(message);
    
    // Ejemplo de guardado en base de datos
    // const presionData = new PresionData({
    //   presion_in: data.presion_in,
    //   presion_out: data.presion_out,
    //   source: data.source,
    //   timestamp: new Date(data.timestamp * 1000), // Convertir timestamp a Date
    // });
    // await presionData.save();
    
    console.log('Datos de presión guardados:', data);
  } catch (error) {
    console.error('Error al guardar datos de presión:', error);
  }
});

// Ejemplo 2: Handler para presión IN
mqttService.onMessage('aquatech/presion_in', (topic, message) => {
  const presionIn = parseFloat(message);
  console.log('Presión IN recibida:', presionIn);
  
  // Aquí puedes hacer lo que necesites con el dato
  // Por ejemplo: validar, procesar, notificar, etc.
});

// Ejemplo 3: Handler para presión OUT
mqttService.onMessage('aquatech/presion_out', (topic, message) => {
  const presionOut = parseFloat(message);
  console.log('Presión OUT recibida:', presionOut);
});

// Ejemplo 4: Handler para estado del dispositivo
mqttService.onMessage('aquatech/status', (topic, message) => {
  try {
    const status = JSON.parse(message);
    console.log('Estado del dispositivo:', status);
    
    // Aquí puedes actualizar el estado del dispositivo en la base de datos
    // o enviar notificaciones si el dispositivo se desconecta
  } catch (error) {
    console.error('Error al procesar status:', error);
  }
});

// Ejemplo 5: Publicar un comando al dispositivo (si es necesario)
// mqttService.publish('aquatech/commands', JSON.stringify({ action: 'reset' }));

