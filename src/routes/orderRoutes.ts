import express, { Router } from 'express'
import { createOrder, getOrders, addOrderComment, updateProductTallas, updateProductPersonalizaciones, updateOrderStatus, updateProductImage, updateOrderVelocidad } from '../controllers/orderController'

const router: Router = express.Router()

router.post('/orders', createOrder)
router.get('/orders', getOrders)
router.post('/orders/:id/comments', addOrderComment)
router.put('/orders/:id/products/:productId/tallas', updateProductTallas)
router.put('/orders/:id/products/:productId/personalizaciones', updateProductPersonalizaciones)
router.put('/orders/:id/products/:productId/image', updateProductImage)
router.put('/orders/:id/status', updateOrderStatus)
router.put('/orders/:id/velocidad', updateOrderVelocidad)

export default router
