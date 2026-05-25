const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const dotenv = require("dotenv")
const authRoutes = require("./routes/auth.js")
const Messages = require("./models/Message.js")
const User = require("./models/User.js")

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

async function connectMongo() {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    throw new Error("Missing MONGO_URI in environment (.env)")
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  })
  console.log("Mongodb connected.")

  await dropLegacyEmailUniqueIndex()
}

async function dropLegacyEmailUniqueIndex() {
  try {
    const collection = mongoose.connection.db.collection("users")
    const indexes = await collection.indexes()
    const emailIndex = indexes.find((idx) => idx.name === "email_1")
    if (!emailIndex) return

    const isEmailKey = Boolean(emailIndex.key && emailIndex.key.email === 1)
    if (!isEmailKey) return

    // If a unique email index exists, and our app doesn't use email during registration,
    // inserts will fail because "missing email" is indexed as null for every document.
    await collection.dropIndex("email_1")
    console.log("Dropped legacy MongoDB index: users.email_1")
  } catch (error) {
    // Non-fatal; continue running even if we can't inspect/drop indexes.
    console.warn("Index check/drop skipped:", error?.message || error)
  }
}

app.use("/auth", authRoutes)

app.get("/messages", async (req, res) => {
  const { sender, receiver } = req.query
  try {
    const messages = await Messages.find({
      $or: [{ sender, receiver }, { sender: receiver, receiver: sender }],
    }).sort({ createdAt: 1 })
    res.json(messages)
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages" })
  }
})

// Returns unread counts grouped by sender for the given receiver (username).
// Example response: { "ammu": 2, "karthi": 5 }
app.get("/unread-counts", async (req, res) => {
  const { username } = req.query
  if (!username) return res.status(400).json({ message: "username is required" })

  try {
    const rows = await Messages.aggregate([
      { $match: { receiver: username, readAt: null } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ])

    const counts = rows.reduce((acc, row) => {
      if (row && row._id) acc[row._id] = row.count || 0
      return acc
    }, {})

    res.json(counts)
  } catch (error) {
    console.error("unread-counts error", error)
    res.status(500).json({ message: "Error fetching unread counts" })
  }
})

app.get("/users", async (req, res) => {
  const { currentUser } = req.query
  try {
    const users = await User.find({ username: { $ne: currentUser } })
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" })
  }
})

module.exports = { app, connectMongo }

