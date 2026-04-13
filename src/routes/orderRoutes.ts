import express, { Router } from 'express'
import { createOrder, getOrders, addOrderComment } from '../controllers/orderController'

const router: Router = express.Router()

router.post('/orders', createOrder)
router.get('/orders', getOrders)
router.post('/orders/:id/comments', addOrderComment)

export default router
