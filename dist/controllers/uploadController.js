"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpload = void 0;
const Client_1 = __importDefault(require("../models/Client"));
const File_1 = __importDefault(require("../models/File"));
const handleUpload = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }
        const { nombre, identificacion, email, telefono, copias, impresora, comentarios, tamaño } = req.body;
        // 1. Find or Create Client
        // Priority search by identificacion, then name
        let client = null;
        if (identificacion) {
            client = await Client_1.default.findOne({ identificacion });
        }
        if (!client && nombre) {
            // If not found by ID, try finding by name if ID wasn't exclusive? 
            // Or just create new if ID provided but not found.
            // Let's assume if ID is provided, we expect valid match or new client.
            // If no ID, we might search by name? Safer to create new one or unique constraint.
            // For simplicity, if not found, create.
        }
        if (!client) {
            client = new Client_1.default({
                nombre: nombre || 'Unknown Client',
                identificacion,
                email,
                celular: telefono
            });
            await client.save();
        }
        else {
            // Update existing client info if provided?
            if (email)
                client.email = email;
            if (telefono)
                client.celular = telefono;
            await client.save();
        }
        // 2. Create File Record
        const newFile = new File_1.default({
            nombre: req.file.originalname, // Using filename as File Name
            // fecha: default now
            // status: default pending
            tamaño: tamaño || req.file.size.toString(),
            cliente: client._id,
            copias: copias ? parseInt(copias, 10) : 1,
            impresora,
            observaciones: comentarios
        });
        await newFile.save();
        console.log('File Saved:', newFile);
        res.json({
            message: 'File uploaded and saved successfully',
            file: newFile,
            client: client
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Server error during upload' });
    }
};
exports.handleUpload = handleUpload;
