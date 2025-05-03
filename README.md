# Chat Service

A real-time chat service built with Node.js, TypeScript, Express, Mongoose, and Socket.IO.

## Features

-   **REST API:**
    -   `POST /api/messages`: Create new chat messages.    
    -   `GET /api/messages/:entityType/:entityId`: List messages for a specific entity (chat room/thread) with pagination.
    -   `PATCH  /messages/{messageId}/status: ` : Update message read status
-   **WebSocket Notifications:** Uses Socket.IO to broadcast new messages in real-time to clients subscribed to specific rooms (based on `entityType` and `entityId`).
-   **MongoDB Persistence:** Messages are stored in a MongoDB database using Mongoose.
-   **TypeScript:** Fully typed codebase for better maintainability and developer experience.
-   **OpenAPI Documentation:** API documented using OpenAPI 3.0 spec, available via Swagger UI at `/api-docs`.

## Project Structure
```
chat-service/
├── src/                  # Source code
│   ├── config/           # Configuration (DB, env vars)
│   ├── controllers/      # Express route handlers
│   ├── models/           # Mongoose models
│   ├── routes/           # Express routers
│   ├── utils/            # Utility functions/classes
│   ├── server.ts         # Main Express/Socket.IO server setup
│   └── socket.ts         # Socket.IO specific logic
├── .env                  # Environment variables (create this)
├── .gitignore            # Git ignore rules
├── nodemon.json          # Nodemon config for development
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript compiler options
├── openapi.yaml          # OpenAPI specification file
└── README.md             # This file
```
## Prerequisites

Ensure the following software is installed on your Windows or macOS system:

* **Node.js (v16 or later recommended):**
     Download the LTS (Long Term Support) installer from the official [Node.js website](https://nodejs.org/). Run the installer and follow the on-screen instructions. Verify installation by opening your terminal (Command Prompt or PowerShell on Windows, Terminal on macOS) and running `node -v` and `npm -v`.

* **MongoDB Community Server (v5 or later recommended):**   
    * **Installation (Windows):** Download the `.msi` installer from the [MongoDB Community Server Download page](https://www.mongodb.com/try/download/community). Follow the installation wizard. You might also want to install [MongoDB Compass](https://www.mongodb.com/try/download/compass) (a GUI tool). Ensure the MongoDB service is running after installation (check Windows Services).
    * **Installation (macOS):** The recommended way is using [Homebrew](https://brew.sh/) (a package manager for macOS).
        1.  Install Homebrew if you haven't already (follow instructions on their site).
        2.  Update Homebrew: `brew update`
        3.  Tap the MongoDB Homebrew Tap: `brew tap mongodb/brew`
        4.  Install MongoDB Community Edition: `brew install mongodb-community`
        5.  Start the MongoDB service: `brew services start mongodb-community`
        6.  Verify it's running: `brew services list`
    * **Verification:** Ensure the MongoDB server is running before starting the chat service.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd chat-service
    ```

2.  **Install dependencies:**
    ```bash
    npm install   
    ```

3.  **Create Environment File:**
    Create a `.env` file in the root directory and add your configuration:
    ```env
    # Server Configuration
    PORT=5050

    # MongoDB Configuration
    MONGODB_URI=mongodb://localhost:27017/chat_app # Replace with your MongoDB connection string

    # CORS Configuration
    CORS_ORIGIN=http://localhost:8080 # Frontend URL, '*' for dev (less secure)
       
    # Authorization Services (replace with actual URLs)
    AUTH_SERVICE_URL_NFG_PARTNER_BANK=http://partner-bank-auth-service:port/api/authorize
    AUTH_SERVICE_URL_NFG_CLIENT_PORTAL=http://client-portal-auth-service:port/api/authorize
    
    ```

## Running the Service

    First, build the TypeScript code into JavaScript:
    ```bash
    npm run build
    ```
    Then, start the server using the compiled code:
    ```bash
    npm start
    ```

## API Usage

The API is documented using OpenAPI. Once the server is running, access the interactive Swagger UI documentation at:

`http://localhost:5050/api-docs` (or your server's address)

**Endpoints:**

-   `POST /api/messages`
    -   Creates a message.
    -   **Request Body:** `{ "entityType": "string", "entityId": "string", "message": "string", "senderId": "string" }`
    -   **Response:** `201 Created` with the saved message object.
-   `GET /api/messages/:entityType/:entityId`
    -   Retrieves messages for a specific entity.
    -   **Path Parameters:** `entityType`, `entityId`
    -   **Query Parameters:** `page` (number, default: 1), `limit` (number, default: 20)
    -   **Response:** `200 OK` with paginated message list and metadata.

## WebSocket Communication

-   **Server Emits:**
    -   `newMessage`: When a new message is created via the POST API, the server emits this event *to a specific room*.
        -   **Room Name Format:** `chat-${entityType}-${entityId}` (e.g., `chat-project-proj_12345abc`)
        -   **Payload:** The full message object (as saved in the database).
-   **Client Actions (Examples):**
    -   **Connect:** Establish a WebSocket connection to the server (`http://localhost:5050` by default).
    -   **Join Room:** Emit a `joinRoom` event with the desired room name (e.g., `socket.emit('joinRoom', 'chat-project-proj_12345abc');`). This is recommended for the server to know which rooms the client is interested in.
    -   **Listen for Messages:** Listen for the `newMessage` event to receive new messages for the joined room(s) (`socket.on('newMessage', (message) => { ... });`).
    -   **Leave Room:** Emit a `leaveRoom` event when the client no longer needs updates for that room.

## Testing

A simple test client script (`test/testClient.ts`) is provided in TypeScript to verify the basic send/receive functionality between two simulated users. It establishes two WebSocket connections, joins both to a predefined room, sends messages via the HTTP API for each user, and listens for the corresponding messages broadcast back over the WebSocket to the other user.

**Steps to run the test client:**

1.  **Ensure the main chat server is running:** Use `npm run dev` or `npm start`.
2.  **Run the test script directly with Node.js:** Execute this command from the project root (`chat-service/`):
    ```bash
    node test/testClient.mjs
  
    ```
   

**Expected Output:**

You should see console logs indicating:
-   Connection attempts for both users.
-   Successful WebSocket connections for both.
-   Both users joining the test room.
-   Both users listening for messages.
-   Sending the POST requests for both users.
-   POST request success details.
-   Waiting for WebSocket broadcasts.
-   Finally, logs showing each user receiving the correct message from the other, followed by a "SUCCESS" message if the test passes.

The script will disconnect automatically after both messages are successfully exchanged or after a timeout.
