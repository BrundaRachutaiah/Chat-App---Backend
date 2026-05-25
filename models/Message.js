const mongoose = require("mongoose")

const messageSchema = new mongoose.Schema({
    clientMessageId: { type: String },
    sender: {type: String, required: true},
    receiver: {type: String, required: true},
    message: {type: String, required: true},
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
},{
    timestamps: true
})

module.exports = mongoose.model("Messages", messageSchema)
