import { Request, Response } from 'express'
import File from '../models/File'
import Client from '../models/Client'
import mongoose from 'mongoose'

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' })
    }

    // Use UTC to match the "Bogotá as UTC" storage strategy
    const start = new Date(startDate as string)
    start.setUTCHours(0, 0, 0, 0)

    const end = new Date(endDate as string)
    end.setUTCHours(23, 59, 59, 999)

    // Generate ObjectIds for client creation time filtering
    const startId = mongoose.Types.ObjectId.createFromTime(Math.floor(start.getTime() / 1000))
    const endId = mongoose.Types.ObjectId.createFromTime(Math.floor(end.getTime() / 1000))

    const [
      salesDaily,
      paymentMethodsDaily,
      paymentMethodsTotal,
      newClientsResult,
      returningCustomerJobsResult,
      newClientsListResult,
      printersResult,
    ] = await Promise.all([
      // 1. Gráfica de ventas diarias
      File.aggregate([
        {
          $match: {
            fecha: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha', timezone: 'UTC' } },
            totalSales: { $sum: '$valor' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 2. Gráfica de Comportamiento de metodos de pago diario
      File.aggregate([
        {
          $match: {
            fecha: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$fecha', timezone: 'UTC' } },
              method: '$metodoPago',
            },
            count: { $sum: 1 },
            total: { $sum: '$valor' },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),

      // 3. Total de metodos de pago
      File.aggregate([
        {
          $match: {
            fecha: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: '$metodoPago',
            count: { $sum: 1 },
            total: { $sum: '$valor' },
          },
        },
      ]),

      // 4. Clientes nuevos (Unique by phone number created in range)
      Client.aggregate([
        {
          $match: {
            _id: { $gte: startId, $lte: endId },
          },
        },
        {
          $group: {
            _id: '$celular',
          },
        },
        {
          $count: 'count',
        },
      ]),

      // 5. Trabajos de clientes que retornaron
      File.aggregate([
        {
          $match: {
            fecha: { $gte: start, $lte: end },
          },
        },
        {
          $lookup: {
            from: 'clients',
            localField: 'cliente',
            foreignField: '_id',
            as: 'clientData',
          },
        },
        { $unwind: '$clientData' },
        {
          $match: {
            'clientData._id': { $lt: startId },
          },
        },
        {
          $count: 'count',
        },
      ]),

      // 6. Listado de clientes nuevos (Unique by phone number with meters in range)
      // Client.aggregate([
      //   {
      //     $match: {
      //       _id: { $gte: startId, $lte: endId },
      //     },
      //   },
      //   // clave: ordenar para que $first sea el más reciente
      //   { $sort: { _id: -1 } },
      //   {
      //     $group: {
      //       _id: '$celular',
      //       uniqueId: { $first: '$_id' },
      //       nombre: { $first: '$nombre' },
      //       email: { $first: '$email' },
      //       identificacion: { $first: '$identificacion' },
      //       celular: { $first: '$celular' },
      //       allIds: { $push: '$_id' },
      //     },
      //   },
      //   {
      //     $lookup: {
      //       from: 'files',
      //       let: { clientIds: '$allIds' },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $and: [
      //                 { $in: ['$cliente', '$$clientIds'] },
      //                 { $gte: ['$fecha', start] },
      //                 { $lte: ['$fecha', end] },
      //               ],
      //             },
      //           },
      //         },
      //       ],
      //       as: 'files',
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: '$files',
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      //   {
      //     $group: {
      //       _id: '$_id',
      //       uniqueId: { $first: '$uniqueId' },
      //       nombre: { $first: '$nombre' },
      //       email: { $first: '$email' },
      //       identificacion: { $first: '$identificacion' },
      //       celular: { $first: '$celular' },
      //       createdAt: { $first: { $toDate: '$uniqueId' } },
      //       totalMetros: {
      //         $sum: {
      //           $multiply: [{ $ifNull: ['$files.metros', 0] }, { $ifNull: ['$files.copias', 1] }],
      //         },
      //       },
      //     },
      //   },
      //   {
      //     $project: {
      //       _id: '$uniqueId',
      //       nombre: 1,
      //       email: 1,
      //       celular: 1,
      //       identificacion: 1,
      //       createdAt: 1,
      //       totalMetros: 1,
      //     },
      //   },
      //   { $sort: { createdAt: -1 } },
      // ]),
      Client.aggregate([
        // 1) Clientes creados en el rango (por ObjectId)
        {
          $match: {
            _id: { $gte: startId, $lte: endId },
          },
        },

        // ✅ si quieres "registro real" (más viejo) por celular
        { $sort: { _id: 1 } },

        // 2) Unificar por celular (si existen duplicados)
        {
          $group: {
            _id: '$celular',
            uniqueId: { $first: '$_id' }, // el más viejo por el sort asc
            nombre: { $first: '$nombre' },
            email: { $first: '$email' },
            identificacion: { $first: '$identificacion' },
            celular: { $first: '$celular' },
            allIds: { $push: '$_id' },
          },
        },

        // 3) Traer trabajos (files) de esos clientes dentro del rango de fechas
        {
          $lookup: {
            from: 'files',
            let: { clientIds: '$allIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ['$cliente', '$$clientIds'] },
                      { $gte: ['$fecha', start] },
                      { $lte: ['$fecha', end] },
                    ],
                  },
                },
              },
              // opcional: solo campos necesarios
              // { $project: { metros: 1, copias: 1, impresora: 1, fecha: 1 } },
            ],
            as: 'files',
          },
        },

        // 4) Facet: lista por cliente + resumen por impresora
        {
          $facet: {
            clientes: [
              { $unwind: { path: '$files', preserveNullAndEmptyArrays: true } },
              {
                $group: {
                  _id: '$_id', // celular
                  uniqueId: { $first: '$uniqueId' },
                  nombre: { $first: '$nombre' },
                  email: { $first: '$email' },
                  identificacion: { $first: '$identificacion' },
                  celular: { $first: '$celular' },
                  createdAt: { $first: { $toDate: '$uniqueId' } },
                  totalMetros: {
                    $sum: {
                      $multiply: [
                        { $ifNull: ['$files.metros', 0] },
                        { $ifNull: ['$files.copias', 1] },
                      ],
                    },
                  },
                },
              },
              {
                $project: {
                  _id: '$uniqueId',
                  nombre: 1,
                  email: 1,
                  celular: 1,
                  identificacion: 1,
                  createdAt: 1,
                  totalMetros: 1,
                },
              },
              { $sort: { createdAt: -1 } },
            ],

            impresoras: [
              // aquí NO queremos preservar vacíos, porque solo cuentan files reales
              { $unwind: { path: '$files', preserveNullAndEmptyArrays: false } },
              {
                $group: {
                  _id: '$files.impresora',
                  totalMetros: {
                    $sum: {
                      $multiply: [
                        { $ifNull: ['$files.metros', 0] },
                        { $ifNull: ['$files.copias', 1] },
                      ],
                    },
                  },
                  clientesUnicos: { $addToSet: '$uniqueId' },
                  trabajos: { $sum: 1 },
                },
              },
              {
                $project: {
                  _id: 0,
                  impresora: '$_id',
                  totalMetros: 1,
                  trabajos: 1,
                  clientesNuevosConTrabajo: { $size: '$clientesUnicos' },
                },
              },
              { $sort: { totalMetros: -1 } },
            ],
          },
        },
      ]),
      File.aggregate([
        // 1) Filtrar trabajos en rango de fechas
        {
          $match: {
            fecha: { $gte: start, $lte: end },
          },
        },

        // 2) Normalizar valores para evitar NaN
        {
          $addFields: {
            metrosCalc: {
              $multiply: [{ $ifNull: ['$metros', 0] }, { $ifNull: ['$copias', 1] }],
            },
          },
        },

        // 3) Agrupar por impresora
        {
          $group: {
            _id: { $ifNull: ['$impresora', 'SIN_IMPRESORA'] },
            totalMetros: { $sum: '$metrosCalc' },
            trabajos: { $sum: 1 },
          },
        },

        // 4) Salida limpia
        {
          $project: {
            _id: 0,
            impresora: '$_id',
            totalMetros: {
              // opcional: redondear si manejas decimales
              $round: ['$totalMetros', 2],
            },
            trabajos: 1,
          },
        },

        // 5) Orden por mayor consumo
        { $sort: { totalMetros: -1 } },
      ]),
    ])

    const returningCustomerJobs = returningCustomerJobsResult[0]?.count || 0
    const newClients = newClientsResult[0]?.count || 0
    const newClientsList = newClientsListResult

    res.json({
      salesDaily,
      paymentMethodsDaily,
      paymentMethodsTotal,
      newClients,
      returningCustomerJobs,
      newClientsList,
      printersResult,
    })
  } catch (error: any) {
    console.error('Error in getDashboardStats:', error)
    res.status(500).json({ message: 'Internal Server Error', error: error.message })
  }
}
