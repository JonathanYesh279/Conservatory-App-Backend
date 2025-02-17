import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initializeMongoDB } from './services/mongoDB.service.js'

const app = express()

// Middlewares
app.use(cors())
app.use(express.json())

// Initialzie MongoDB
await initializeMongoDB().catch(console.error)

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'Server is running'
    })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})