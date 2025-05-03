import express from 'express';
import {
    createMessage,
    getMessagesByContext,
    updateMessageReadStatus
} from '../controllers/messageController';
import { requireAuth } from '../auth/externalAuthorizer'; // Import the external authorizer

const router = express.Router();

// POST /api/messages - Requires 'create_message' permission for the context in the body
router.post('/', requireAuth('create_message'), createMessage);

// GET /api/messages/:contextApp/:contextEntityType/:contextEntityId - Requires 'list_messages' permission for the context in the path
router.get(
    '/:contextApp/:contextEntityType/:contextEntityId',
    requireAuth('list_messages'), 
    getMessagesByContext
);

// PATCH /api/messages/:messageId/status - Requires 'change_status' permission for the message's context
router.patch(
    '/:messageId/status',
    requireAuth('change_status'), 
    updateMessageReadStatus
);

export default router;
