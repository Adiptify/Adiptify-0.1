import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || "mongodb+srv://yourowndata:Sthak%40cqpfa9f.mome=Adiptify",
  mongoDb: process.env.MONGO_DB || "nimbus",
  jwtSecret: process.env.JWT_SECRET || "2cf8be87-4b74-4c87-8780-9f2d9a08a01a",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  ollamaApiKey: process.env.OLLAMA_API_KEY || "66f17486842e4140ac9d697d9032bc5f.mvAfLKE3hEPTC8EIVwETDxzA",
  ollamaModel: process.env.OLLAMA_MODEL || "deepseek-v3.1:671b-cloud",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
};

export default config;

