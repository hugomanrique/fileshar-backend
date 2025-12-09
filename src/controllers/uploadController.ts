import { Request, Response } from 'express';
import Client, { IClient } from '../models/Client';
import File from '../models/File';

interface UploadBody {
  cliente: string;
  identificacion?: string;
  email?: string;
  telefono?: string;
  copias?: string;
  maquina?: string;
  comentarios?: string;
  tamanio?: string;
  metros?: string | number;
}

const calculatePrice = (meters: number): number => {
  const centimeters = meters * 100;
  if (centimeters < 100) {
    return centimeters * 800; // 800 per cm if < 100cm
  } else if (centimeters > 1000) {
    // > 10 meters (1000cm), price is 18,000 per meter
    return meters * 18000;
  } else {
    // Default: 22,000 per meter
    return meters * 22000;
  }
};

export const handleUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const { cliente, identificacion, email, telefono, copias, maquina, comentarios, metros } =
      req.body as UploadBody;

    // Parse centimetros (actually meters now) safely
    const parsedMeters = metros ? parseFloat(metros.toString()) : 0;

    // 1. Find or Create Client
    // Priority search by identificacion, then name
    let client = null;
    // if (identificacion) {
    client = await Client.findOne({ celular: telefono?.trim() });
    // }

    if (!client && cliente) {
      // If not found by ID, try finding by name if ID wasn't exclusive?
      // Or just create new if ID provided but not found.
      // Let's assume if ID is provided, we expect valid match or new client.
      // If no ID, we might search by name? Safer to create new one or unique constraint.
      // For simplicity, if not found, create.
    }

    if (!client) {
      client = new Client({
        nombre: cliente || 'Unknown Client',
        identificacion,
        email,
        celular: telefono,
      });
      await client.save();
    } else {
      // Update existing client info if provided?
      if (email) client.email = email;
      if (telefono) client.celular = telefono;
      await client.save();
    }

    // 2. Create File Record
    const newFile = new File({
      nombre: req.file.originalname, // Using filename as File Name
      ubicacion: req.file.filename,
      // fecha: default now
      // status: default pending
      tamanio: req.file.size.toString(),
      cliente: client._id,
      copias: copias ? parseInt(copias, 10) : 1,
      impresora: maquina,
      observaciones: comentarios,
      metros: parsedMeters,
      valor: parsedMeters > 0 ? calculatePrice(parsedMeters) : 0,
    });

    await newFile.save();

    console.log('File Saved:', newFile);

    res.json({
      message: 'File uploaded and saved successfully',
      file: newFile,
      client: client,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error during upload' });
  }
};

export const getFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha, cliente, maquina, estado } = req.query;

    if (!fecha) {
      res.status(400).json({ message: 'Fecha parameter is required (YYYY-MM-DD)' });
      return;
    }

    // Parse date range for the entire day
    const startOfDay = new Date(fecha as string);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(fecha as string);
    endOfDay.setHours(23, 59, 59, 999);

    if (isNaN(startOfDay.getTime())) {
      res.status(400).json({ message: 'Invalid date format' });
      return;
    }

    // Base query
    const query: any = {
      fecha: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    // Filter by Client (Name or Phone)
    if (cliente) {
      const clientRegex = new RegExp(cliente as string, 'i'); // Case insensitive
      const clients = await Client.find({
        $or: [{ nombre: clientRegex }, { celular: clientRegex }],
      }).select('_id');

      const clientIds = clients.map((c) => c._id);

      // If we provided a client filter but found no matching clients,
      // we should probably return empty results or match nothing.
      if (clientIds.length > 0) {
        query.cliente = { $in: clientIds };
      } else {
        // Force empty result if client filter was used but no client found
        res.json([]);
        return;
      }
    }

    // Filter by Machine (impresora)
    if (maquina) {
      query.impresora = new RegExp(maquina as string, 'i');
    }

    // Filter by Status (estado)
    if (estado) {
      query.status = estado;
    }

    const files = await File.find(query).populate('cliente');

    res.json(files);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ message: 'Server error fetching files' });
  }
};
