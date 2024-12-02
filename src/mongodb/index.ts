// MongoDB setup
import { MongoClient } from "mongodb";

const mongodbUri = process.env.MONGODB_URI!;

let mongoClient: MongoClient | null = null;

export const getMongoClient = async () => {
    if (!mongoClient) {
        console.log({
            endpoint: "getPosts",
            message: "Attempting to connect to MongoDB",
            mongodbUri,
        });
        mongoClient = new MongoClient(mongodbUri);
        await mongoClient.connect();
    }
    return mongoClient;
}