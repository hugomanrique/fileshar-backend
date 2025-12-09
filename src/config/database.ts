import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const user = encodeURIComponent(process.env.MONGODB_USER ?? '')
const password = encodeURIComponent(process.env.MONGODB_PASSWORD ?? '')
const uriTemplate = process.env.MONGODB_HOST ?? ''
const MONGODB_URI = uriTemplate
  .replace('{USER}', user)
  .replace('{PASSWORD}', password)

const urlDB = `${MONGODB_URI}?authSource=admin`
console.log(urlDB)
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;
