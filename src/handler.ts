import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3 } from "@aws-sdk/client-s3";

// MongoDB and S3 setup
import { MongoClient } from "mongodb";

const mongodbUri = process.env.MONGODB_URI!;
const s3 = new S3();
const bucketName = process.env.S3_BUCKET_NAME!;

let mongoClient: MongoClient | null = null;
async function getMongoClient() {
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

export const debugEnv = async () => {
  console.log('MONGODB_URI:', process.env.MONGODB_URI);
  console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);
  return {
    statusCode: 200,
    body: JSON.stringify({
      MONGODB_URI: process.env.MONGODB_URI,
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    }),
  };
};

// Create a post
export const createPost = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || "{}");
    const client = await getMongoClient();
    const db = client.db("audioBlog");
    const collection = db.collection("posts");

    const result = await collection.insertOne(body);

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Post created successfully",
        postId: result.insertedId,
      }),
    };
  } catch (error) {
    console.error("Error creating post:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create post" }),
    };
  }
};

// Get posts
export const getPosts = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log({
      endpoint: "getPosts",
      message: "Receiving request to fetch posts",
    });

    const client = await getMongoClient();
    const db = client.db("db");
    const collection = db.collection("blogscollection");
    
    console.log({
      endpoint: "getPosts",
      message: "Successfully connected to MongoDB"
    });

    const posts = await collection.find({}).toArray();

    console.log({
      endpoint: "getPosts",
      message: "Successfully fetched posts",
      posts,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(posts),
    };
  } catch (error) {
    console.error("Error fetching posts:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch posts" }),
    };
  }
};

// Upload a picture
export const uploadPicture = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { fileName, fileContent } = body;

    if (!fileName || !fileContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "fileName and fileContent are required" }),
      };
    }

    const buffer = Buffer.from(fileContent, "base64");

    await s3
      .putObject({
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: "image/jpeg", // Adjust for other types if needed
      });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Picture uploaded successfully",
        fileName,
      }),
    };
  } catch (error) {
    console.error("Error uploading picture:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to upload picture" }),
    };
  }
};