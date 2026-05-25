const express = require("express")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const User = require("../models/User")
const dotenv = require("dotenv")
const router = express.Router()
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET

router.post("/register", async(req,res) => {
    const {username, password} = req.body

    try {
        const existingUser = await User.findOne({ username })
        if (existingUser){
            return res.status(400).json({message: "User already exists. Please Login."})
        }

        const salt = await bcrypt.genSalt(10);

        const hashedPassword = await bcrypt.hash(password, salt)

        const user = new User({username: username, password: hashedPassword})
        await user.save()

        const token = jwt.sign({ id: user._id}, JWT_SECRET, {expiresIn: "4h"})
        res.status(201).json({token, username})
    } catch (error) {
        console.error("register error:", error)

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: "Database not connected" })
        }

        res.status(500).json({message: "Server Error"})
    }
})

router.post("/login", async (req,res) => {
    const { username, password } = req.body
    try {
        const user = await User.findOne({ username })
        if(!user) return res.status(404).json({ message: "User not found."})
        
        const isPasswordMatch = await user.comparePassword(password)
        if(!isPasswordMatch) return res.status(400).json({message: "Invalid Credencials"})

        res.status(200).json({message: "Login successfull", username: user.username})
    } catch (error) {
        console.error("login error:", error)

        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ message: "Database not connected" })
        }

        res.status(500).json({message: "Server error while login."})
    }
})

module.exports = router
