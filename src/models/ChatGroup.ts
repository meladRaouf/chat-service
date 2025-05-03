import mongoose, { Schema, Document } from 'mongoose';

// Interface representing a ChatGroup document in MongoDB.
export interface IChatGroup extends Document {
    _id: mongoose.Types.ObjectId; // Ensure _id is typed correctly
    contextApp: string;
    contextEntityType: string;
    contextEntityId: string;
    name?: string; // Optional group name
    createdAt: Date;
}

// Schema corresponding to the document interface.
const ChatGroupSchema: Schema = new Schema(
    {
        contextApp: {
            type: String,
            required: [true, 'contextApp is required'],
            trim: true,
            index: true, // Index for finding groups by context
        },
        contextEntityType: {
            type: String,
            required: [true, 'contextEntityType is required'],
            trim: true,
            index: true, // Index for finding groups by context
        },
        contextEntityId: {
            type: String,
            required: [true, 'contextEntityId is required'],
            trim: true,
            index: true, // Index for finding groups by context
        },
        name: {
            type: String,
            trim: true,
            // Optional: Add validation like maxLength if needed
        },
    },
    {
        // Automatically add createdAt and updatedAt fields
        timestamps: { createdAt: true, updatedAt: false }, // Only need createdAt
        versionKey: false, // Don't add __v field
    }
);

// Compound unique index to ensure only one group exists per context triplet
ChatGroupSchema.index({ contextApp: 1, contextEntityType: 1, contextEntityId: 1 }, { unique: true });

// Export the model
const ChatGroup = mongoose.model<IChatGroup>('ChatGroup', ChatGroupSchema);

export default ChatGroup;
