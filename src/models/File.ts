import mongoose, { Document, Schema } from 'mongoose'
import { IClient } from './Client'

export interface IFile extends Document {
  nombre: string
  ubicacion: string // Stored filename on disk
  fecha: Date
  status: string
  tamanio: string // stored as string to keep units if needed, or number bytes
  cliente: IClient['_id']
  copias: number
  impresora: string
  observaciones: string
  metros: number
  valor: number
  reposicion: boolean
  seRealizoMontaje: boolean
  valorMontaje: number
  metodoPago: string
  code: string
  basePrice: number
  puntosOtorgados: number
  planRedimido?: Schema.Types.ObjectId
  nombrePlanRedimido?: string
  puntosRedimidos?: number
  descuentoFidelizacion?: number
  tuvoDescuento?: boolean
  valorOriginal?: number
}

const fileSchema: Schema = new Schema({
  nombre: { type: String, required: true },
  ubicacion: { type: String, required: true },
  fecha: { type: Date },
  status: { type: String, default: 'pending' },
  tamanio: { type: String },
  cliente: { type: Schema.Types.ObjectId, ref: 'Client' },
  copias: { type: Number, default: 1 },
  impresora: { type: String },
  observaciones: { type: String },
  valor: { type: Number },
  metros: { type: Number },
  reposicion: { type: Boolean, default: false },
  seRealizoMontaje: { type: Boolean, default: false },
  valorMontaje: { type: Number, default: 0 },
  metodoPago: { type: String },
  code: { type: String },
  basePrice: { type: Number },
  puntosOtorgados: { type: Number, default: 0 },
  planRedimido: { type: Schema.Types.ObjectId, ref: 'LoyaltyPlan' },
  nombrePlanRedimido: { type: String },
  puntosRedimidos: { type: Number, default: 0 },
  descuentoFidelizacion: { type: Number, default: 0 },
  tuvoDescuento: { type: Boolean, default: false },
  valorOriginal: { type: Number },
})

export default mongoose.model<IFile>('File', fileSchema)
