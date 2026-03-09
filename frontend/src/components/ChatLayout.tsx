import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
  where,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../AuthContext";

type Room = {
  id: string;
  name: string;
  description?: string;
  memberIds?: string[];
  lastMessageAt?: { seconds: number; nanoseconds: number };
};

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  type: "user" | "ai" | "system";
  content: string;
  createdAt?: { seconds: number; nanoseconds: number };
};

type Presence = {
  id: string;
  displayName: string;
  lastSeen?: { seconds: number };
};

type TypingUser = {
  id: string;
  displayName: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function ChatLayout() {
  const { user, orgSlug, logout } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [aiInvoking, setAiInvoking] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastReadByRoom, setLastReadByRoom] = useState<Record<string, number>>(
    () => {
      try {
        const raw = localStorage.getItem("teamchat_last_read");
        return raw ? (JSON.parse(raw) as Record<string, number>) : {};
      } catch {
        return {};
      }
    },
  );

  const orgPath = useMemo(() => {
    if (!orgSlug) return null;
    return doc(db, "organizations", orgSlug);
  }, [orgSlug]);

  // Whenever active room changes, mark it as "read" now
  useEffect(() => {
    if (!activeRoomId) return;
    setLastReadByRoom((prev) => {
      const next = { ...prev, [activeRoomId]: Date.now() };
      try {
        localStorage.setItem("teamchat_last_read", JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [activeRoomId]);

  // Load current user's org-level role (admin/member) from organizations/{org}/users/{uid}
  useEffect(() => {
    if (!user || !orgPath) {
      setIsAdmin(false);
      return;
    }
    const userRef = doc(orgPath, "users", user.uid);
    getDoc(userRef)
      .then((snap) => {
        const data = snap.data() as any | undefined;
        setIsAdmin(data?.role === "admin");
      })
      .catch(() => {
        setIsAdmin(false);
      });
  }, [user, orgPath]);

  useEffect(() => {
    if (!user || !orgSlug || !orgPath) return;

    const roomsCol = collection(orgPath, "rooms");
    const q = query(roomsCol, where("memberIds", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data: Room[] = [];
      snap.forEach((d) =>
        data.push({
          id: d.id,
          ...(d.data() as any),
        }),
      );
      setRooms(data);
      if (!activeRoomId && data.length > 0) {
        setActiveRoomId(data[0].id);
      }
    });
    return () => unsub();
  }, [user, orgSlug, orgPath, activeRoomId]);

  useEffect(() => {
    if (!orgPath || !activeRoomId) {
      setMessages([]);
      return;
    }
    const msgsCol = collection(doc(orgPath, "rooms", activeRoomId), "messages");
    const q = query(msgsCol, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const data: Message[] = [];
      snap.forEach((d) =>
        data.push({
          id: d.id,
          ...(d.data() as any),
        }),
      );
      setMessages(data);
    });
    return () => unsub();
  }, [orgPath, activeRoomId]);

  useEffect(() => {
    if (!user || !orgPath) return;
    const presenceCol = collection(orgPath, "presence");

    const presenceDocRef = doc(presenceCol, user.uid);
    const updatePresence = async () => {
      await setDoc(
        presenceDocRef,
        {
          userId: user.uid,
          displayName: user.displayName || user.email || "Unknown",
          lastSeen: serverTimestamp(),
          currentRoomId: activeRoomId ?? null,
        },
        { merge: true },
      );
    };

    updatePresence();
    const interval = setInterval(updatePresence, 20000);

    const unsub = onSnapshot(presenceCol, (snap) => {
      const data: Presence[] = [];
      snap.forEach((d) =>
        data.push({
          id: d.id,
          ...(d.data() as any),
        }),
      );
      setPresence(data);
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [user, orgPath, activeRoomId]);

  useEffect(() => {
    if (!orgPath || !activeRoomId) {
      setTypingUsers([]);
      return;
    }
    const typingCol = collection(
      doc(orgPath, "rooms", activeRoomId),
      "typing",
    );
    const unsub = onSnapshot(typingCol, (snap) => {
      const data: TypingUser[] = [];
      snap.forEach((d) => {
        const val = d.data() as any;
        if (val.isTyping) {
          data.push({
            id: d.id,
            displayName: val.displayName || "Someone",
          });
        }
      });
      setTypingUsers(data);
    });
    return () => unsub();
  }, [orgPath, activeRoomId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgPath || !activeRoomId) return;
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    setSending(true);
    const roomRef = doc(orgPath, "rooms", activeRoomId);
    const msgsCol = collection(roomRef, "messages");
    const displayName = user.displayName || user.email || "You";

    try {
      await addDoc(msgsCol, {
        senderId: user.uid,
        senderName: displayName,
        senderRole: "member",
        type: "user",
        content: trimmed,
        createdAt: serverTimestamp(),
      });

      setNewMessage("");
      const typingDoc = doc(roomRef, "typing", user.uid);
      await setDoc(
        typingDoc,
        {
          userId: user.uid,
          displayName,
          isTyping: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (/@(gemini|ai)/i.test(trimmed)) {
        setAiInvoking(true);
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
            console.error("No authenticated user found when invoking AI");
            return;
          }

          // Force refresh to ensure latest custom claims (orgSlug) are present
          const idToken = await currentUser.getIdToken(true);

          const res = await fetch(
            `${API_BASE_URL}/api/orgs/${orgSlug}/rooms/${activeRoomId}/ai/complete`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({}),
            },
          );

          if (!res.ok) {
            const text = await res.text();
            console.error("AI invoke failed", res.status, text);
          }
        } finally {
          setAiInvoking(false);
        }
      }
    } finally {
      setSending(false);
    }
  };

  const handleTypingChange = async (value: string) => {
    setNewMessage(value);
    if (!user || !orgPath || !activeRoomId) return;
    const roomRef = doc(orgPath, "rooms", activeRoomId);
    const typingDoc = doc(roomRef, "typing", user.uid);
    const displayName = user.displayName || user.email || "You";
    await setDoc(
      typingDoc,
      {
        userId: user.uid,
        displayName,
        isTyping: value.length > 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  };

  const onlineUsers = presence;

  const formatTime = (msg: Message) => {
    if (!msg.createdAt?.seconds) return "";
    const d = new Date(msg.createdAt.seconds * 1000);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleCreateRoom = async () => {
    if (!user || !orgPath) return;
    if (!isAdmin) return;

    const name = window.prompt("New room name (without #):");
    if (!name) return;
    const description =
      window.prompt("Room description (optional):") ?? "";

    const roomsCol = collection(orgPath, "rooms");
    await addDoc(roomsCol, {
      name: name.trim(),
      description: description.trim() || null,
      memberIds: [user.uid],
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo">TeamChat AI</div>
        <div className="header-right">
          <span className="pill">
            Org: <strong>{orgSlug}</strong>
          </span>
          <span className="pill">
            {user?.email}{" "}
            <button onClick={logout} className="link-button">
              Log out
            </button>
          </span>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <span>Rooms</span>
            {isAdmin && (
              <button
                type="button"
                className="link-button"
                onClick={handleCreateRoom}
              >
                + New Room
              </button>
            )}
          </div>
          <ul className="room-list">
            {rooms.map((room) => (
              <li
                key={room.id}
                className={
                  "room-item" + (room.id === activeRoomId ? " active" : "")
                }
                onClick={() => setActiveRoomId(room.id)}
              >
                <div className="room-name"># {room.name}</div>
                {room.lastMessageAt &&
                  room.id !== activeRoomId &&
                  (!lastReadByRoom[room.id] ||
                    lastReadByRoom[room.id] <
                      room.lastMessageAt.seconds * 1000) && (
                    <span className="unread-dot" aria-label="unread messages" />
                  )}
                {room.description && (
                  <div className="room-desc">{room.description}</div>
                )}
              </li>
            ))}
          </ul>
        </aside>
        <main className="chat-main">
          <div className="messages">
            {messages.map((msg) => {
              const isSelf = msg.senderId === user?.uid;
              const timeStr = formatTime(msg);
              const messageClass =
                msg.type === "ai"
                  ? "message-ai"
                  : isSelf
                    ? "message-self"
                    : "message-user";
              return (
                <div key={msg.id} className={"message " + messageClass}>
                  <div className="message-meta">
                    <span className="sender">
                      {msg.senderName || msg.senderId || "Unknown"}
                    </span>
                    {isSelf && timeStr && (
                      <span className="timestamp">{timeStr}</span>
                    )}
                  </div>
                  {isSelf ? (
                    <div className="message-content">
                      {msg.content || "\u00a0"}
                    </div>
                  ) : (
                    <div className="message-content-line">
                      <span className="message-content">
                        {msg.content || "\u00a0"}
                      </span>
                      {timeStr && (
                        <span className="timestamp">{timeStr}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="composer-area">
            <div className="typing-indicator">
              {typingUsers.length > 0 && (
                <span>
                  {typingUsers.map((t) => t.displayName).join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing...
                </span>
              )}
              {aiInvoking && <span>Gemini is thinking...</span>}
            </div>
            <form onSubmit={handleSendMessage} className="composer">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => handleTypingChange(e.target.value)}
                placeholder="Type a message... Mention @Gemini or @AI to invoke the assistant"
              />
              <button type="submit" disabled={sending}>
                Send
              </button>
            </form>
          </div>
        </main>
        <aside className="sidebar right">
          <div className="sidebar-header">
            <span>Online</span>
          </div>
          <ul className="presence-list">
            {onlineUsers.map((u) => (
              <li key={u.id}>{u.displayName}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

