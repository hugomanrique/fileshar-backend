import express, { Router } from 'express'
import { searchClients, updateClient, unifyClients } from '../controllers/clientController'

const router: Router = express.Router()

router.get('/clients', searchClients)
router.patch('/clients/:id', updateClient)
router.post('/clients/unify', unifyClients)

export default router
