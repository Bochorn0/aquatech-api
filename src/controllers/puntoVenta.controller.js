import PuntoVenta from '../models/puntoVenta.model.js';
import Client from '../models/client.model.js';
import Product from '../models/product.model.js';
import Controller from '../models/controller.model.js';
import City from '../models/city.model.js';

// Obtener todos los puntos de venta
export const getPuntosVenta = async (req, res) => {
  try {
    console.log('Fetching Puntos de Venta from MongoDB...');

    const puntos = await PuntoVenta.find({})
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 5000;

    const puntosConEstado = puntos.map(pv => {
      const tieneControladorOnline = pv.controladores?.some(
        ctrl => ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
      );

      return {
        ...pv.toObject(),
        online: tieneControladorOnline,
      };
    });

    res.json(puntosConEstado);
  } catch (error) {
    console.error('Error fetching puntos de venta:', error);
    res.status(500).json({ message: 'Error fetching puntos de venta' });
  }
};

// Obtener puntos de venta filtrados
export const getPuntosVentaFiltered = async (req, res) => {
  try {
    console.log('Fetching filtered Puntos de Venta...');
    const { cliente, city, online } = req.query;

    const filters = {};
    if (cliente) filters.cliente = cliente;
    if (city) filters.city = city;

    const puntos = await PuntoVenta.find(filters)
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 5000;

    const puntosConEstado = puntos.map(pv => {
      const tieneControladorOnline = pv.controladores?.some(
        ctrl => ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
      );
      return {
        ...pv.toObject(),
        online: tieneControladorOnline,
      };
    });

    // Si se solicita filtrar por online
    const puntosFiltrados = online
      ? puntosConEstado.filter(pv => pv.online === (online === 'true'))
      : puntosConEstado;

    res.json(puntosFiltrados);
  } catch (error) {
    console.error('Error filtering puntos de venta:', error);
    res.status(500).json({ message: 'Error filtering puntos de venta' });
  }
};

// Obtener un punto de venta por ID
export const getPuntoVentaById = async (req, res) => {
  try {
    const { id } = req.params;

    const punto = await PuntoVenta.findById(id)
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    if (!punto) {
      return res.status(404).json({ message: 'Punto de venta no encontrado' });
    }

    // Calcular online según controladores
    const now = Date.now();
    const ONLINE_THRESHOLD_MS = 5000;
    const tieneControladorOnline = punto.controladores?.some(
      ctrl => ctrl.last_time_active && (now - ctrl.last_time_active <= ONLINE_THRESHOLD_MS)
    );

    const safePunto = {
      ...punto.toObject(),
      online: tieneControladorOnline,
    };

    res.json(safePunto);
  } catch (error) {
    console.error('Error fetching punto de venta:', error);
    res.status(500).json({ message: 'Error fetching punto de venta' });
  }
};

// Crear nuevo punto de venta
export const addPuntoVenta = async (req, res) => {
  try {
    const puntoData = req.body;
    delete puntoData._id;

    // Validar cliente
    const cliente = await Client.findById(puntoData.cliente);
    if (!cliente) return res.status(400).json({ message: 'Cliente no válido' });

    // Validar ciudad
    const ciudad = await City.findById(puntoData.city);
    if (!ciudad) return res.status(400).json({ message: 'Ciudad no válida' });

    // Validar productos y controladores (opcional)
    if (puntoData.productos?.length) {
      const productos = await Product.find({ _id: { $in: puntoData.productos } });
      if (productos.length !== puntoData.productos.length) {
        return res.status(400).json({ message: 'Uno o más productos no existen' });
      }
    }

    if (puntoData.controladores?.length) {
      const controladores = await Controller.find({ _id: { $in: puntoData.controladores } });
      if (controladores.length !== puntoData.controladores.length) {
        return res.status(400).json({ message: 'Uno o más controladores no existen' });
      }
    }

    const nuevoPunto = new PuntoVenta(puntoData);
    await nuevoPunto.save();

    const populated = await nuevoPunto
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error adding punto de venta:', error);
    res.status(500).json({ message: 'Error adding punto de venta', error: error.message });
  }
};

// Actualizar punto de venta
export const updatePuntoVenta = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const punto = await PuntoVenta.findById(id);
    if (!punto) return res.status(404).json({ message: 'Punto de venta no encontrado' });

    punto.set(data);
    await punto.save();

    const updated = await punto
      .populate('cliente')
      .populate('city')
      .populate('productos')
      .populate('controladores');

    res.json(updated);
  } catch (error) {
    console.error('Error updating punto de venta:', error);
    res.status(500).json({ message: 'Error updating punto de venta' });
  }
};

// Eliminar punto de venta
export const deletePuntoVenta = async (req, res) => {
  try {
    const { id } = req.params;

    const punto = await PuntoVenta.findById(id);
    if (!punto) return res.status(404).json({ message: 'Punto de venta no encontrado' });

    await PuntoVenta.deleteOne({ _id: id });

    res.json({ message: 'Punto de venta eliminado', punto });
  } catch (error) {
    console.error('Error deleting punto de venta:', error);
    res.status(500).json({ message: 'Error deleting punto de venta' });
  }
};
