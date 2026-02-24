import ClientModel from '../models/postgres/client.model.js';

export const getClients = async (req, res) => {
  try {
    const clients = await ClientModel.find();
    res.status(200).json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Error al obtener clientes', error });
  }
};

export const getClientsById = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await ClientModel.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.status(200).json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ message: 'Error al obtener cliente', error });
  }
};

export const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    delete req.body._id;
    const updatedClient = await ClientModel.update(clientId, req.body);
    if (!updatedClient) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.status(200).json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Error al actualizar cliente', error });
  }
};

export const addClient = async (req, res) => {
  try {
    const clientData = req.body;
    const existing = clientData.email ? await ClientModel.findByEmail(clientData.email) : null;
    if (existing) {
      return res.status(409).json({ message: 'Este cliente ya existe' });
    }
    delete clientData._id;
    const newClient = await ClientModel.create(clientData);
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error adding client:', error);
    res.status(500).json({ message: 'Error al agregar cliente', error });
  }
};

export const saveAllClients = async (req, res) => {
  try {
    const clients = req.body;
    const created = await ClientModel.insertMany(clients);
    res.status(201).json(created);
  } catch (error) {
    console.error('Error saving clients:', error);
    res.status(500).json({ message: 'Error al guardar clientes', error });
  }
};

export const removeClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const deleted = await ClientModel.delete(clientId);
    if (!deleted) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.status(200).json({ message: 'Cliente eliminado' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Error al eliminar cliente', error });
  }
};
