import 'dotenv/config'
import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import fs from 'fs'
import connectDB from './config/database'
import clientRoutes from './routes/clientRoutes'
import uploadRoutes from './routes/uploadRoutes'
import dashboardRoutes from './routes/dashboardRoutes'
import http from 'http'
import { initSocket } from './socket/socket'

const app: Express = express()
const PORT: number | string = process.env.PORT || 3000

// Connect to Database
connectDB()

// Middleware
app.use(cors())
app.use(express.json({ limit: '5gb' }))
app.use(express.urlencoded({ extended: true, limit: '5gb' }))

// Routes
app.use('/', clientRoutes)
app.use('/', uploadRoutes)
app.use('/', dashboardRoutes)
app.use('/uploads', express.static('uploads'))

// Basic health check
app.get('/', (req: Request, res: Response) => {
  res.send('API is running')
})

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads')
}

const server = http.createServer(app)
initSocket(server)

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
