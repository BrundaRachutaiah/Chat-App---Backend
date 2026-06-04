const http = require("http")
const { Server } = require("socket.io")
const Messages = require("./models/Message.js")
const { app, connectMongo } = require("./app")
const server = http.createServer(app)

const defaultAllowedOrigins = [
    process.env.CLIENT_ORIGIN,
    process.env.FRONTEND_URL,
    "https://chat-app-frontend-beige-kappa.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
].filter(Boolean)

const isAllowedOrigin = (origin) => {
    if (!origin) return true
    if (defaultAllowedOrigins.includes(origin)) return true

    try {
        const parsed = new URL(origin)
        return (
            parsed.hostname === "localhost" ||
            parsed.hostname === "127.0.0.1" ||
            parsed.hostname.endsWith(".vercel.app")
        )
    } catch (error) {
        return false
    }
}

const io = new Server(server, {
    cors: {
        origin(origin, callback) {
            if (isAllowedOrigin(origin)) return callback(null, true)
            return callback(new Error(`CORS blocked for origin: ${origin}`))
        },
        credentials: true,
    },
})

io.on("connection", (socket) => {
    console.log("User connected", socket.id)

    socket.on("join", ({ username }) => {
        if (!username) return
        socket.data.username = username
        socket.join(username)
        socket.emit("joined", { username })
    })

    socket.on("typing_start", ({ from, to }) => {
        if (!from || !to) return
        io.to(to).emit("typing_start", { from })
    })

    socket.on("typing_stop", ({ from, to }) => {
        if (!from || !to) return
        io.to(to).emit("typing_stop", { from })
    })

    socket.on("send_message", async (data, ack) => {
        try {
            const { sender, receiver, message, clientMessageId } = data || {}
            if (!sender || !receiver || !message) return

            const newMessage = new Messages({ sender, receiver, message, clientMessageId })
            await newMessage.save()

            const receiverRoom = io.sockets.adapter.rooms.get(receiver)
            const receiverOnline = Boolean(receiverRoom && receiverRoom.size > 0)
            if (receiverOnline) {
                newMessage.deliveredAt = new Date()
                await newMessage.save()
            }

            const payload = newMessage.toObject()
            socket.emit("message_sent", payload)
            io.to(receiver).emit("receive_message", payload)

            if (receiverOnline) {
                io.to(sender).emit("message_delivered", {
                    messageId: payload._id,
                    deliveredAt: payload.deliveredAt,
                })
            }

            if (typeof ack === "function") ack(payload)
        } catch (error) {
            console.error("send_message error", error)
            if (typeof ack === "function") ack({ error: "SEND_FAILED" })
        }
    })

    socket.on("mark_read", async ({ sender, receiver }) => {
        try {
            if (!sender || !receiver) return
            const readAt = new Date()

            const result = await Messages.updateMany(
                { sender, receiver, readAt: null },
                { $set: { readAt } }
            )

            if (result.modifiedCount > 0) {
                io.to(sender).emit("messages_read", { sender, receiver, readAt })
            }
            io.to(receiver).emit("messages_read_ack", { sender, receiver, readAt })
        } catch (error) {
            console.error("mark_read error", error)
        }
    })

   

    socket.on("disconnect", () => {
        console.log("User disconnected", socket.id)
    })
})

const PORT = process.env.PORT || 5001

async function start() {
    try {
        await connectMongo()
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
    } catch (error) {
        console.error("Failed to start server (MongoDB connection error):", error)
        process.exit(1)
    }
}

start()
