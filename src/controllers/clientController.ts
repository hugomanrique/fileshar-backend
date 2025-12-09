import { Request, Response } from 'express';
import Client from '../models/Client';
import { ParsedQs } from 'qs';

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Helper para asegurar que el query param sea string
function getQueryParamAsString(
  value: string | ParsedQs | (string | ParsedQs)[] | undefined,
): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

export const searchClients = async (req: Request, res: Response): Promise<void> => {
  const nombre = getQueryParamAsString(req.query.nombre);
  const telefono = getQueryParamAsString(req.query.telefono);

  // Validación: al menos uno requerido
  if (!nombre && !telefono) {
    res.status(400).json({
      message: 'Debe enviar nombre o teléfono para buscar',
    });
  }

  const orConditions: any[] = [];

  if (nombre) {
    orConditions.push({
      celular: { $regex: new RegExp(escapeRegex(nombre), 'i') },
    });
  }

  if (telefono) {
    orConditions.push({
      celular: { $regex: new RegExp(escapeRegex(telefono), 'i') },
    });
  }

  try {
    const clients = await Client.find({ $or: orConditions });
    res.json(clients);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({
      message: 'Error buscando clientes',
      error: err.message,
    });
  }
};
