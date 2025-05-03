import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ChatMessage, { IChatMessage } from '../models/ChatMessage'; // Uses the updated model
import ChatGroup, { IChatGroup } from '../models/ChatGroup';
import { getIoInstance } from '../socket';

// Utility to construct room name based on ChatGroup ID
const getRoomName = (chatGroupId: mongoose.Types.ObjectId | string): string => {
    const idString = typeof chatGroupId === 'string' ? chatGroupId : chatGroupId.toString();
    return `chat-${idString}`;
};

/**
 * @description Create a new message, finding or creating the ChatGroup first
 * @route POST /api/messages
 * @access Private (Assumed)
 */
export const createMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Destructure new fields from request body
        const {
            contextApp, contextEntityType, contextEntityId,
            senderUserId, senderName, senderCompanyId, senderCompanyName, // Added senderName, senderCompanyName
            message, fileId, groupName,
         } = req.body;

        // --- Basic Validation ---
        // Added validation for senderName
        if (!contextApp || !contextEntityType || !contextEntityId || !senderUserId || !senderName || (!message && !fileId)) {
             res.status(400).json({
                success: false,
                message: 'Missing required fields: contextApp, contextEntityType, contextEntityId, senderUserId, senderName, and message or fileId'
            });
             return;
        }

        // --- Find or Create Chat Group ---
        let chatGroup: IChatGroup | null = null;
        try {
             chatGroup = await ChatGroup.findOneAndUpdate(
                { contextApp, contextEntityType, contextEntityId },
                { $setOnInsert: { contextApp, contextEntityType, contextEntityId, name: groupName } },
                { new: true, upsert: true, runValidators: true }
            );
        } catch (error: any) {
             if (error.code === 11000) {
                 console.warn('Duplicate key error during ChatGroup upsert, retrying find...');
                 chatGroup = await ChatGroup.findOne({ contextApp, contextEntityType, contextEntityId });
                 if (!chatGroup) throw new Error('Failed to find chat group after duplicate key error.');
             } else {
                 throw error;
             }
        }

        if (!chatGroup) {
            res.status(500).json({ success: false, message: 'Failed to find or create chat group.' });
            return;
        }

        // --- Create Chat Message ---
        // Include new fields in the data to be saved
        const newChatMessageData: Partial<IChatMessage> = {
            chatGroupId: chatGroup._id,
            senderUserId,
            senderName, // Save senderName
            senderCompanyId,
            senderCompanyName, // Save senderCompanyName (optional)
            message: message || null,
            fileId: fileId || null,
            // isRead defaults to false
        };

        const newChatMessage = new ChatMessage(newChatMessageData);
        const savedMessage = await newChatMessage.save();

        // --- Emit WebSocket Event ---
        const io = getIoInstance();
        if (io) {
            const roomName = getRoomName(chatGroup._id);
            // The savedMessage object now includes senderName and senderCompanyName
            io.to(roomName).emit('newMessage', savedMessage);
            console.log(`Emitted newMessage to room: ${roomName}`);
        } else {
            console.error("Socket.IO instance not available for message emission.");
        }

        // --- Respond to Client ---
        res.status(201).json({
            success: true,
            data: savedMessage.toObject() // Send the full message object including new fields
        });

    } catch (error) {
         next(error);
    }
};

/**
 * @description Get messages by context (App, EntityType, EntityId) with pagination
 * @route GET /api/messages/:contextApp/:contextEntityType/:contextEntityId
 * @access Private (Assumed)
 */
export const getMessagesByContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { contextApp, contextEntityType, contextEntityId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        if (!contextApp || !contextEntityType || !contextEntityId) {
             res.status(400).json({ success: false, message: 'Missing required path parameters: contextApp, contextEntityType, contextEntityId' });
             return;
        }

        const chatGroup = await ChatGroup.findOne({ contextApp, contextEntityType, contextEntityId }).lean();

        if (!chatGroup) {
             res.status(200).json({
                success: true, chatGroupId: null, count: 0, totalMessages: 0,
                currentPage: page, totalPages: 0, data: [],
            });
             return;
        }

        const chatGroupId = chatGroup._id;
        const [messages, totalMessages] = await Promise.all([
            ChatMessage.find({ chatGroupId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(), // Includes senderName, senderCompanyName, isRead
            ChatMessage.countDocuments({ chatGroupId })
        ]);

        const totalPages = Math.ceil(totalMessages / limit);

        res.status(200).json({
            success: true, chatGroupId: chatGroupId, count: messages.length,
            totalMessages, currentPage: page, totalPages, data: messages,
        });
    } catch (error) {
        next(error);
    }
};


/**
 * @description Update the read status of a message
 * @route PATCH /api/messages/:messageId/status
 * @access Private (Assumed)
 */
export const updateMessageReadStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { messageId } = req.params;
        const { isRead } = req.body;

        if (typeof isRead !== 'boolean') {
            res.status(400).json({ success: false, message: 'Invalid or missing "isRead" field in request body. It must be true or false.' });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
            res.status(400).json({ success: false, message: 'Invalid message ID format.' });
            return;
        }

        const updatedMessage = await ChatMessage.findOneAndUpdate(
            { _id: messageId },
            { $set: { isRead: isRead } },
            { new: true }
        ).lean();

        if (!updatedMessage) {
            res.status(404).json({ success: false, message: 'Message not found.' });
            return;
        }

        // --- Emit WebSocket Event ---
        const io = getIoInstance();
        if (io) {
            const roomName = getRoomName(updatedMessage.chatGroupId);
            io.to(roomName).emit('messageReadStatusChanged', {
                messageId: updatedMessage._id,
                chatGroupId: updatedMessage.chatGroupId,
                isRead: updatedMessage.isRead
            });
            console.log(`Emitted messageReadStatusChanged event to room: ${roomName} for message ${messageId}. New status: ${isRead}`);
        } else {
            console.error("Socket.IO instance not available for messageReadStatusChanged emission.");
        }

        res.status(200).json({ success: true, data: updatedMessage });

    } catch (error) {
        next(error);
    }
};
