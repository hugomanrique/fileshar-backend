import mongoose, { Document, Schema } from 'mongoose';
import { IClient } from './Client';

export interface IFile extends Document {
  nombre: string;
  ubicacion: string; // Stored filename on disk
  fecha: Date;
  status: string;
  tamanio: string; // stored as string to keep units if needed, or number bytes
  cliente: IClient['_id'];
  copias: number;
  impresora: string;
  observaciones: string;
  metros: number;
  valor: number;
}

const fileSchema: Schema = new Schema({
  nombre: { type: String, required: true },
  ubicacion: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' },
  tamanio: { type: String },
  cliente: { type: Schema.Types.ObjectId, ref: 'Client' },
  copias: { type: Number, default: 1 },
  impresora: { type: String },
  observaciones: { type: String },
  valor: { type: Number },
  metros: { type: Number },
});

export default mongoose.model<IFile>('File', fileSchema);
