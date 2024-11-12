const { WebSocketServer } = require("ws");
const http = require("http");
const uuidv4 = require("uuid").v4;
const url = require("url");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const server = http.createServer();
const wsServer = new WebSocketServer({ server });

const port = 8000;
const connections = {};
const users = {};
const chatHistory = []; // Local chat history in memory for quick access
const MAX_HISTORY = 100; // Maximum number of messages to keep in memory

// MongoDB connection setup
const mongoUri = process.env.MONGODB_URI_QUESTER;
const dbName = "testchat";
const collectionName = "messages";
let messageCollection;

MongoClient.connect(mongoUri)
  .then((client) => {
    console.log("Connected to MongoDB");
    const db = client.db(dbName);
    messageCollection = db.collection(collectionName);

    // Load initial chat history from MongoDB on server startup
    return messageCollection
      .find()
      .sort({ timestamp: 1 })
      .limit(MAX_HISTORY)
      .toArray();
  })
  .then((initialHistory) => {
    chatHistory.push(...initialHistory); // Load initial history into memory
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

// Helper function to send JSON message to a specific connection
const sendJsonMessage = (connection, message) => {
  if (connection.readyState === 1) {
    connection.send(JSON.stringify(message));
  }
};

// Broadcast messages to all connected clients
const broadcast = (message) => {
  Object.values(connections).forEach((connection) => {
    sendJsonMessage(connection, message);
  });
};

// Broadcast user list update
const broadcastUsers = () => {
  const userList = {
    type: "users",
    users: Object.values(users).map(({ username }) => ({ username })),
  };
  broadcast(userList);
};

// Handle different types of messages
const handleMessage = async (messageData, uuid) => {
  const user = users[uuid];
  if (!user) return;

  try {
    const message = JSON.parse(messageData.toString());

    switch (message.type) {
      case "message":
        // Handle chat message
        const chatMessage = {
          type: "message",
          content: message.content,
          username: user.username,
          timestamp: new Date().toISOString(),
        };

        // Store in local chat history
        chatHistory.push(chatMessage);
        if (chatHistory.length > MAX_HISTORY) {
          chatHistory.shift(); // Remove oldest message if exceeded max
        }

        // Store in MongoDB
        if (messageCollection) {
          await messageCollection.insertOne(chatMessage);
        } else {
          console.warn("Message collection is not initialized");
        }

        // Broadcast to all clients
        broadcast(chatMessage);
        break;

      case "get_history":
        // Send chat history to requesting client
        const historyMessage = {
          type: "history",
          messages: chatHistory,
        };
        sendJsonMessage(connections[uuid], historyMessage);
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
};

// Handle client disconnection
const handleClose = (uuid) => {
  const username = users[uuid]?.username;
  console.log(`${username} disconnected`);

  delete connections[uuid];
  delete users[uuid];

  // Broadcast updated user list
  broadcastUsers();
};

// Handle new client connection
wsServer.on("connection", (connection, request) => {
  const { username } = url.parse(request.url, true).query;
  const uuid = uuidv4();

  console.log(`${username} connected`);

  // Store connection and user info
  connections[uuid] = connection;
  users[uuid] = {
    username,
    connectedAt: new Date().toISOString(),
  };

  // Send initial chat history to new client
  const historyMessage = {
    type: "history",
    messages: chatHistory,
  };
  sendJsonMessage(connection, historyMessage);

  // Broadcast updated user list to all clients
  broadcastUsers();

  // Set up event handlers for this connection
  connection.on("message", (message) => handleMessage(message, uuid));
  connection.on("close", () => handleClose(uuid));
  connection.on("error", (error) => {
    console.error(`WebSocket error for ${username}:`, error);
    handleClose(uuid);
  });
});

// Error handling for the server
wsServer.on("error", (error) => {
  console.error("WebSocket server error:", error);
});

server.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`);
});
