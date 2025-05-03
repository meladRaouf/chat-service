import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

import config from './config';
import connectDB from './config/database';
import messageRoutes from './routes/messageRoutes';
import { initializeSocketIO } from './socket'; // Import Socket.IO initializer

// --- Initialization ---
const app: Express = express();
const httpServer = http.createServer(app);

// --- Connect to Database ---
connectDB();

// --- Initialize Socket.IO ---
const io = initializeSocketIO(httpServer);


// Enable CORS - Configure origins in .env
app.use(cors({ origin: config.corsOrigin }));
// Set security-related HTTP headers
app.use(helmet());
// Parse JSON bodies
app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
// HTTP request logger  (use 'dev' format for development)
app.use(morgan('dev'));

// --- API Routes ---
app.use('/api/messages', messageRoutes);

// --- OpenAPI Documentation Setup ---
try {
    const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log(`API Documentation available at /api-docs`);
} catch (e) {
    console.error("Failed to load or parse openapi.yaml", e);
}


// --- Health Check Route ---
app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ message: 'Chat Service API is running!' });
});
app.get('/health', (req: Request, res: Response) => {
    // Add checks for DB connection, etc. if needed
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});


// --- Not Found Handler ---
// Catch 404s for routes that don't exist
app.use((req: Request, res: Response, next: NextFunction) => {
     res.status(404).json({ success: false, message: 'Resource not found' });
});

// --- Global Error Handler ---
// Must have 4 arguments to be recognized as an error handler by Express
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Error:', err.stack || err);

    // Handle Mongoose validation errors specifically
    if (err.name === 'ValidationError') {
         const errors = Object.values((err as mongoose.Error.ValidationError).errors).map(el => el.message);
         return res.status(400).json({ success: false, message: 'Validation Error', errors });
    }

    // Handle Mongoose CastErrors (e.g., invalid ObjectId format)
    if (err.name === 'CastError') {
        const castError = err as mongoose.Error.CastError;
        return res.status(400).json({ success: false, message: `Invalid value for ${castError.path}: ${castError.value}`});
    }

    // Generic error response
    res.status(500).json({
        success: false,
        message: 'An internal server error occurred',
        // Avoid leaking stack trace in production environment
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});


// --- Start Server ---
const PORT = config.port;

httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`MongoDB URI: ${config.mongodbUri}`); // Be careful logging this in production logs
    console.log(`CORS Origin: ${config.corsOrigin}`);
});

// --- Graceful Shutdown ---
const shutdown = (signal: string) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    httpServer.close(() => {
        console.log('HTTP server closed.');
        mongoose.connection.close(false).then(() => { // Mongoose >= 5.4 recommendation
            console.log('MongoDB connection closed.');
            process.exit(0);
        }).catch(err => {
             console.error('Error closing MongoDB connection:', err);
             process.exit(1);
        });
    });

    // Force shutdown if graceful shutdown fails after timeout
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT')); // Catches Ctrl+C

export default app; // Export for potential testing