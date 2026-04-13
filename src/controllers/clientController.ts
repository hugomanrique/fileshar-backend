import { Request, Response } from 'express'
import Client from '../models/Client'
import { ParsedQs } from 'qs'

function escapeRegex(text: string) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}

// Helper para asegurar que el query param sea string
function getQueryParamAsString(
  value: string | ParsedQs | (string | ParsedQs)[] | undefined,
): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim()
  return ''
}

export const searchClients = async (req: Request, res: Response): Promise<void> => {
  const nombre = getQueryParamAsString(req.query.nombre)
  const telefono = getQueryParamAsString(req.query.telefono)
  const identificacion = getQueryParamAsString(req.query.identificacion)

  // Validación: al menos uno requerido
  if (!nombre && !telefono && !identificacion) {
    res.status(400).json({
      message: 'Debe enviar nombre, teléfono o identificación para buscar',
    })
    return
  }

  const orConditions: any[] = []

  if (nombre) {
    orConditions.push({
      nombre: { $regex: new RegExp(escapeRegex(nombre), 'i') },
    })
  }

  if (telefono) {
    orConditions.push({
      celular: { $regex: new RegExp(escapeRegex(telefono), 'i') },
    })
  }

  if (identificacion) {
    orConditions.push({
      identificacion: { $regex: new RegExp(escapeRegex(identificacion), 'i') },
    })
  }

  try {
    const clients = await Client.find({ $or: orConditions })
    res.status(200).json(clients)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({
      message: 'Error buscando clientes',
      error: err.message,
    })
  }
}
