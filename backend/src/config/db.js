import mongoose from "mongoose";

const connectDB = async (uri) => {
  const connection = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${connection.connection.host}`);
};

export default connectDB;
