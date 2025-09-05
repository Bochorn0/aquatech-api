// src/controllers/controller.controller.js
import Controller from '../models/controller.model.js';
import Client from '../models/client.model.js';
import Product from '../models/product.model.js';

// Obtener todos los controladores
export const getControllers = async (req, res) => {
  try {
    console.log('Fetching Controllers from MongoDB...');
    
    let controllers = await Controller.find({});

    if (controllers.length === 0) {
      // Si no hay registros, devuelve un dummy
      controllers = [
        {
          id: 'ESP32-001',
          name: 'Controlador Demo',
          ip: '192.168.1.100',
          city: 'Hermosillo',
          state: 'Sonora',
          online: true,
        }
      ];
    }

    res.json(controllers);
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
    const controller = await Controller.findById(id); // asumiendo que usas Mongoose
    if (!controller) {
      return res.status(404).json({ message: 'Controlador no encontrado' });
    }
    res.json(controller);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Crear nuevo controlador
export const addController = async (req, res) => {
  try {
    const controllerData = req.body;
    delete controllerData._id;

    const currentController = await Controller.findOne({ id: controllerData.id });
    if (currentController) {
      return res.status(409).json({ message: 'Controller already exists' });
    }

    const newController = new Controller(controllerData);
    await newController.save();
    res.status(201).json(newController);
  } catch (error) {
    console.error('Error adding controller:', error);
    res.status(500).json({ message: 'Error adding controller' });
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
    console.log('update controller', updatedController)
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
