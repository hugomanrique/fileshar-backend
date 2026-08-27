import mongoose, { Document, Schema } from 'mongoose'
import { IClient } from './Client'

export interface IProduct {
  id: string
  tipo: string
  cantidad: number
  diseno?: string
  tela?: string
  tecnica?: string[]
  especial?: boolean
  tieneReferencia?: boolean
  referenciaArchivo?: string
  distribucionTallas?: {
    genero: string
    talla: string
    cantidad: number
  }[]
  personalizaciones?: {
    id: string
    genero: string
    talla: string
    nombre: string
    numero: string
    cantidad: number
  }[]
}

export interface IOrder extends Document {
  cliente: mongoose.Types.ObjectId | IClient
  productos: IProduct[]
  comentarios: {
    texto: string
    importancia: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo'
    fecha: Date
  }[]
  fecha: Date
  status: string
  velocidad: 'Rápido' | 'Medio' | 'Lento'
}

const productSchema = new Schema({
  id: { type: String },
  tipo: { type: String, required: true },
  cantidad: { type: Number, required: true },
  diseno: { type: String },
  tela: { type: String },
  tecnica: { type: [String] },
  especial: { type: Boolean },
  tieneReferencia: { type: Boolean },
  referenciaArchivo: { type: String },
  distribucionTallas: [
    {
      genero: { type: String },
      talla: { type: String },
      cantidad: { type: Number },
    },
  ],
  personalizaciones: [
    {
      id: { type: String },
      genero: { type: String },
      talla: { type: String },
      nombre: { type: String },
      numero: { type: String },
      cantidad: { type: Number },
    },
  ],
})

const orderSchema = new Schema(
  {
    cliente: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    productos: [productSchema],
    comentarios: [
      {
        texto: { type: String, required: true },
        importancia: {
          type: String,
          enum: ['Verde', 'Amarillo', 'Naranja', 'Rojo'],
          default: 'Verde',
        },
        fecha: { type: Date, default: Date.now },
      },
    ],
    fecha: { type: Date, default: Date.now },
    status: { type: String, default: 'Pendiente' },
    velocidad: {
      type: String,
      enum: ['Rápido', 'Medio', 'Lento'],
      default: 'Lento',
    },
  },
  { timestamps: true }
)

export default mongoose.model<IOrder>('Order', orderSchema)
