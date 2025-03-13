import Client from '../models/client.model.js';
// Controller to get all clients
export const getClients = async (req, res) => {
  try {
    const clients = await Client.find();
    res.status(200).json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Error al obtener clientes', error });
  }
};

// Controller to get a specific client by its ID
export const getClientsById = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await
    Client
    .findOne({ _id: clientId });
    if (!client) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.status(200).json(client);
  }
  catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ message: 'Error al obtener cliente', error });
  }
}

// Controller to update a client by its ID
export const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    delete req.body._id;
    const updatedClient = await Client
    .findOneAndUpdate({ _id: clientId }, req.body, { new: true });
    if (!updatedClient) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.status(200).json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Error al actualizar cliente', error });
  }
}

// Add new client
export const addClient = async (req, res) => {
  try {
    const clientData = req.body;
    const currentClient = await Client.findOne({name: clientData.name});
    if (currentClient) {
      return res.status(409).json({ message: 'Este cliente ya existe' });
    }
    delete clientData._id;
    const newClient = new Client(clientData);
    await newClient.save();
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error adding client:', error);
    res.status(500).json({ message: 'Error al agregar cliente', error });
  }
};

// Controller to save all clients
export const saveAllClients = async (req, res) => {
  try {
    const clients = req.body;
    await Client.insertMany(clients);
    res.status(201).json(clients);
  } catch (error) {
    console.error('Error saving clients:', error);
    res.status(500).json({ message: 'Error al guardar clientes', error });
  }
};

// Controller to remove a client by its ID
export const removeClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const deletedClient = await Client.findOneAndDelete({ _id: clientId });
    if (!deletedClient) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    res.status(200).json(deletedClient);
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Error al eliminar cliente', error });
  }
}