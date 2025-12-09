import mongoose, { Document, Schema } from 'mongoose';

export interface IClient extends Document {
  nombre: string;
  identificacion: string;
  email: string;
  celular: string;
}

const clientSchema: Schema = new Schema({
  nombre: {
    type: String,
    required: true,
    index: true
  },
  identificacion: { type: String, index: true },
  email: { type: String },
  celular: { type: String },
  // Add other fields as needed
}, { strict: false });

export default mongoose.model<IClient>('Client', clientSchema);
