"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchClients = void 0;
const Client_1 = __importDefault(require("../models/Client"));
const searchClients = async (req, res) => {
    try {
        const { nombre } = req.query;
        if (!nombre) {
            res.status(400).json({ message: 'El campo nombre es requerido' });
            return;
        }
        // Case-insensitive regex search
        const clients = await Client_1.default.find({
            nombre: { $regex: nombre, $options: 'i' }
        });
        res.json(clients);
    }
    catch (error) {
        console.error('Error searching clients:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.searchClients = searchClients;
