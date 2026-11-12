import { Request, Response } from 'express'
import Client, { IClient } from '../models/Client'
import File from '../models/File'
import LoyaltyPlan from '../models/LoyaltyPlan'
import LoyaltyRedemption from '../models/LoyaltyRedemption'
import busboy from 'busboy'
import path from 'path'
import fs from 'fs'
import { getIO } from '../socket/socket'

interface UploadBody {
  cliente: string
  clienteId?: string
  identificacion?: string
  email?: string
  telefono?: string
  copias?: string
  maquina?: string
  observaciones?: string
  tamanio?: string
  metros?: string | number
  reposicion?: boolean | string
  seRealizoMontaje?: boolean | string
  montaje?: boolean | string
  valorMontaje?: number | string
  basePrice?: number
  valor?: number
  valorOriginal?: number | string
  loyaltyPlanId?: string
}

const calculatePriceDTFTEXTIL = (meters: number, copies: number): number => {
  const centimeters = meters * 100 * copies
  if (centimeters <= 20) {
    return 7000
  } else if (centimeters < 75) {
    return centimeters * 300 // 300 per cm if < 100cm
  } else if (centimeters > 1000 && centimeters < 2000) {
    // > 10 meters (1000cm), price is 18,000 per meter
    return meters * 20000
  } else if (centimeters > 2000) {
    // > 10 meters (1000cm), price is 18,000 per meter
    return meters * 18000
  } else {
    // Default: 22,000 per meter
    if (centimeters > 75 && centimeters < 99) {
      return 22000
    }
    return meters * 22000
  }
}

const calculatePriceDTFUV = (meters: number, copies: number): number => {
  // Logic copied from DTF Textil as requested, values to be modified later
  const centimeters = meters * 100 * copies
  if (centimeters <= 20) {
    return 25000
  } else if (centimeters > 20 && centimeters <= 50) {
    return centimeters * 1250
  } else if (centimeters > 50 && centimeters <= 75) {
    return centimeters * 850
  } else if (centimeters > 6000) {
    return meters * 65000
  } else {
    if (centimeters > 75 && centimeters < 99) {
      return 70000
    }
    return meters * 70000
  }
}

const calculatePricePlotter = (meters: number, copies: number): number => {
  // Logic copied from DTF Textil as requested, values to be modified later
  if (meters > 10) {
    return meters * 12000 * copies
  }
  return meters * 15000 * copies
}

const calculatePrice = (meters: number, maquina: string = '', copies: number): number => {
  const machineUpper = maquina.toUpperCase()
  if (machineUpper.includes('UV')) {
    return calculatePriceDTFUV(meters, copies)
  } else if (machineUpper.includes('PLOTTER')) {
    return calculatePricePlotter(meters, copies)
  } else {
    // Default to DTF TEXTIL
    return calculatePriceDTFTEXTIL(meters, copies)
  }
}

export const handleUpload = async (req: Request, res: Response): Promise<void> => {
  const bb = busboy({
    headers: req.headers,
    limits: {
      fileSize: 6 * 1024 * 1024 * 1024, // 6 GB
    },
  })
  const fields: any = {}
  let fileData: any = null

  bb.on('file', (name, file, info) => {
    const { filename, mimeType } = info
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const saveName = name + '-' + uniqueSuffix + path.extname(filename)
    const saveTo = path.join('uploads/', saveName)

    fileData = {
      originalname: filename,
      filename: saveName,
      size: 0,
    }

    const writeStream = fs.createWriteStream(saveTo)
    file.pipe(writeStream)

    file.on('data', (data) => {
      fileData.size += data.length
    })
  })

  bb.on('field', (name, val) => {
    fields[name] = val
  })

  bb.on('close', async () => {
    if (!fileData) {
      res.status(400).json({ message: 'No file uploaded' })
      return
    }

    try {
      const {
        cliente,
        clienteId,
        reposicion,
        seRealizoMontaje,
        montaje,
        valorMontaje,
        identificacion,
        email,
        telefono,
        copias,
        maquina,
        observaciones,
        metros,
        basePrice,
        valor,
        valorOriginal,
        loyaltyPlanId,
      } = fields as UploadBody

      // Parse centimetros (actually meters now) safely
      const parsedMeters = metros ? parseFloat(metros.toString()) : 0

      // 1. Find or Create Client
      const sanitizedTelefono = telefono != null ? String(telefono).replace(/\s+/g, '') : undefined
      const sanitizedIdentificacion = identificacion != null ? String(identificacion).replace(/\s+/g, '') : undefined

      let client = null
      if (clienteId) {
        client = await Client.findById(clienteId)
      }
      if (!client && sanitizedTelefono) {
        client = await Client.findOne({ celular: sanitizedTelefono })
      }
      if (!client && sanitizedIdentificacion) {
        client = await Client.findOne({ identificacion: sanitizedIdentificacion })
      }
      if (!client && cliente) {
        const cleanName = cliente.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
        client = await Client.findOne({ nombre: { $regex: new RegExp(`^${cleanName}$`, 'i') } })
      }

      if (!client) {
        client = new Client({
          nombre: cliente || 'Unknown Client',
          identificacion: sanitizedIdentificacion,
          email,
          celular: sanitizedTelefono,
          puntos: 0,
        })
        await client.save()
      } else {
        // Update existing client info if provided?
        if (email) client.email = email
        if (sanitizedTelefono) client.celular = sanitizedTelefono
        if (sanitizedIdentificacion) client.identificacion = sanitizedIdentificacion
        if (typeof client.puntos !== 'number') client.puntos = 0
        await client.save()
      }
      // Force date to be America/Bogotá time (stored as fake UTC)
      const now = new Date()
      const bogotaString = now.toLocaleString('en-US', {
        timeZone: 'America/Bogota',
      })
      const dateBogota = new Date(bogotaString + ' UTC')
      // console.log('Stored Date (Bogota as UTC):', dateBogota);

      const isMontaje =
        seRealizoMontaje === 'true' ||
        seRealizoMontaje === true ||
        montaje === 'true' ||
        montaje === true
      const parsedValorMontaje = isMontaje
        ? parseFloat(String(valorMontaje || 0)) || 0
        : 0

      const baseCalculated =
        parsedMeters > 0
          ? (basePrice || 0) > 0
            ? Number(basePrice) * parsedMeters * Number(copias)
            : calculatePrice(parsedMeters, maquina, Number(copias))
          : 0

      const rawOriginalTotal =
        valorOriginal != null && !isNaN(Number(valorOriginal)) && Number(valorOriginal) > 0
          ? Number(valorOriginal)
          : valor != null && !isNaN(Number(valor)) && Number(valor) > 0 && !loyaltyPlanId
            ? Number(valor)
            : baseCalculated + parsedValorMontaje

      const isReposicion = reposicion === 'true' || reposicion === true

      let appliedPlan: any = null
      let descuentoFidelizacion = 0
      let puntosRedimidos = 0

      if (loyaltyPlanId && String(loyaltyPlanId).trim() !== '') {
        appliedPlan = await LoyaltyPlan.findById(String(loyaltyPlanId).trim())
        if (!appliedPlan) {
          res.status(400).json({ message: 'El plan de fidelización seleccionado no existe' })
          return
        }

        // Verificar que el cliente tenga puntos suficientes
        if ((client.puntos || 0) < appliedPlan.puntos) {
          res.status(400).json({
            message: `El cliente tiene ${client.puntos || 0} puntos y el plan requiere ${appliedPlan.puntos} puntos`,
          })
          return
        }

        // Verificar que el valor del plan no supere el 25% efectivo del valor de la compra
        const maxDiscountAllowed = rawOriginalTotal * 0.25
        if (appliedPlan.valor > maxDiscountAllowed) {
          res.status(400).json({
            message: `El descuento del plan ($${appliedPlan.valor}) no puede superar el 25% efectivo del valor de la compra ($${maxDiscountAllowed})`,
          })
          return
        }

        // Verificar que el cliente no haya redimido otro plan en el mismo día (Bogotá)
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
            message: 'El cliente ya redimió un plan de fidelización el día de hoy (máximo 1 plan por día)',
          })
          return
        }

        descuentoFidelizacion = appliedPlan.valor
        puntosRedimidos = appliedPlan.puntos
      }

      const total = appliedPlan
        ? Math.max(0, rawOriginalTotal - descuentoFidelizacion)
        : rawOriginalTotal

      // Valor exclusivo de la impresión (descontando el montaje) para cálculo de puntos
      const valorImpresion = Math.max(0, rawOriginalTotal - parsedValorMontaje)

      // Solo se asignan puntos sobre el valor de impresión (sin montaje), si NO es reposición y NO se usó un plan
      const puntosOtorgados =
        isReposicion || appliedPlan ? 0 : Math.max(0, Math.floor(valorImpresion / 1000))

      // Generate Unique 4-digit Code
      let code = ''
      let isUnique = false
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      while (!isUnique) {
        code = Math.floor(1000 + Math.random() * 9000).toString()
        const existing = await File.findOne({ code, createdAt: { $gte: weekAgo } })
        if (!existing) {
          isUnique = true
        }
      }

      // 2. Create File Record
      const newFile = new File({
        nombre: fileData.originalname, // Using filename as File Name
        ubicacion: fileData.filename,
        fecha: dateBogota,
        tamanio: fileData.size.toString(),
        cliente: client._id,
        copias: copias ? parseInt(copias, 10) : 1,
        impresora: maquina,
        observaciones: observaciones,
        metros: parsedMeters,
        valor: total,
        valorOriginal: rawOriginalTotal,
        reposicion: isReposicion,
        seRealizoMontaje: isMontaje,
        valorMontaje: parsedValorMontaje,
        status: 'En proceso',
        code: code,
        basePrice: basePrice,
        puntosOtorgados: puntosOtorgados,
        planRedimido: appliedPlan ? appliedPlan._id : undefined,
        nombrePlanRedimido: appliedPlan ? appliedPlan.nombre : undefined,
        puntosRedimidos: puntosRedimidos,
        descuentoFidelizacion: descuentoFidelizacion,
        tuvoDescuento: Boolean(appliedPlan && descuentoFidelizacion > 0),
      })

      await newFile.save()

      if (appliedPlan) {
        client.puntos = Math.max(0, (client.puntos || 0) - puntosRedimidos)
        await client.save()

        const redemption = new LoyaltyRedemption({
          cliente: client._id,
          file: newFile._id,
          plan: appliedPlan._id,
          nombrePlan: appliedPlan.nombre,
          puntosRedimidos: puntosRedimidos,
          valorDescuento: descuentoFidelizacion,
          valorOriginalTrabajo: rawOriginalTotal,
          valorFinalTrabajo: total,
          fecha: dateBogota,
          status: 'Activo',
        })
        await redemption.save()
      } else if (puntosOtorgados > 0) {
        client.puntos = (client.puntos || 0) + puntosOtorgados
        await client.save()
      }

      // console.log('File Saved:', newFile);
      // Notificas a todos los clientes que algo cambió
      getIO().emit('files:updated', {
        reason: 'new_file',
        file: newFile,
      })

      res.json({
        message: 'File uploaded and saved successfully',
        file: newFile,
        client: client,
        code: code, // Return the code explicitly if needed, though it's in the file object
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ message: 'Server error during upload' })
    }
  })

  req.pipe(bb)
}

export const getFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha, cliente, maquina, estado } = req.query

    if (!fecha) {
      res.status(400).json({ message: 'Fecha parameter is required (YYYY-MM-DD)' })
      return
    }

    // Parse date range for the entire day
    // Parse date range for the entire day using UTC to match saved "Bogotá as UTC" dates
    const startOfDay = new Date(fecha as string)
    startOfDay.setUTCHours(0, 0, 0, 0)

    const endOfDay = new Date(fecha as string)
    endOfDay.setUTCHours(23, 59, 59, 999)

    if (isNaN(startOfDay.getTime())) {
      res.status(400).json({ message: 'Invalid date format' })
      return
    }

    // Base query
    const query: any = {
      fecha: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }

    // Filter by Client (Name or Phone)
    if (cliente) {
      const clientRegex = new RegExp(cliente as string, 'i') // Case insensitive
      const clients = await Client.find({
        $or: [{ nombre: clientRegex }, { celular: clientRegex }],
      }).select('_id')

      const clientIds = clients.map((c) => c._id)

      // If we provided a client filter but found no matching clients,
      // we should probably return empty results or match nothing.
      if (clientIds.length > 0) {
        query.cliente = { $in: clientIds }
      } else {
        // Force empty result if client filter was used but no client found
        res.json([])
        return
      }
    }

    // Filter by Machine (impresora)
    if (maquina) {
      query.impresora = new RegExp(maquina as string, 'i')
    }

    // Filter by Status (estado)
    if (estado) {
      query.status = estado
    }

    const files = await File.find(query).populate('cliente').sort({ fecha: -1 })

    res.json(files)
  } catch (error) {
    console.error('Get files error:', error)
    res.status(500).json({ message: 'Server error fetching files' })
  }
}

export const updateFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { estado, metodoPago, seRealizoMontaje, valorMontaje } = req.body
    const updateData: any = {}
    if (estado !== undefined) updateData.status = estado
    if (metodoPago !== undefined) updateData.metodoPago = metodoPago
    if (seRealizoMontaje !== undefined) updateData.seRealizoMontaje = seRealizoMontaje
    if (valorMontaje !== undefined) updateData.valorMontaje = valorMontaje

    const existingFile = await File.findById(id)
    if (!existingFile) {
      res.status(404).json({ message: 'File not found' })
      return
    }

    if (estado !== undefined && estado !== existingFile.status) {
      // Si pasa a Error
      if (estado === 'Error') {
        if ((existingFile.puntosOtorgados || 0) > 0 && existingFile.cliente) {
          const client = await Client.findById(existingFile.cliente)
          if (client) {
            client.puntos = Math.max(0, (client.puntos || 0) - existingFile.puntosOtorgados)
            await client.save()
          }
          updateData.puntosOtorgados = 0
        }
        // Si el archivo tenía puntos redimidos y pasa a Error, devolver los puntos y marcar redención como Revertido
        if ((existingFile.puntosRedimidos || 0) > 0 && existingFile.cliente) {
          const activeRedemption = await LoyaltyRedemption.findOne({
            file: existingFile._id,
            status: 'Activo',
          })
          if (activeRedemption) {
            activeRedemption.status = 'Revertido'
            await activeRedemption.save()
            const client = await Client.findById(existingFile.cliente)
            if (client) {
              client.puntos = (client.puntos || 0) + (existingFile.puntosRedimidos || 0)
              await client.save()
            }
          }
        }
      } else if (existingFile.status === 'Error' && estado !== 'Error' && !existingFile.reposicion) {
        if (existingFile.planRedimido && (existingFile.puntosRedimidos || 0) > 0) {
          const revertedRedemption = await LoyaltyRedemption.findOne({
            file: existingFile._id,
            status: 'Revertido',
          })
          if (revertedRedemption && existingFile.cliente) {
            const client = await Client.findById(existingFile.cliente)
            if (client && (client.puntos || 0) >= (existingFile.puntosRedimidos || 0)) {
              client.puntos = (client.puntos || 0) - (existingFile.puntosRedimidos || 0)
              await client.save()
              revertedRedemption.status = 'Activo'
              await revertedRedemption.save()
            }
          }
          updateData.puntosOtorgados = 0
        } else {
          // Si sale de Error a un estado válido y no tenía plan redimido ni es reposición, volver a otorgar puntos solo sobre impresión (sin montaje)
          const montajeExistente = existingFile.seRealizoMontaje ? (existingFile.valorMontaje || 0) : 0
          const valorImpresionExistente = Math.max(0, (existingFile.valor || 0) - montajeExistente)
          const puntosRecuperados = Math.max(0, Math.floor(valorImpresionExistente / 1000))
          if (puntosRecuperados > 0 && existingFile.cliente) {
            const client = await Client.findById(existingFile.cliente)
            if (client) {
              client.puntos = (client.puntos || 0) + puntosRecuperados
              await client.save()
            }
          }
          updateData.puntosOtorgados = puntosRecuperados
        }
      }
    }

    const updatedFile = await File.findByIdAndUpdate(id, updateData, { new: true }).populate('cliente')

    if (estado !== undefined && estado !== existingFile.status) {
      getIO().emit('files:updated', {
        reason: 'status_changed',
        file: updatedFile,
      })
    }

    res.json(updatedFile)
  } catch (error) {
    console.error('Update file error:', error)
    res.status(500).json({ message: 'Server error updating file' })
  }
}
