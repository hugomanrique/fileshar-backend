import mongoose, { Document, Schema } from 'mongoose';
import { IClient } from './Client';

export interface IFile extends Document {
  nombre: string;
  fecha: Date;
  status: string;
  tamaño: string; // stored as string to keep units if needed, or number bytes
  cliente: IClient['_id'];
  copias: number;
  impresora: string;
  observaciones: string;
}

const fileSchema: Schema = new Schema({
  nombre: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' },
  tamaño: { type: String },
  cliente: { type: Schema.Types.ObjectId, ref: 'Client' },
  copias: { type: Number, default: 1 },
  impresora: { type: String },
  observaciones: { type: String }
});

export default mongoose.model<IFile>('File', fileSchema);
