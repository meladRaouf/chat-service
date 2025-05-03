// Import necessary libraries using ES Module syntax
import axios from 'axios'; // For making HTTP requests
import { io } from 'socket.io-client'; // For WebSocket client
import dotenv from 'dotenv'; // Import dotenv to read .env file
import path from 'path'; // Import path module
import { fileURLToPath } from 'url'; // Import url module to work with import.meta.url

// --- Determine the directory name in ES Module scope ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configure dotenv ---
// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// --- Configuration ---
// Read from environment variables, provide defaults
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const SERVER_URL = `http://${HOST}:${PORT}`;
const API_ENDPOINT = `${SERVER_URL}/api/messages`;
const WEBSOCKET_URL = SERVER_URL;

// --- JWT Token (IMPORTANT) ---
// Obtain a valid JWT from your authentication service (e.g., Spring Boot)
// and set it as an environment variable (e.g., TEST_JWT).
// NEVER hardcode real tokens here.
const JWT_TOKEN = process.env.TEST_JWT|| "123.456.789"; // Replace with your JWT token
if (!JWT_TOKEN) {
    console.error("FATAL ERROR: TEST_JWT environment variable is not set.");
    console.error("Please obtain a valid JWT and set it before running the test.");
    process.exit(1);
}
const AUTH_HEADER = { 'Authorization': `Bearer ${JWT_TOKEN}` };

// Define the shared chat room context
const TEST_CONTEXT_APP = 'TestAppWithAuth';
const TEST_CONTEXT_ENTITY_TYPE = 'TestEntityAuth';
const TEST_CONTEXT_ENTITY_ID = `test-entity-js-auth-${Date.now()}`; // Unique ID per test run

// Define User 1
const USER1_SENDER_ID = 'test-user-JS-Auth-Eve'; // Should match the user ID encoded in the JWT ideally
const USER1_SENDER_NAME = 'Eve (Test)'; // Added Name
const USER1_COMPANY_NAME = 'Eve Corp'; // Added Company Name
const USER1_MESSAGE = `Hello Frank! This is an authenticated message. - ${USER1_SENDER_NAME} (${Date.now()})`;

// Define User 2
const USER2_SENDER_ID = 'test-user-JS-Auth-Frank'; // Can be different, assumes JWT user has permission
const USER2_SENDER_NAME = 'Frank (Test)'; // Added Name
// User 2 has no company name (optional)
const USER2_MESSAGE = `Hi Eve! Got your authenticated message. - ${USER2_SENDER_NAME} (${Date.now()})`;

// --- State Tracking ---
let socket1 = null;
let socket2 = null;
let chatGroupId = null;
let roomName = null;
let user1MessageId = null;
let user2MessageId = null;

let user1ReceivedUser2Message = false;
let user2ReceivedUser1Message = false;
let user1MessageMarkedAsRead = false;
let user2MessageMarkedAsRead = false;
let user1ConnectedAndJoined = false;
let user2ConnectedAndJoined = false;
let user2MessageSent = false;
let testFinished = false;

// --- Helper Functions ---

function cleanupAndExit(exitCode = 0) {
    if (testFinished) return;
    testFinished = true;
    console.log(`\n--- Test Finishing (Exit Code: ${exitCode}) ---`);
    if (socket1 && socket1.connected) socket1.disconnect();
    if (socket2 && socket2.connected) socket2.disconnect();
    setTimeout(() => process.exit(exitCode), 500);
}

function checkCompletion() {
    if (user1ReceivedUser2Message && user2ReceivedUser1Message && user1MessageMarkedAsRead && user2MessageMarkedAsRead) {
        console.log('\nSUCCESS: Full chat cycle including read status updates completed!');
        cleanupAndExit(0);
    }
}

// Send message via API, now includes sender names
async function sendApiMessage(senderUserId, senderName, senderCompanyName, message) {
    console.log(`\nSending POST request to ${API_ENDPOINT} for ${senderUserId} (${senderName})...`);
    try {
        const payload = {
            contextApp: TEST_CONTEXT_APP,
            contextEntityType: TEST_CONTEXT_ENTITY_TYPE,
            contextEntityId: TEST_CONTEXT_ENTITY_ID,
            senderUserId: senderUserId,
            senderName: senderName, // Include senderName
            senderCompanyName: senderCompanyName, // Include senderCompanyName (can be undefined/null)
            message: message,
            groupName: `Test Auth Group ${TEST_CONTEXT_ENTITY_ID}`
        };
        const response = await axios.post(API_ENDPOINT, payload, { headers: AUTH_HEADER });

        if (response.data?.success && response.data?.data) {
             console.log(`POST Request Successful for ${senderUserId} (Status: ${response.status})`);
             console.log('Received Chat Group ID:', response.data.data.chatGroupId);
             console.log('Created Message ID:', response.data.data._id);
             return response.data.data;
        } else {
             console.error(`POST Request for ${senderUserId} returned success=false or missing data.`);
             return null;
        }
    } catch (error) {
        console.error(`\n--- POST Request Failed for ${senderUserId} ---`);
        if (axios.isAxiosError(error)) {
            console.error(`Status: ${error.response?.status}`);
            console.error('Response Data:', error.response?.data);
        } else {
            console.error('Error:', error.message || error);
        }
        console.error('---------------------------\n');
        return null;
    }
}

async function markMessageReadApi(messageId, markAsRead = true) {
     if (!messageId) {
         console.error('Cannot mark message as read: messageId is null.');
         return false;
     }
     const url = `${API_ENDPOINT}/${messageId}/status`;
     console.log(`\nSending PATCH request to ${url} to set isRead=${markAsRead}...`);
     try {
         const payload = { isRead: markAsRead };
         const response = await axios.patch(url, payload, { headers: AUTH_HEADER });

         if (response.data?.success) {
             console.log(`PATCH Request Successful for message ${messageId} (Status: ${response.status})`);
             return true;
         } else {
             console.error(`PATCH Request for message ${messageId} returned success=false.`);
             return false;
         }
     } catch (error) {
         console.error(`\n--- PATCH Request Failed for message ${messageId} ---`);
         if (axios.isAxiosError(error)) {
             console.error(`Status: ${error.response?.status}`);
             console.error('Response Data:', error.response?.data);
         } else {
             console.error('Error:', error.message || error);
         }
         console.error('---------------------------\n');
         return false;
     }
}


function joinChatRoom(socket, userId) {
    if (socket && socket.connected && roomName) {
        console.log(`${userId} joining room: ${roomName}`);
        socket.emit('joinRoom', roomName);
    } else {
         console.error(`${userId} cannot join room. Socket connected: ${socket?.connected}, Room name: ${roomName}`);
    }
}

function setupSocketListeners(socket, userIdentifier) {
     socket.on('newMessage', async (message) => {
        if (testFinished) return;
        console.log(`\n--- ${userIdentifier} Received Message ---`);
        // Log sender name from received message
        console.log(`From: ${message.senderName} (${message.senderUserId})`);
        console.log('Message:', message);

        if (userIdentifier === 'User 1' && message.senderUserId === USER2_SENDER_ID && message.message === USER2_MESSAGE) {
            console.log(`User 1 received correct message from ${USER2_SENDER_NAME}! (ID: ${message._id})`);
            user1ReceivedUser2Message = true;
            user2MessageId = message._id;
            await markMessageReadApi(user2MessageId, true);
        }
        else if (userIdentifier === 'User 2' && message.senderUserId === USER1_SENDER_ID && message.message === USER1_MESSAGE) {
            console.log(`User 2 received correct message from ${USER1_SENDER_NAME}! (ID: ${message._id})`);
            user2ReceivedUser1Message = true;
            user1MessageId = message._id;
            await markMessageReadApi(user1MessageId, true);
        } else {
             console.log(`${userIdentifier} received a message, but not the expected one.`);
        }
        console.log('--------------------------------------\n');
    });

    socket.on('messageReadStatusChanged', (data) => {
         if (testFinished) return;
         console.log(`\n--- ${userIdentifier} Received Read Status Change ---`);
         console.log('Data:', data);

         if (data.messageId === user1MessageId && data.isRead === true) {
             console.log(`Read status confirmed for User 1's message (ID: ${user1MessageId})`);
             user1MessageMarkedAsRead = true;
             checkCompletion();
         }
         else if (data.messageId === user2MessageId && data.isRead === true) {
             console.log(`Read status confirmed for User 2's message (ID: ${user2MessageId})`);
             user2MessageMarkedAsRead = true;
             checkCompletion();
         }
         console.log('-------------------------------------------\n');
    });


     socket.on('connect_error', (error) => {
        console.error(`${userIdentifier} Connection Error: ${error.message}`);
        if (!testFinished) cleanupAndExit(1);
    });

    socket.on('disconnect', (reason) => {
        console.log(`${userIdentifier} disconnected: ${reason}`);
        if (userIdentifier === 'User 1') user1ConnectedAndJoined = false;
        else user2ConnectedAndJoined = false;

        if (!testFinished && reason !== 'io client disconnect') {
            console.error(`${userIdentifier} disconnected unexpectedly.`);
            cleanupAndExit(1);
        }
    });

    socket.on('joinError', (error) => {
         console.error(`${userIdentifier} failed to join room: ${error.message}`);
         cleanupAndExit(1);
    });
}


// --- Main Test Flow ---

async function runTest() {
    console.log(`--- Starting Test ---`);
    console.log(`Target Server URL: ${SERVER_URL}`);

    // 1. Send User 1's message
    const firstMessageData = await sendApiMessage(
        USER1_SENDER_ID,
        USER1_SENDER_NAME,
        USER1_COMPANY_NAME, // Pass company name
        USER1_MESSAGE
    );
    if (!firstMessageData || !firstMessageData.chatGroupId || !firstMessageData._id) {
        console.error('Failed to send first message or get required IDs. Aborting.');
        cleanupAndExit(1);
        return;
    }
    chatGroupId = firstMessageData.chatGroupId;
    user1MessageId = firstMessageData._id;
    roomName = `chat-${chatGroupId}`;
    console.log(`Established Chat Group ID: ${chatGroupId}, Room Name: ${roomName}`);
    console.log(`User 1 Message ID: ${user1MessageId}`);

    // 2. Connect both sockets
    console.log(`\nConnecting User 1 (${USER1_SENDER_NAME})...`);
    socket1 = io(WEBSOCKET_URL);
    console.log(`Connecting User 2 (${USER2_SENDER_NAME})...`);
    socket2 = io(WEBSOCKET_URL);

    // 3. Setup listeners and join rooms upon connection
    socket1.on('connect', () => {
        if (!socket1) return;
        console.log(`User 1 (${USER1_SENDER_NAME}) connected with ID: ${socket1.id}`);
        setupSocketListeners(socket1, 'User 1');
        joinChatRoom(socket1, 'User 1');
        user1ConnectedAndJoined = true;
        trySendUser2Message();
    });

    socket2.on('connect', () => {
        if (!socket2) return;
        console.log(`User 2 (${USER2_SENDER_NAME}) connected with ID: ${socket2.id}`);
        setupSocketListeners(socket2, 'User 2');
        joinChatRoom(socket2, 'User 2');
        user2ConnectedAndJoined = true;
        trySendUser2Message();
    });

}

// Function to send User 2's message only when both are connected/joined
async function trySendUser2Message() {
    if (user1ConnectedAndJoined && user2ConnectedAndJoined && !user2MessageSent) {
        user2MessageSent = true;
        console.log('\nBoth users connected and joined room. Sending User 2 message...');
        const messageData = await sendApiMessage(
            USER2_SENDER_ID,
            USER2_SENDER_NAME,
            null, // User 2 has no company name
            USER2_MESSAGE
        );
        if (!messageData || !messageData._id) {
            console.error("Failed to send User 2's message or get its ID. Aborting test.");
            cleanupAndExit(1);
        } else {
             user2MessageId = messageData._id;
             console.log(`\nUser 2 message sent (ID: ${user2MessageId}). Waiting for broadcasts and read status updates...`);
        }
    }
}

// --- Start Test ---
runTest();

// --- Global Timeout ---
setTimeout(() => {
    if (!testFinished) {
        console.error('\n--- TEST TIMEOUT (25 seconds) ---');
        if (!user1ReceivedUser2Message) console.error('Timeout: User 1 did not receive message from User 2.');
        if (!user2ReceivedUser1Message) console.error('Timeout: User 2 did not receive message from User 1.');
        if (!user1MessageMarkedAsRead) console.error("Timeout: User 1's message was not marked as read.");
        if (!user2MessageMarkedAsRead) console.error("Timeout: User 2's message was not marked as read.");
        cleanupAndExit(1);
    }
}, 25000);

// --- Exit Handler ---
process.on('SIGINT', () => {
  console.log('\nCaught interrupt signal (Ctrl+C)');
  cleanupAndExit(1);
});
