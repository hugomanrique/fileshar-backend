import { Request, Response } from 'express'
import Client from '../models/Client'
import Order from '../models/Order'
import File from '../models/File'
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
    const clients = await Client.find()
    res.status(200).json(clients)
    return
  }

  const orConditions: any[] = []

  if (nombre) {
    orConditions.push({
      nombre: { $regex: new RegExp(escapeRegex(nombre), 'i') },
    })
  }

  if (telefono) {
    const sanitizedTelefono = telefono.replace(/\s+/g, '')
    orConditions.push({
      celular: { $regex: new RegExp(escapeRegex(sanitizedTelefono), 'i') },
    })
  }

  if (identificacion) {
    const sanitizedIdentificacion = identificacion.replace(/\s+/g, '')
    orConditions.push({
      identificacion: { $regex: new RegExp(escapeRegex(sanitizedIdentificacion), 'i') },
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

export const updateClient = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const data = { ...req.body }

  if (data.identificacion) data.identificacion = String(data.identificacion).replace(/\s+/g, '')
  if (data.celular) data.celular = String(data.celular).replace(/\s+/g, '')

  try {
    const client = await Client.findByIdAndUpdate(id, data, { new: true })
    if (!client) {
      res.status(404).json({ message: 'Cliente no encontrado' })
      return
    }
    res.status(200).json(client)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({
      message: 'Error actualizando cliente',
      error: err.message,
    })
  }
}

export const unifyClients = async (req: Request, res: Response): Promise<void> => {
  const { targetData, idsToMerge } = req.body

  if (!targetData || !idsToMerge || !Array.isArray(idsToMerge) || idsToMerge.length < 2) {
    res.status(400).json({ message: 'Se requieren al menos 2 clientes para unificar' })
    return
  }

  try {
    if (targetData.identificacion) {
      targetData.identificacion = String(targetData.identificacion).replace(/\s+/g, '').trim()
    }
    if (targetData.celular) {
      targetData.celular = String(targetData.celular).replace(/\s+/g, '').trim()
    }

    // Crear el nuevo cliente unificado (el frontend no envía _id)
    delete targetData._id
    const targetClient = new Client(targetData)
    await targetClient.save()
    const targetId = targetClient._id

    // Reasignar órdenes
    await Order.updateMany({ cliente: { $in: idsToMerge } }, { $set: { cliente: targetId } })

    // Reasignar archivos
    await File.updateMany({ cliente: { $in: idsToMerge } }, { $set: { cliente: targetId } })

    // Eliminar los clientes unificados
    await Client.deleteMany({ _id: { $in: idsToMerge } })

    res.status(200).json({
      message: 'Clientes unificados exitosamente',
      client: targetClient,
    })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ message: 'Error unificando clientes', error: err.message })
  }
}
