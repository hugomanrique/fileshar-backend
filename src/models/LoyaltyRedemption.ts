import mongoose, { Document, Schema } from 'mongoose'
import { IClient } from './Client'
import { IFile } from './File'
import { ILoyaltyPlan } from './LoyaltyPlan'

export interface ILoyaltyRedemption extends Document {
  cliente: IClient['_id']
  file?: IFile['_id']
  plan: ILoyaltyPlan['_id']
  nombrePlan: string
  puntosRedimidos: number
  valorDescuento: number
  valorOriginalTrabajo: number
  valorFinalTrabajo: number
  fecha: Date
  status: 'Activo' | 'Revertido'
}

const loyaltyRedemptionSchema: Schema = new Schema(
  {
    cliente: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    file: { type: Schema.Types.ObjectId, ref: 'File', index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'LoyaltyPlan', required: true },
    nombrePlan: { type: String, required: true },
    puntosRedimidos: { type: Number, required: true },
    valorDescuento: { type: Number, required: true },
    valorOriginalTrabajo: { type: Number, required: true },
    valorFinalTrabajo: { type: Number, required: true },
    fecha: { type: Date, required: true, index: true },
    status: { type: String, enum: ['Activo', 'Revertido'], default: 'Activo' },
  },
  { timestamps: true },
)

export default mongoose.model<ILoyaltyRedemption>('LoyaltyRedemption', loyaltyRedemptionSchema)
