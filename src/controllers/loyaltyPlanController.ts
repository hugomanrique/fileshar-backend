import { Request, Response } from 'express'
import LoyaltyPlan from '../models/LoyaltyPlan'
import LoyaltyRedemption from '../models/LoyaltyRedemption'
import Client from '../models/Client'

export const getLoyaltyPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = await LoyaltyPlan.find().sort({ puntos: 1 }).lean()
    res.status(200).json(plans)
  } catch (err: any) {
    console.error('Error fetching loyalty plans:', err)
    res.status(500).json({ message: 'Error obteniendo planes de fidelización', error: err.message })
  }
}

export const getLoyaltyRedemptions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const redemptions = await LoyaltyRedemption.find()
      .populate('cliente', 'nombre celular identificacion puntos')
      .populate('file', 'nombre code valor valorOriginal fecha status')
      .populate('plan', 'nombre puntos valor')
      .sort({ fecha: -1 })
      .limit(100)
      .lean()
    res.status(200).json(redemptions)
  } catch (err: any) {
    console.error('Error fetching loyalty redemptions:', err)
    res.status(500).json({ message: 'Error obteniendo historial de redenciones', error: err.message })
  }
}

export const getClientRedemptionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId } = req.params
    const client = await Client.findById(clientId)
    if (!client) {
      res.status(404).json({ message: 'Cliente no encontrado' })
      return
    }

    const now = new Date()
    const bogotaString = now.toLocaleString('en-US', {
      timeZone: 'America/Bogota',
    })
    const dateBogota = new Date(bogotaString + ' UTC')

    const startOfToday = new Date(dateBogota)
    startOfToday.setUTCHours(0, 0, 0, 0)
    const endOfToday = new Date(dateBogota)
    endOfToday.setUTCHours(23, 59, 59, 999)

    const todayRedemption = await LoyaltyRedemption.findOne({
      cliente: client._id,
      fecha: { $gte: startOfToday, $lte: endOfToday },
      status: 'Activo',
    }).populate('file', 'nombre code')

    res.status(200).json({
      redeemedToday: Boolean(todayRedemption),
      todayRedemption,
      puntos: client.puntos || 0,
    })
  } catch (err: any) {
    console.error('Error checking client redemption status:', err)
    res.status(500).json({ message: 'Error verificando estado de redención del cliente', error: err.message })
  }
}

export const createLoyaltyPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, puntos, valor } = req.body

    if (!nombre || !String(nombre).trim()) {
      res.status(400).json({ message: 'El nombre del plan es obligatorio' })
      return
    }
    const parsedPuntos = Number(puntos)
    const parsedValor = Number(valor)

    if (isNaN(parsedPuntos) || parsedPuntos <= 0) {
      res.status(400).json({ message: 'Los puntos a redimir deben ser mayores a 0' })
      return
    }
    if (isNaN(parsedValor) || parsedValor < 0) {
      res.status(400).json({ message: 'El valor representado debe ser un número válido' })
      return
    }

    const plan = new LoyaltyPlan({
      nombre: String(nombre).trim(),
      puntos: parsedPuntos,
      valor: parsedValor,
    })

    await plan.save()
    res.status(201).json(plan)
  } catch (err: any) {
    console.error('Error creating loyalty plan:', err)
    res.status(500).json({ message: 'Error creando plan de fidelización', error: err.message })
  }
}

export const updateLoyaltyPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { nombre, puntos, valor } = req.body

    const updateData: any = {}
    if (nombre !== undefined) updateData.nombre = String(nombre).trim()
    if (puntos !== undefined) updateData.puntos = Number(puntos)
    if (valor !== undefined) updateData.valor = Number(valor)

    const updated = await LoyaltyPlan.findByIdAndUpdate(id, updateData, { new: true })
    if (!updated) {
      res.status(404).json({ message: 'Plan de fidelización no encontrado' })
      return
    }

    res.status(200).json(updated)
  } catch (err: any) {
    console.error('Error updating loyalty plan:', err)
    res.status(500).json({ message: 'Error actualizando plan de fidelización', error: err.message })
  }
}

export const deleteLoyaltyPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const deleted = await LoyaltyPlan.findByIdAndDelete(id)
    if (!deleted) {
      res.status(404).json({ message: 'Plan de fidelización no encontrado' })
      return
    }
    res.status(200).json({ message: 'Plan eliminado correctamente' })
  } catch (err: any) {
    console.error('Error deleting loyalty plan:', err)
    res.status(500).json({ message: 'Error eliminando plan de fidelización', error: err.message })
  }
}

export const redeemLoyaltyPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { clientId } = req.body

    const plan = await LoyaltyPlan.findById(id)
    if (!plan) {
      res.status(404).json({ message: 'Plan de fidelización no encontrado' })
      return
    }

    const client = await Client.findById(clientId)
    if (!client) {
      res.status(404).json({ message: 'Cliente no encontrado' })
      return
    }

    const now = new Date()
    const bogotaString = now.toLocaleString('en-US', {
      timeZone: 'America/Bogota',
    })
    const dateBogota = new Date(bogotaString + ' UTC')

    const startOfToday = new Date(dateBogota)
    startOfToday.setUTCHours(0, 0, 0, 0)
    const endOfToday = new Date(dateBogota)
    endOfToday.setUTCHours(23, 59, 59, 999)

    const existingRedemptionToday = await LoyaltyRedemption.findOne({
      cliente: client._id,
      fecha: { $gte: startOfToday, $lte: endOfToday },
      status: 'Activo',
    })

    if (existingRedemptionToday) {
      res.status(400).json({
        message: 'El cliente ya redimió un plan de fidelización el día de hoy (máximo 1 por día)',
      })
      return
    }

    const currentPoints = Number(client.puntos) || 0
    if (currentPoints < plan.puntos) {
      res.status(400).json({
        message: `El cliente tiene ${currentPoints} puntos y este plan requiere ${plan.puntos} puntos`,
      })
      return
    }

    client.puntos = currentPoints - plan.puntos
    await client.save()

    const redemption = new LoyaltyRedemption({
      cliente: client._id,
      plan: plan._id,
      nombrePlan: plan.nombre,
      puntosRedimidos: plan.puntos,
      valorDescuento: plan.valor,
      valorOriginalTrabajo: plan.valor * 2,
      valorFinalTrabajo: plan.valor,
      fecha: dateBogota,
      status: 'Activo',
    })
    await redemption.save()

    res.status(200).json({
      message: `Plan "${plan.nombre}" redimido exitosamente`,
      client,
      plan,
      redemption,
    })
  } catch (err: any) {
    console.error('Error redeeming loyalty plan:', err)
    res.status(500).json({ message: 'Error redimiendo plan de fidelización', error: err.message })
  }
}
