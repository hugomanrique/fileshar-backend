"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    try {
        const user = encodeURIComponent(process.env.MONGODB_USER ?? '');
        const password = encodeURIComponent(process.env.MONGODB_PASSWORD ?? '');
        const uriTemplate = process.env.MONGODB_HOST ?? '';
        const MONGODB_URI = uriTemplate
            .replace('{USER}', user)
            .replace('{PASSWORD}', password);
        const urlDB = `${MONGODB_URI}?authSource=admin`;
        console.log(urlDB);
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('MongoDB connected');
    }
    catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};
exports.default = connectDB;
