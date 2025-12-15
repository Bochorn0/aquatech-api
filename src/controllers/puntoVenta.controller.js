import PuntoVenta from '../models/puntoVenta.model.js';
import Client from '../models/client.model.js';
import Product from '../models/product.model.js';
import Controller from '../models/controller.model.js';
import City from '../models/city.model.js';
import { generateProductLogsReport } from './report.controller.js';
import moment from 'moment';

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

    // 🧩 Lista configurable de productos especiales (ósmosis, etc.)
    const PRODUCTOS_ESPECIALES = [
      'ebf9738480d78e0132gnru',
      'ebea4ffa2ab1483940nrqn'
      // puedes agregar más IDs aquí
    ];

    // Aplicar la lógica de conversión para productos especiales y agregar histórico a productos Nivel
    const productosModificados = await Promise.all(punto.productos?.map(async (product) => {
      if (!product?.status) return product;

      // Convertir a objeto plano para poder agregar propiedades
      const productObj = product.toObject ? product.toObject() : { ...product };

      // Aplicar transformaciones de status
      productObj.status = productObj.status.map(stat => {
        const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
        const flujos_total_codes = ["flowrate_total_1", "flowrate_total_2"];
        const arrayCodes = ["flowrate_speed_1", "flowrate_speed_2"];

        const esEspecial = PRODUCTOS_ESPECIALES.includes(productObj.id);

        // 🔹 Caso especial: productos de ósmosis u otros con calibración diferente
        if (esEspecial && flujos_codes.includes(stat.code)) {
          stat.value = (stat.value * 1.6).toFixed(2);
          if (flujos_total_codes.includes(stat.code)) {
            stat.value = (stat.value / 10).toFixed(2);
          }
        }

        // 🔹 Conversión general para flujos instantáneos
        if (arrayCodes.includes(stat.code) && stat.value > 0) {
          stat.value = (stat.value / 10).toFixed(2);
        }

        return stat;
      });

      // 🔹 Si es producto tipo Nivel, agregar histórico del día actual
      if (productObj.product_type === 'Nivel') {
        try {
          const today = moment().format('YYYY-MM-DD');
          // Usar último valor en lugar de promedio para la gráfica del punto de venta detalle
          const reportResult = await generateProductLogsReport(productObj.id, today, product, true);
          
          if (reportResult.success) {
            // Filtrar solo los datos esenciales: hora, total_logs y estadísticas
            const historicoSimplificado = {
              product: reportResult.data.product,
              date: reportResult.data.date,
              total_logs: reportResult.data.total_logs,
              promedio_general: reportResult.data.promedio_general, // Incluir promedio general del backend
              hours_with_data: reportResult.data.hours_with_data.map(hourData => ({
                hora: hourData.hora,
                total_logs: hourData.total_logs,
                estadisticas: hourData.estadisticas
              }))
            };
            
            productObj.historico = historicoSimplificado;
            console.log(`📊 Histórico agregado para producto Nivel: ${productObj.id} (${historicoSimplificado.hours_with_data.length} horas)`);
            if (historicoSimplificado.promedio_general !== null && historicoSimplificado.promedio_general !== undefined) {
              console.log(`📊 Promedio general incluido: ${historicoSimplificado.promedio_general}%`);
            }
          } else {
            console.warn(`⚠️ No se pudo generar histórico para ${productObj.id}:`, reportResult.error);
            productObj.historico = null;
          }
        } catch (error) {
          console.error(`❌ Error generando histórico para ${productObj.id}:`, error.message);
          productObj.historico = null;
        }
      }

      return productObj;
    }) || []);

    const safePunto = {
      ...punto.toObject(),
      productos: productosModificados,
      online: tieneControladorOnline,
    };

    res.json(safePunto);
  } catch (error) {
    console.error('Error fetching punto de venta:', error);
    res.status(500).json({ message: 'Error fetching punto de venta' });
  }
};

// Crear nuevo punto de venta
// Crear nuevo punto de venta
export const addPuntoVenta = async (req, res) => {
  try {
    const puntoData = req.body;
    delete puntoData._id;

    // ✅ Validar cliente
    const cliente = await Client.findById(puntoData.cliente);
    if (!cliente) return res.status(400).json({ message: 'Cliente no válido' });

    // ✅ Validar ciudad
    const ciudad = await City.findById(puntoData.city);
    if (!ciudad) return res.status(400).json({ message: 'Ciudad no válida' });

    // ✅ Validar productos y controladores (opcionales)
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

    // ✅ Crear nuevo registro
    const nuevoPunto = new PuntoVenta(puntoData);
    await nuevoPunto.save();

    // ✅ Popular relaciones correctamente (en una sola llamada)
    await nuevoPunto.populate([
      { path: 'cliente', select: 'name email phone' },
      { path: 'city', select: 'city state' },
      { path: 'productos', select: 'name product_type' },
      { path: 'controladores', select: 'name ip online' },
    ]);

    res.status(201).json(nuevoPunto);
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

    const updated = await PuntoVenta.findById(id)
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
