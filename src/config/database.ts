import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const user = encodeURIComponent(process.env.MONGODB_USER ?? '')
    const password = encodeURIComponent(process.env.MONGODB_PASSWORD ?? '')
    const uriTemplate = process.env.MONGODB_HOST ?? ''
    const MONGODB_URI = uriTemplate
      .replace('{USER}', user)
      .replace('{PASSWORD}', password)

    const urlDB = `${MONGODB_URI}/fileshar?authSource=admin`
    console.log(urlDB)
    await mongoose.connect(MONGODB_URI,{dbName: 'fileshar'});
    console.log('MongoDB connected');
    console.log('DB actual:', mongoose.connection.db?.databaseName);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;