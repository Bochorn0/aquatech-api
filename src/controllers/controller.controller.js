// src/controllers/controller.controller.js
import ControllerModel from '../models/postgres/controller.model.js';
import ClientModel from '../models/postgres/client.model.js';
import ProductModel from '../models/postgres/product.model.js';

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

    res.json(safeController);
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
      const existingByIp = await ControllerModel.findOne({ ip: controllerData.ip });
      if (existingByIp) {
        return res.status(409).json({
          message: 'Ya existe un controlador con esta IP',
          existingController: existingByIp
        });
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
    res.status(500).json({ message: 'Error adding controller', error: error.message });
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
    res.json(updated);
  } catch (error) {
    console.error('Error updating controller:', error);
    res.status(500).json({ message: 'Error updating controller' });
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
