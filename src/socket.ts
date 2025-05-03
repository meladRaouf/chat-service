import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import mongoose from 'mongoose'; // Import mongoose to validate ObjectId
import config from './config';

let io: SocketIOServer | null = null;

// Helper to validate if a string looks like a valid MongoDB ObjectId
const isValidObjectId = (id: string): boolean => {
    return mongoose.Types.ObjectId.isValid(id);
};


export const initializeSocketIO = (httpServer: http.Server): SocketIOServer => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: config.corsOrigin, // Allow connections from frontend
            methods: ["GET", "POST"],
        },
    });

    console.log('Socket.IO initialized');

    io.on('connection', (socket: Socket) => {
        console.log(`New client connected: ${socket.id}`);

        socket.on('disconnect', (reason) => {
            console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
            // Socket.IO automatically handles leaving rooms on disconnect
        });

        // Listen for explicit room join requests based on ChatGroup ID
        socket.on('joinRoom', (roomName: string) => {
            // Validate the room name format: chat-<validObjectId>
            if (typeof roomName === 'string' && roomName.startsWith('chat-')) {
                const potentialGroupId = roomName.substring(5); // Extract part after 'chat-'
                if (isValidObjectId(potentialGroupId)) {
                    console.log(`Client ${socket.id} joining room: ${roomName}`);
                    socket.join(roomName);
                    // Optionally acknowledge the join:
                    // socket.emit('joinedRoom', roomName);
                } else {
                     console.warn(`Client ${socket.id} attempted to join room with invalid group ID format: ${roomName}`);
                     socket.emit('joinError', { message: 'Invalid room name format (invalid group ID).' });
                }
            } else {
                console.warn(`Client ${socket.id} attempted to join invalid room format: ${roomName}`);
                socket.emit('joinError', { message: 'Invalid room name format (must start with chat-).' });
            }
        });

         // Listen for explicit room leave requests
        socket.on('leaveRoom', (roomName: string) => {
             // Validate the room name format: chat-<validObjectId>
             if (typeof roomName === 'string' && roomName.startsWith('chat-')) {
                 const potentialGroupId = roomName.substring(5);
                 if (isValidObjectId(potentialGroupId)) {
                    console.log(`Client ${socket.id} leaving room: ${roomName}`);
                    socket.leave(roomName);
                 } else {
                      console.warn(`Client ${socket.id} attempted to leave room with invalid group ID format: ${roomName}`);
                 }
            } else {
                 console.warn(`Client ${socket.id} attempted to leave invalid room format: ${roomName}`);
            }
        });


        // Handle potential errors on the socket
        socket.on('error', (error) => {
            console.error(`Socket error from ${socket.id}:`, error);
        });
    });

    return io;
};

// Function to get the initialized io instance
export const getIoInstance = (): SocketIOServer | null => {
    if (!io) {
        console.error('Socket.IO has not been initialized. Call initializeSocketIO first.');
    }
    return io;
};
