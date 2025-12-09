import express, { Router } from 'express';
import { searchClients } from '../controllers/clientController';

const router: Router = express.Router();

router.get('/clients', searchClients);

export default router;
