import { Request, Response } from 'express'
import Client, { IClient } from '../models/Client'
import File from '../models/File'
import busboy from 'busboy'
import path from 'path'
import fs from 'fs'
import { getIO } from '../socket/socket'

interface UploadBody {
  cliente: string
  identificacion?: string
  email?: string
  telefono?: string
  copias?: string
  maquina?: string
  observaciones?: string
  tamanio?: string
  metros?: string | number
  reposicion?: boolean
  basePrice?: number
  valor?: number
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
        reposicion,
        identificacion,
        email,
        telefono,
        copias,
        maquina,
        observaciones,
        metros,
        basePrice,
        valor,
      } = fields as UploadBody

      // Parse centimetros (actually meters now) safely
      const parsedMeters = metros ? parseFloat(metros.toString()) : 0

      // 1. Find or Create Client
      // Priority search by identificacion, then name
      let client = null
      // if (identificacion) {
      client = await Client.findOne({ celular: telefono?.trim() })
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
        })
        await client.save()
      } else {
        // Update existing client info if provided?
        if (email) client.email = email
        if (telefono) client.celular = telefono
        await client.save()
      }
      // Force date to be America/Bogotá time (stored as fake UTC)
      const now = new Date()
      const bogotaString = now.toLocaleString('en-US', {
        timeZone: 'America/Bogota',
      })
      const dateBogota = new Date(bogotaString + ' UTC')
      // console.log('Stored Date (Bogota as UTC):', dateBogota);
      const total =
        parsedMeters > 0
          ? (basePrice || 0) > 0
            ? Number(basePrice) * parsedMeters * Number(copias)
            : calculatePrice(parsedMeters, maquina, Number(copias))
          : 0
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
        reposicion: reposicion ? true : false,
        status: 'En proceso',
        code: code,
        basePrice: basePrice,
      })

      await newFile.save()

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
    const { estado, metodoPago } = req.body
    if (estado) {
      const updatedFile = await File.findByIdAndUpdate(
        id,
        {
          status: estado,
        },
        { new: true },
      )
      res.json(updatedFile)
    } else if (metodoPago) {
      const updatedFile = await File.findByIdAndUpdate(
        id,
        {
          metodoPago: metodoPago,
        },
        { new: true },
      )
      res.json(updatedFile)
    }
  } catch (error) {
    console.error('Update file error:', error)
    res.status(500).json({ message: 'Server error updating file' })
  }
}
