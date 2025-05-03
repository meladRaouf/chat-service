import mongoose, { Schema, Document } from 'mongoose';

// Interface representing a ChatMessage document in MongoDB.
export interface IChatMessage extends Document {
    _id: mongoose.Types.ObjectId; // Ensure _id is typed correctly
    chatGroupId: mongoose.Types.ObjectId; // Reference to the ChatGroup
    message: string | null; // Allow null if fileId is present
    senderUserId: string; // ID of the sender (references external system)
    senderName: string; // Added: Display name of the sender
    senderCompanyId?: string; // Optional ID of the sender's company
    senderCompanyName?: string; // Added: Optional display name of the sender's company
    fileId?: string | null; // Optional reference to an external file, allow null
    isRead: boolean; // Boolean flag indicating if the message is read
    createdAt: Date;
}

// Schema corresponding to the document interface.
const ChatMessageSchema: Schema = new Schema(
    {
        chatGroupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatGroup', // Link to the ChatGroup model
            required: [true, 'chatGroupId is required'],
            index: true, // Index for finding messages by group
        },
        message: {
            type: String,
            trim: true,
            validate: [
                // Validator to ensure either message or fileId exists
                function(this: IChatMessage): boolean {
                    return !!this.message || !!this.fileId;
                },
                'Either message or fileId must be provided.'
            ]
        },
        senderUserId: {
            type: String, // As per schema spec
            required: [true, 'senderUserId is required'],
            index: true,
        },
        senderName: { // Added senderName
            type: String,
            required: [true, 'senderName is required'],
            trim: true,
        },
        senderCompanyId: {
            type: String, // As per schema spec
            trim: true,
        },
        senderCompanyName: { // Added senderCompanyName
            type: String,
            trim: true,
            // No 'required' constraint as it's optional
        },
        fileId: {
            type: String, // As per schema spec
            trim: true,
        },
        isRead: {
            type: Boolean,
            required: true,
            default: false, // Default to unread
            index: true,
        },
    },
    {
        // Automatically add createdAt and updatedAt fields
        timestamps: { createdAt: true, updatedAt: false }, // Only need createdAt
        versionKey: false, // Don't add __v field
    }
);

// Compound index for efficient querying by group and time
ChatMessageSchema.index({ chatGroupId: 1, createdAt: -1 });
// Optional: Index for finding unread messages quickly
ChatMessageSchema.index({ chatGroupId: 1, isRead: 1 });


// Export the model
const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

export default ChatMessage;
