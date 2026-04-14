import express, { Router } from 'express'
import { createOrder, getOrders, addOrderComment, updateProductTallas, updateProductPersonalizaciones } from '../controllers/orderController'

const router: Router = express.Router()

router.post('/orders', createOrder)
router.get('/orders', getOrders)
router.post('/orders/:id/comments', addOrderComment)
router.put('/orders/:id/products/:productId/tallas', updateProductTallas)
router.put('/orders/:id/products/:productId/personalizaciones', updateProductPersonalizaciones)

export default router
