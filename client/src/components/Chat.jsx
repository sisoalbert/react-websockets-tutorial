import React, { useState, useEffect, useRef } from "react";
import useWebSocket from "react-use-websocket";

const ChatMessage = ({ message, isCurrentUser }) => (
  <div
    style={{
      display: "flex",
      marginBottom: "16px",
    }}
  >
    <div
      style={{
        maxWidth: "85%",
        padding: "12px",
        borderRadius: "8px",
        wordBreak: "break-word",
        ...(isCurrentUser
          ? {
              marginLeft: "auto",
              backgroundColor: "#0084ff",
              color: "white",
            }
          : {
              backgroundColor: "#e4e6eb",
              color: "black",
            }),
      }}
    >
      <div
        style={{
          fontSize: "12px",
          marginBottom: "4px",
          fontWeight: "bold",
        }}
      >
        {message.username}
      </div>
      <div>{message.content}</div>
    </div>
  </div>
);

const UsersList = ({ users, isMobile, showUsers, onClose }) => (
  <div
    style={{
      backgroundColor: "white",
      borderRadius: "8px",
      padding: "20px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      ...(isMobile
        ? {
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "80%",
            maxWidth: "300px",
            transform: showUsers ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.3s ease",
            zIndex: 1000,
          }
        : {
            width: "200px",
            marginLeft: "20px",
          }),
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "16px",
      }}
    >
      <h3 style={{ fontSize: "16px", margin: 0 }}>Online Users</h3>
      {isMobile && (
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "none",
            fontSize: "20px",
            cursor: "pointer",
            padding: "5px",
          }}
        >
          ✕
        </button>
      )}
    </div>
    {Object.values(users).map((user) => (
      <div
        key={user.username}
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            backgroundColor: "#31a24c",
            borderRadius: "50%",
            marginRight: "8px",
          }}
        />
        <span>{user.username}</span>
      </div>
    ))}
  </div>
);

const ChatApp = ({ username }) => {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [showUsers, setShowUsers] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const WS_URL = `ws://127.0.0.1:8000`;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(
    WS_URL,
    {
      share: true,
      queryParams: { username },
      onOpen: () => {
        console.log("WebSocket Connected");
      },
      onError: (error) => {
        console.error("WebSocket Error:", error);
      },
      onClose: () => {
        console.log("WebSocket Disconnected");
      },
      reconnectAttempts: 10,
      reconnectInterval: 3000,
      shouldReconnect: () => true,
    }
  );

  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      sendJsonMessage({
        type: "get_history",
        username,
      });
    }
  }, [readyState, username, sendJsonMessage]);

  useEffect(() => {
    if (lastJsonMessage) {
      switch (lastJsonMessage.type) {
        case "message":
          setChatHistory((prev) => [...prev, lastJsonMessage]);
          break;
        case "history":
          if (Array.isArray(lastJsonMessage.messages)) {
            setChatHistory(lastJsonMessage.messages);
          }
          break;
        case "users":
          setOnlineUsers(lastJsonMessage.users);
          break;
        default:
          if (typeof lastJsonMessage === "object" && !lastJsonMessage.type) {
            setOnlineUsers(lastJsonMessage);
          }
      }
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      messagesContainerRef.current.scrollTo({
        top: maxScroll,
        behavior: "smooth",
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const newMessage = {
      type: "message",
      content: trimmedMessage,
      username,
      timestamp: new Date().toISOString(),
    };

    sendJsonMessage(newMessage);
    setMessage("");
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        padding: isMobile ? "10px" : "20px",
        backgroundColor: "#f0f2f5",
        position: "relative",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          padding: isMobile ? "10px" : "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px",
            borderBottom: "1px solid #e4e6eb",
          }}
        >
          <h2 style={{ margin: 0, fontSize: isMobile ? "18px" : "20px" }}>
            Chat
          </h2>
          {isMobile && (
            <button
              onClick={() => setShowUsers(true)}
              style={{
                border: "none",
                background: "#0084ff",
                color: "white",
                padding: "8px 12px",
                borderRadius: "20px",
                cursor: "pointer",
              }}
            >
              Users
            </button>
          )}
        </div>

        <div
          ref={messagesContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "10px" : "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {chatHistory.map((msg, index) => (
            <ChatMessage
              key={`${msg.timestamp}-${index}`}
              message={msg}
              isCurrentUser={msg.username === username}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: "10px",
            padding: isMobile ? "10px" : "20px",
            borderTop: "1px solid #e4e6eb",
          }}
        >
          <input
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "20px",
              border: "1px solid #e4e6eb",
              fontSize: "14px",
            }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
          />
          <button
            style={{
              padding: "10px 20px",
              backgroundColor: "#0084ff",
              color: "white",
              border: "none",
              borderRadius: "20px",
              cursor: "pointer",
              opacity: readyState !== WebSocket.OPEN ? 0.7 : 1,
            }}
            type="submit"
            disabled={readyState !== WebSocket.OPEN}
          >
            Send
          </button>
        </form>
      </div>

      {/* Users list - shown differently for mobile and desktop */}
      {(!isMobile || showUsers) && (
        <UsersList
          users={onlineUsers}
          isMobile={isMobile}
          showUsers={showUsers}
          onClose={() => setShowUsers(false)}
        />
      )}
    </div>
  );
};

export default ChatApp;
