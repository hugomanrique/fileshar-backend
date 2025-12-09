import express, { Router, Request } from 'express';
import { handleUpload, getFiles, updateFile } from '../controllers/uploadController';

const router: Router = express.Router();
router.post('/upload', handleUpload);
router.get('/files', getFiles);
router.patch('/files/:id', updateFile);

export default router;
