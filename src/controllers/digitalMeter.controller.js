import { loadDigitalMeters } from '../services/digitalMeters.js';

export async function listDigitalMeters(req, res) {
  try {
    const payload = await loadDigitalMeters({ codes: req.query.codes });
    res.json(payload);
  } catch (error) {
    console.error('[digitalMeters]', error);
    res.status(500).json({
      success: false,
      refreshed: false,
      message: 'No se pudieron leer los medidores guardados.',
      rows: [],
    });
  }
}
