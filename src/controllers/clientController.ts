import { Request, Response } from 'express';
import Client from '../models/Client';

export const searchClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre } = req.query;

    if (!nombre) {
      res.status(400).json({ message: 'El campo nombre es requerido' });
      return;
    }

    // Case-insensitive regex search
    const clients = await Client.find({
      nombre: { $regex: nombre, $options: 'i' }
    } as any);

    res.json(clients);
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
