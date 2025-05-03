import mongoose from 'mongoose';
import config from './index';

const connectDB = async (): Promise<void> => {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('MongoDB Connected successfully.');

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected.');
        });

    } catch (error) {
        console.error('MongoDB connection failed:', error);
        // Exit process with failure
        process.exit(1);
    }
};

export default connectDB;