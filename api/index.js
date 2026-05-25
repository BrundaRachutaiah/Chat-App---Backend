const { app, connectMongo } = require("../app")

let mongoReadyPromise = null
async function ensureMongo() {
  if (!mongoReadyPromise) mongoReadyPromise = connectMongo()
  return mongoReadyPromise
}

module.exports = async (req, res) => {
  try {
    await ensureMongo()
    return app(req, res)
  } catch (error) {
    console.error("Vercel handler error:", error)
    res.statusCode = 500
    res.end("Server error")
  }
}

