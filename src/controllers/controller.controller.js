// src/controllers/controller.controller.js
import crypto from 'crypto';
import ControllerModel from '../models/postgres/controller.model.js';
import ClientModel from '../models/postgres/client.model.js';
import ProductModel from '../models/postgres/product.model.js';
import NotificationModel from '../models/postgres/notification.model.js';
import UserModel from '../models/postgres/user.model.js';
import emailHelper from '../utils/email.helper.js';
import { decorateRulesForDevice } from '../services/controllerFlowReadings.js';

const recentPressureAlarms = new Map();

function rulesRevision(rules) {
  const raw = rules == null ? '' : JSON.stringify(rules);
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 20);
}

function syncMsOf(controller) {
  const value = Number(controller?.update_controller_time ?? 60000);
  if (!Number.isFinite(value) || value < 15000) return 60000;
  return value;
}

async function presentController(controller) {
  if (!controller?.rules) return controller;
  return {
    ...controller,
    rules: await decorateRulesForDevice(controller.rules),
  };
}

// Obtener todos los controladores
export const getControllers = async (req, res) => {
  try {
    console.log('Fetching Controllers from Postgres...');

    let controllers = await ControllerModel.find({});

    const ONLINE_THRESHOLD_MS = 5000;
    const now = Date.now();

    const controllersWithOnline = controllers.map(ctrl => ({
      ...ctrl,
      online: ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
    }));

    if (controllersWithOnline.length === 0) {
      controllersWithOnline.push({
        id: 'ESP32-001',
        name: 'Controlador Demo',
        ip: '192.168.1.100',
        city: 'Hermosillo',
        state: 'Sonora',
        online: true,
      });
    }

    res.json(controllersWithOnline);
  } catch (error) {
    console.error('Error fetching controllers:', error);
    res.status(500).json({ message: 'Error fetching controllers' });
  }
};

// Obtener controladores activos con filtros
export const getActiveControllers = async (req, res) => {
  try {
    const clientes = await ClientModel.find();
    const productos = await ProductModel.find();
    const ONLINE_THRESHOLD_MS = 5000;
    const now = Date.now();
    console.log('Fetching Active Controllers from Postgres...');

    const { online, cliente, product } = req.query;
    const filters = {};

    if (online) {
      filters.online = online === 'true';
    }
    if (cliente) {
      filters.cliente = cliente;
    }
    if (product) {
      filters.product = product;
    }

    const clienteMap = new Map(clientes.map(c => [String(c.id ?? c._id), c.name]));
    const productoMap = new Map(productos.map(p => [String(p.id ?? p._id), p.name]));

    const controllers = await ControllerModel.find(filters);

    const mappedResults = controllers.map(ctrl => {
      const clientName = clienteMap.get(String(ctrl.cliente ?? ctrl.client_id ?? '')) || '';
      const productName = productoMap.get(String(ctrl.product ?? ctrl.product_id ?? '')) || '';
      return {
        ...ctrl,
        client_name: clientName,
        product_name: productName,
        online: ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
      };
    });

    res.json(mappedResults);
  } catch (error) {
    console.error('Error fetching active controllers:', error);
    res.status(500).json({ message: 'Error fetching active controllers' });
  }
};

// Obtener un controlador por ID
export const getControllerById = async (req, res) => {
  try {
    const { id } = req.params;
    const controller = await ControllerModel.findByIdOrDeviceId(id);
    if (!controller) {
      return res.status(404).json({ message: 'Controlador no encontrado' });
    }

    const safeController = {
      ...controller,
      reset_pending: controller.reset_pending ?? false,
      flush_pending: controller.flush_pending ?? false,
      lapso_actualizacion: controller.update_controller_time ?? controller.lapso_actualizacion ?? 60000,
      lapso_loop: controller.loop_time ?? controller.lapso_loop ?? 5000,
    };

    res.json(await presentController(safeController));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// El equipo pregunta solo el sello de las reglas. Si no cambió, no baja el documento.
export const getControllerRevision = async (req, res) => {
  try {
    const controller = await ControllerModel.findByIdOrDeviceId(req.params.id);
    if (!controller) {
      return res.status(404).json({ message: 'Controlador no encontrado' });
    }
    res.json({
      revision: rulesRevision(controller.rules),
      sync_ms: syncMsOf(controller),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear nuevo controlador
export const addController = async (req, res) => {
  try {
    const controllerData = { ...req.body };
    delete controllerData._id;

    if (!controllerData.id || String(controllerData.id).trim() === '') {
      if (controllerData.ip) {
        const existingByIp = await ControllerModel.findOne({ ip: controllerData.ip });
        if (existingByIp) {
          return res.status(409).json({
            message: 'Ya existe un controlador con esta IP',
            existingController: existingByIp
          });
        }
      }
      controllerData.id = `CTRL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } else {
      const currentController = await ControllerModel.findOne({ id: controllerData.id });
      if (currentController) {
        return res.status(409).json({ message: 'Controller already exists' });
      }
    }

    const newController = await ControllerModel.create(controllerData);
    if (!newController) {
      return res.status(500).json({ message: 'Failed to create controller' });
    }
    res.status(201).json(newController);
  } catch (error) {
    console.error('Error adding controller:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        message: `Ya existe un controlador con este campo`,
        field: error.column
      });
    }
    res.status(error.statusCode || 500).json({ message: error.message || 'Error adding controller' });
  }
};

// Actualizar controlador
export const updateController = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedController = req.body;

    const controller = await ControllerModel.findByIdOrDeviceId(id);
    if (!controller) {
      return res.status(404).json({ message: 'Controller not found' });
    }

    const updated = await ControllerModel.update(id, updatedController);
    if (!updated) {
      return res.status(500).json({ message: 'Failed to update controller' });
    }
    if (String(req.query.brief || '') === '1') {
      return res.json({
        ok: true,
        revision: rulesRevision(updated.rules),
        sync_ms: syncMsOf(updated),
      });
    }
    res.json(await presentController(updated));
  } catch (error) {
    console.error('Error updating controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Error updating controller' });
  }
};

export const reportPressureAlarm = async (req, res) => {
  try {
    const controller = await ControllerModel.findByIdOrDeviceId(req.params.id);
    if (!controller) return res.status(404).json({ message: 'Controlador no encontrado' });

    const sensor = Number(req.body?.sensor);
    const flowAlert = req.body?.kind === 'flow';
    const flow = flowAlert ? controller.rules?.flows?.[sensor - 1] : null;
    const rule = flowAlert
      ? flow?.alarm
      : controller.rules?.pressure_alarms?.sensors?.find((item) => Number(item.sensor) === sensor);
    const reading = Number(flowAlert ? req.body?.lpm : req.body?.psi);
    const min = Number(flowAlert ? rule?.min_lpm : rule?.min_psi);
    const max = Number(flowAlert ? rule?.max_lpm : rule?.max_psi);
    const margin = Number(flowAlert ? rule?.margin_lpm : rule?.margin_psi) || 0;
    if (!rule?.enabled || !Number.isFinite(reading)) return res.json({ ok: true, ignored: true });

    let level = 'ok';
    if (reading < min || reading > max) level = 'alarm';
    else if (reading < min + margin || reading > max - margin) level = 'warn';

    const deviceKey = controller.device_id || controller.id;
    const key = `${deviceKey}:${flowAlert ? 'flow' : 'psi'}:${sensor}:${level}`;
    const now = Date.now();
    if (now - (recentPressureAlarms.get(key) || 0) < 15 * 60 * 1000) {
      return res.json({ ok: true, skipped: true, level });
    }
    const hadAlert = ['warn', 'alarm'].some((name) => recentPressureAlarms.has(`${deviceKey}:${flowAlert ? 'flow' : 'psi'}:${sensor}:${name}`));
    if (level === 'ok' && !hadAlert) return res.json({ ok: true, ignored: true, level });

    const name = controller.name || deviceKey || 'Controlador';
    const label = level === 'alarm' ? 'fuera de rango' : level === 'warn' ? 'cerca del límite' : 'de vuelta en rango';
    const subject = flowAlert ? (flow?.name || `Flujo ${sensor}`) : `S${sensor}`;
    const unit = flowAlert ? 'L/min' : 'psi';
    const title = `${flowAlert ? 'Flujo' : 'Presión'} ${subject} ${label}`;
    const description = `${name}: ${subject} en ${reading.toFixed(1)} ${unit}. Rango ${min}–${max} ${unit}.`;
    const channel = rule.channel || 'portal';
    let delivered = false;

    if (channel === 'portal' || channel === 'both') {
      try {
        const users = await UserModel.find({ status: 'active' });
        for (const user of (users || []).slice(0, 20)) {
          if (!user?.id) continue;
          await NotificationModel.create({
            user_id: user.id,
            title,
            description,
            type: level === 'ok' ? 'info' : level === 'warn' ? 'warning' : 'alert',
            posted_at: new Date(),
            is_unread: true,
            url: `/controladores/${encodeURIComponent(deviceKey)}`,
          });
          delivered = true;
        }
      } catch (error) {
        console.error('[PSI] no se pudo crear la notificación:', error.message);
      }
    }

    if ((channel === 'email' || channel === 'both') && rule.email) {
      try {
        if (level === 'ok') {
          await emailHelper.sendNotificationEmail({ to: rule.email, subject: title, title, message: description });
        } else {
          await emailHelper.sendAlertEmail({
            to: rule.email,
            alertType: level === 'warn' ? 'preventivo' : 'correctivo',
            metricName: `${flowAlert ? 'Flujo' : 'Presión'} ${subject}`,
            message: description,
            sensorData: { Controlador: name, Lectura: `${reading.toFixed(1)} ${unit}`, Rango: `${min}–${max}` },
          });
        }
        delivered = true;
      } catch (error) {
        console.error('[PSI] no se pudo enviar el correo:', error.message);
      }
    }

    if (!delivered) return res.status(502).json({ message: 'La alarma no llegó al portal ni al correo' });
    recentPressureAlarms.set(key, now);
    res.json({ ok: true, level });
  } catch (error) {
    console.error('Error en alarma de presión:', error);
    res.status(500).json({ message: 'No se pudo registrar la alarma' });
  }
};

// Eliminar controlador
export const deleteController = async (req, res) => {
  try {
    const { id } = req.params;

    const controller = await ControllerModel.findByIdOrDeviceId(id);
    if (!controller) {
      return res.status(404).json({ message: 'Controller not found' });
    }

    await ControllerModel.delete(id);
    res.json(controller);
  } catch (error) {
    console.error('Error deleting controller:', error);
    res.status(500).json({ message: 'Error deleting controller' });
  }
};
