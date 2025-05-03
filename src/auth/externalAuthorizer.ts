import { Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';
import config from '../config'; // Import app config
import ChatMessage from '../models/ChatMessage';
import ChatGroup from '../models/ChatGroup';
import mongoose from 'mongoose';

// Define expected permission strings
type Permission = 'create_message' | 'list_messages' | 'change_status';

// Define the expected structure of the response from the auth service
interface AuthResponse {
    permissions: Permission[];
    // userId?: string; // Optional
}

// Define the known contextApp types for type safety
type KnownContextApp = 'NFG_PARTNER_BANK' | 'NFG_CLIENT_PORTAL';

/**
 * [DISABLED] Fetches authorization details from the external auth service based on contextApp.
 * This function is currently bypassed for development/testing.
 */
async function getAuthorization(
    token: string,
    contextApp: string,
    contextEntityType: string,
    contextEntityId: string
): Promise<AuthResponse | null> {
    // --- Select the correct Auth Service URL ---
    let authUrl: string | undefined;
    if (contextApp in config.authServiceUrls) {
         authUrl = config.authServiceUrls[contextApp as KnownContextApp];
    }

    if (!authUrl) {
        console.error(`[AUTH BYPASS] Authorization check skipped: No configured auth service URL for contextApp '${contextApp}'.`);
        // In bypass mode, we might return a default permissive response or null
        // Returning null here to simulate config error if we were live
        return null;
    }

    console.log(`[AUTH BYPASS] Would call Auth URL: ${authUrl} for contextApp: ${contextApp}`);

    // --- Simulate Success during bypass ---
    // Return a default permissive response for testing purposes
    // WARNING: Remove this simulation when enabling real auth checks!
    console.warn(`[AUTH BYPASS] Simulating successful authorization check.`);
    return { permissions: ['create_message', 'list_messages', 'change_status'] }; // Grant all permissions

    /* --- Original External Call (Commented Out) ---
    try {
        const response = await axios.post<AuthResponse>(
            authUrl, // Use the dynamically selected URL
            { contextApp, contextEntityType, contextEntityId },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            }
        );

        if (response.data && Array.isArray(response.data.permissions)) {
            return response.data;
        } else {
            console.error(`Auth service at ${authUrl} returned invalid response format:`, response.data);
            return null;
        }
    } catch (error) {
        console.error(`Error calling authorization service at ${authUrl}:`);
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            console.error(`Status: ${axiosError.response?.status}`);
            console.error('Response:', axiosError.response?.data);
        } else if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error('Unknown error:', error);
        }
        return null; // Indicate failure
    }
    */
}

/**
 * Middleware factory to create authorization middleware for specific permissions.
 * [MODIFIED] Currently bypasses external auth check and logs intent.
 */
export const requireAuth = (requiredPermission: Permission) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const authHeader = req.headers.authorization;
        const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : 'MISSING_OR_INVALID_TOKEN'; // Get token or placeholder

        let contextApp: string | undefined;
        let contextEntityType: string | undefined;
        let contextEntityId: string | undefined;

        // Determine context based on the route/required permission
        // (Logic remains the same)
        if (requiredPermission === 'create_message') {
            contextApp = req.body.contextApp;
            contextEntityType = req.body.contextEntityType;
            contextEntityId = req.body.contextEntityId;
        } else if (requiredPermission === 'list_messages') {
            contextApp = req.params.contextApp;
            contextEntityType = req.params.contextEntityType;
            contextEntityId = req.params.contextEntityId;
        } else if (requiredPermission === 'change_status') {
            const { messageId } = req.params;
            if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
                 res.status(400).json({ success: false, message: 'Invalid or missing message ID.' });
                 return;
            }
            try {
                // Fetch message context (still necessary even if bypassing auth check)
                const message = await ChatMessage.findById(messageId).select('chatGroupId').lean();
                if (!message) {
                    res.status(404).json({ success: false, message: 'Message not found.' });
                    return;
                }
                const group = await ChatGroup.findById(message.chatGroupId).select('contextApp contextEntityType contextEntityId').lean();
                if (!group) {
                     console.error(`Data inconsistency: ChatGroup not found for message ${messageId}`);
                     res.status(404).json({ success: false, message: 'Associated chat group not found.' });
                     return;
                }
                contextApp = group.contextApp;
                contextEntityType = group.contextEntityType;
                contextEntityId = group.contextEntityId;

            } catch (dbError) {
                console.error('Error fetching message/group context:', dbError);
                // Still return error if context cannot be determined
                res.status(500).json({ success: false, message: 'Error retrieving context.' });
                return;
            }
        }

        // Validate context parameters were found
        if (!contextApp || !contextEntityType || !contextEntityId) {
             console.warn(`Authorization check bypassed: Could not determine context for permission '${requiredPermission}' on route ${req.path}`);
             // Still return error if context cannot be determined
             res.status(400).json({ success: false, message: 'Could not determine context for authorization.' });
             return;
        }

        // --- Bypass External Auth Check ---
        console.log(`[AUTH BYPASS] Request received for permission '${requiredPermission}'`);
        console.log(`  - Route: ${req.method} ${req.originalUrl}`);
        console.log(`  - Context App: ${contextApp}`);
        console.log(`  - Context Entity Type: ${contextEntityType}`);
        console.log(`  - Context Entity ID: ${contextEntityId}`);
        console.log(`  - Token Present: ${token !== 'MISSING_OR_INVALID_TOKEN'}`);
        // console.log(`  - Token Snippet: ${token.substring(0, 10)}...`); // Optionally log a snippet, be careful with real tokens

        // --- Always proceed ---
        console.log(`[AUTH BYPASS] Granting access for '${requiredPermission}'.`);
        next(); // Allow request to proceed regardless of actual permissions

        /* --- Original Auth Check Logic (Commented Out) ---
        const authData = await getAuthorization(token, contextApp, contextEntityType, contextEntityId);

        if (!authData) {
            if (!(contextApp in config.authServiceUrls) || !config.authServiceUrls[contextApp as KnownContextApp]) {
                 res.status(501).json({ success: false, message: `Authorization service not configured for contextApp '${contextApp}'.` });
            } else {
                 res.status(503).json({ success: false, message: 'Authorization service unavailable or encountered an error.' });
            }
            return;
        }

        if (authData.permissions.includes(requiredPermission)) {
            next();
        } else {
            res.status(403).json({ success: false, message: `Forbidden: You do not have permission ('${requiredPermission}') for this context.` });
        }
        */
    };
};
