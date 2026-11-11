import mongoose, { Document, Schema } from 'mongoose'

export interface ILoyaltyPlan extends Document {
  nombre: string
  puntos: number
  valor: number
  createdAt: Date
}

const loyaltyPlanSchema: Schema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    puntos: {
      type: Number,
      required: true,
      min: 1,
    },
    valor: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true },
)

export default mongoose.model<ILoyaltyPlan>('LoyaltyPlan', loyaltyPlanSchema)
