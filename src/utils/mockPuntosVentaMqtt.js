// Shared mock data for MQTT onboarding / admin events (tiwater/REGION/CIUDAD/CODIGO/data)
// Used by scripts/onboard-puntos-venta-mqtt.js and admin generateMockPuntosVenta API.

export const REGIONS = {
  Noroeste: [
    { city: 'Hermosillo', state: 'Sonora', lat: 29.0731, lon: -110.9559 },
    { city: 'Tijuana', state: 'BajaCalifornia', lat: 32.5149, lon: -117.0382 },
    { city: 'CiudadJuarez', state: 'Chihuahua', lat: 31.6904, lon: -106.4245 },
  ],
  Suroeste: [
    { city: 'Oaxaca', state: 'Oaxaca', lat: 17.0732, lon: -96.7266 },
    { city: 'Chilpancingo', state: 'Guerrero', lat: 17.5506, lon: -99.5058 },
    { city: 'Tapachula', state: 'Chiapas', lat: 14.9091, lon: -92.2628 },
  ],
  Bajio: [
    { city: 'Guadalajara', state: 'Jalisco', lat: 20.6597, lon: -103.3496 },
    { city: 'Morelia', state: 'Michoacan', lat: 19.7069, lon: -101.1949 },
    { city: 'SanLuisPotosi', state: 'SanLuisPotosi', lat: 22.1565, lon: -100.9855 },
    { city: 'Leon', state: 'Guanajuato', lat: 21.1232, lon: -101.6828 },
  ],
  Centro: [
    { city: 'Aguascalientes', state: 'Aguascalientes', lat: 21.8853, lon: -102.2916 },
    { city: 'Queretaro', state: 'Queretaro', lat: 20.5888, lon: -100.3899 },
    { city: 'Zacatecas', state: 'Zacatecas', lat: 22.7709, lon: -102.5833 },
    { city: 'Pachuca', state: 'Hidalgo', lat: 20.1231, lon: -98.7333 },
  ],
};

export function buildMockTiwaterPayload(timestampUnix = Math.floor(Date.now() / 1000)) {
  const nivelPurificada = Math.round((25 + Math.random() * 55) * 10) / 10;
  const nivelCruda = Math.round((35 + Math.random() * 45) * 10) / 10;
  return {
    'CAUDAL PURIFICADA': parseFloat((0.5 + Math.random() * 1.5).toFixed(2)),
    'CAUDAL RECUPERACION': parseFloat((1.5 + Math.random() * 1.2).toFixed(2)),
    'CAUDAL RECHAZO': parseFloat((0.1 + Math.random() * 0.3).toFixed(2)),
    'NIVEL PURIFICADA': nivelPurificada,
    'NIVEL CRUDA': nivelCruda,
    'PORCENTAJE NIVEL PURIFICADA': nivelPurificada,
    'PORCENTAJE NIVEL CRUDA': nivelCruda,
    'CAUDAL CRUDA': parseFloat((1.5 + Math.random() * 1.0).toFixed(2)),
    'ACUMULADO CRUDA': parseFloat((1500 + Math.random() * 3000).toFixed(1)),
    'CAUDAL CRUDA L/min': parseFloat((18 + Math.random() * 8).toFixed(3)),
    vida: Math.floor(50 + Math.random() * 150),
    TDS: Math.round(40 + Math.random() * 120),
    'PRESION CO2': parseFloat((40 + Math.random() * 60).toFixed(2)),
    ch1: parseFloat((2 + Math.random() * 3).toFixed(2)),
    ch2: parseFloat((2 + Math.random() * 3).toFixed(2)),
    ch3: parseFloat((1 + Math.random() * 2).toFixed(2)),
    ch4: parseFloat((2 + Math.random() * 2.5).toFixed(2)),
    EFICIENCIA: parseFloat((45 + Math.random() * 25).toFixed(1)),
    timestamp: timestampUnix,
  };
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
