// src/controllers/controller.controller.js
import Controller from '../models/controller.model.js';
import Client from '../models/client.model.js';
import Product from '../models/product.model.js';

// Obtener todos los controladores
export const getControllers = async (req, res) => {
  try {
    console.log('Fetching Controllers from MongoDB...');
    
    let controllers = await Controller.find({});

    const ONLINE_THRESHOLD_MS = 5000;
    const now = Date.now();

    const controllersWithOnline = controllers.map(ctrl => ({
      ...ctrl.toObject(),
      online: ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
    }));

    if (controllersWithOnline.length === 0) {
      // Si no hay registros, devuelve un dummy
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
    const clientes = await Client.find();
    const productos = await Product.find();
    const ONLINE_THRESHOLD_MS = 5000;
    const now = Date.now();
    console.log('Fetching Active Controllers from MongoDB...');

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

    const clienteMap = new Map(clientes.map(c => [c._id.toString(), c.name]));
    const productoMap = new Map(productos.map(p => [p._id.toString(), p.name]));

    const controllers = await Controller.find(filters);

    const mappedResults = controllers.map(ctrl => {
      const clientName = clienteMap.get(ctrl.cliente?.toString()) || '';
      const productName = productoMap.get(ctrl.product?.toString()) || '';
      return {
        ...ctrl.toObject(),
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
    const controller = await Controller.findById(id);
    if (!controller) {
      return res.status(404).json({ message: 'Controlador no encontrado' });
    }

    // ✅ Nos aseguramos de que siempre tenga valores
    const safeController = {
      ...controller.toObject(),
      reset_pending: controller.reset_pending ?? false,
      lapso_actualizacion: controller.lapso_actualizacion ?? 60000,
      lapso_loop: controller.lapso_loop ?? 5000,
    };

    res.json(safeController);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Crear nuevo controlador
export const addController = async (req, res) => {
  try {
    const controllerData = req.body;
    delete controllerData._id;

    // Si el id está vacío, generar uno único o validar por IP
    if (!controllerData.id || controllerData.id.trim() === '') {
      // Validar por IP ya que es requerido y debe ser único por controlador
      const existingByIp = await Controller.findOne({ ip: controllerData.ip });
      if (existingByIp) {
        return res.status(409).json({ 
          message: 'Ya existe un controlador con esta IP', 
          existingController: existingByIp 
        });
      }
      // Generar un ID único basado en timestamp o usar IP como base
      controllerData.id = `CTRL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } else {
      // Si tiene id, validar que no exista
      const currentController = await Controller.findOne({ id: controllerData.id });
      if (currentController) {
        return res.status(409).json({ message: 'Controller already exists' });
      }
    }

    const newController = new Controller(controllerData);
    await newController.save();
    res.status(201).json(newController);
  } catch (error) {
    console.error('Error adding controller:', error);
    // Si es error de duplicado por índice único de MongoDB
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ 
        message: `Ya existe un controlador con este ${field}`,
        field: field 
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

    const controller = await Controller.findById(id);

    if (!controller) {
      return res.status(404).json({ message: 'Controller not found' });
    }

    console.log('Updating controller:', updatedController);

    // ✅ Esto permite actualizar reset_pending y lapsos
    controller.set(updatedController);
    await controller.save();

    res.json(controller);
  } catch (error) {
    console.error('Error updating controller:', error);
    res.status(500).json({ message: 'Error updating controller' });
  }
};

// Eliminar controlador
export const deleteController = async (req, res) => {
  try {
    const { id } = req.params;

    const controller = await Controller.findById(id);
    if (!controller) {
      return res.status(404).json({ message: 'Controller not found' });
    }

    await Controller.deleteOne({ _id: id });
    res.json(controller);
  } catch (error) {
    console.error('Error deleting controller:', error);
    res.status(500).json({ message: 'Error deleting controller' });
  }
};
