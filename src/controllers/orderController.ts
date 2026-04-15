import { Request, Response } from 'express'
import busboy from 'busboy'
import path from 'path'
import fs from 'fs'
import Client from '../models/Client'
import Order from '../models/Order'

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const bb = busboy({
    headers: req.headers,
    limits: {
      fileSize: 6 * 1024 * 1024 * 1024, // 6 GB
    },
  })

  const fields: any = {}
  const filesData: any = {}

  bb.on('file', (name, file, info) => {
    const { filename } = info
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const saveName = uniqueSuffix + '-' + filename
    const saveTo = path.join('uploads/', saveName)

    filesData[name] = {
      originalname: filename,
      filename: saveName,
      path: saveName,
    }

    const writeStream = fs.createWriteStream(saveTo)
    file.pipe(writeStream)
  })

  bb.on('field', (name, val) => {
    fields[name] = val
  })

  bb.on('close', async () => {
    try {
      let payload: any = {}
      let productosData: any[] = []
      let clienteData: any = {}

      // If they send data as strings, we parse it
      if (fields.payload) {
        payload = JSON.parse(fields.payload)
        clienteData = payload.cliente || {}
        productosData = payload.productos || []
      } else {
        if (fields.cliente) clienteData = JSON.parse(fields.cliente)
        if (fields.productos) productosData = JSON.parse(fields.productos)
      }

      // 1. Process Client
      let client = null
      const sanitizedTelefono = clienteData.telefono != null ? String(clienteData.telefono).replace(/\s+/g, '') : undefined
      const sanitizedIdentificacion = clienteData.identificacion != null ? String(clienteData.identificacion).replace(/\s+/g, '') : undefined

      if (sanitizedTelefono) {
        client = await Client.findOne({ celular: sanitizedTelefono })
      } else if (sanitizedIdentificacion) {
        client = await Client.findOne({ identificacion: sanitizedIdentificacion })
      }

      if (!client) {
        client = new Client({
          nombre: clienteData.nombre || 'Unknown Client',
          identificacion: sanitizedIdentificacion,
          email: clienteData.correo, // Map correo to email
          celular: sanitizedTelefono,
          direccion: clienteData.direccion,
          tipo: clienteData.tipo,
        })
        await client.save()
      } else {
        // Update client info if it changed
        let updated = false
        if (clienteData.correo && client.email !== clienteData.correo) {
          client.email = clienteData.correo
          updated = true
        }
        if (clienteData.direccion && client.direccion !== clienteData.direccion) {
          client.direccion = clienteData.direccion
          updated = true
        }
        if (sanitizedIdentificacion && client.identificacion !== sanitizedIdentificacion) {
          client.identificacion = sanitizedIdentificacion
          updated = true
        }
        if (clienteData.tipo && client.tipo !== clienteData.tipo) {
          client.tipo = clienteData.tipo
          updated = true
        }
        if (updated) {
          await client.save()
        }
      }

      // Force date to be America/Bogotá time (stored as fake UTC to match the rest of app)
      const now = new Date()
      const bogotaString = now.toLocaleString('en-US', {
        timeZone: 'America/Bogota',
      })
      const dateBogota = new Date(bogotaString + ' UTC')

      // 2. Process Products and attach files
      const productosForOrder = productosData.map((prod: any) => {
        let referenciaArchivo = ''
        const fileField = `referencia_${prod.id}`
        if (filesData[fileField]) {
          referenciaArchivo = filesData[fileField].filename
        }

        return {
          id: prod.id,
          tipo: prod.tipo,
          cantidad: prod.cantidad,
          diseno: prod.diseno,
          tela: prod.tela,
          tecnica: prod.tecnica,
          especial: prod.especial,
          tieneReferencia: prod.tieneReferencia,
          referenciaArchivo: referenciaArchivo,
          distribucionTallas: prod.distribucionTallas || [],
          personalizaciones: prod.personalizaciones || [],
        }
      })

      // 3. Create Order
      const newOrder = new Order({
        cliente: client._id,
        productos: productosForOrder,
        status: 'Pendiente',
        fecha: dateBogota,
      })

      await newOrder.save()

      res.status(201).json({
        message: 'Order created successfully',
        order: newOrder,
      })
    } catch (error) {
      console.error('Create order error:', error)
      res.status(500).json({ message: 'Server error creating order' })
    }
  })

  req.pipe(bb)
}

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find().populate('cliente').sort({ fecha: -1 })
    res.status(200).json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    res.status(500).json({ message: 'Server error fetching orders' })
  }
}

export const addOrderComment = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const { texto, importancia } = req.body

  if (!texto) {
    res.status(400).json({ message: 'El comentario no puede estar vacío.' })
    return
  }

  try {
    const order = await Order.findById(id)
    if (!order) {
      res.status(404).json({ message: 'Order not found' })
      return
    }

    order.comentarios.push({
      texto,
      importancia: importancia || 'Verde',
      fecha: new Date(),
    })

    await order.save()
    res.status(200).json({ message: 'Comentario agregado', order })
  } catch (error) {
    console.error('Error adding comment:', error)
    res.status(500).json({ message: 'Server error adding comment' })
  }
}

export const updateProductTallas = async (req: Request, res: Response): Promise<void> => {
  const { id, productId } = req.params
  const { distribucionTallas } = req.body

  if (!distribucionTallas || !Array.isArray(distribucionTallas)) {
    res.status(400).json({ message: 'Distribución de tallas inválida.' })
    return
  }

  try {
    const order = await Order.findById(id)
    if (!order) {
      res.status(404).json({ message: 'Order not found' })
      return
    }

    const product = order.productos.find((p) => p.id === productId)
    if (!product) {
      res.status(404).json({ message: 'Product not found in order' })
      return
    }

    product.distribucionTallas = distribucionTallas

    // Ensure the array correctly acts as modified for mongoose
    order.markModified('productos')

    const bogotaString = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
    const dateBogota = new Date(bogotaString + ' UTC')

    const newTallasText = distribucionTallas.map((t) => `${t.talla}: ${t.cantidad}`).join(', ')
    const comentarioTexto = `Se actualizaron las tallas del producto ${product.tipo}. Nuevas tallas: ${newTallasText.length ? newTallasText : 'Ninguna'}`

    order.comentarios.push({
      texto: comentarioTexto,
      importancia: 'Amarillo',
      fecha: dateBogota,
    })

    await order.save()

    res.status(200).json({ message: 'Tallas actualizadas', order })
  } catch (error) {
    console.error('Error updating tallas:', error)
    res.status(500).json({ message: 'Server error updating tallas' })
  }
}

export const updateProductPersonalizaciones = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id, productId } = req.params
  const { personalizaciones } = req.body

  if (!personalizaciones || !Array.isArray(personalizaciones)) {
    res.status(400).json({ message: 'Personalizaciones inválidas.' })
    return
  }

  try {
    const order = await Order.findById(id)
    if (!order) {
      res.status(404).json({ message: 'Order not found' })
      return
    }

    const product = order.productos.find((p) => p.id === productId)
    if (!product) {
      res.status(404).json({ message: 'Product not found in order' })
      return
    }

    product.personalizaciones = personalizaciones

    order.markModified('productos')

    const bogotaString = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
    const dateBogota = new Date(bogotaString + ' UTC')

    const comentarioTexto = `Se actualizaron las personalizaciones del producto ${product.tipo}.`

    order.comentarios.push({
      texto: comentarioTexto,
      importancia: 'Amarillo',
      fecha: dateBogota,
    })

    await order.save()

    res.status(200).json({ message: 'Personalizaciones actualizadas', order })
  } catch (error) {
    console.error('Error updating personalizaciones:', error)
    res.status(500).json({ message: 'Server error updating personalizaciones' })
  }
}
