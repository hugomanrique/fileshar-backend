import express, { Router, Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { handleUpload } from '../controllers/uploadController';

const router: Router = express.Router();

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    cb(null, 'uploads/');
  },
  filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 50 } // Limit to 50MB
});

router.post('/upload', upload.single('archivo'), handleUpload);

export default router;
