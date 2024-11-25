import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3 } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DeleteCommand, GetCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// MongoDB setup
import { MongoClient } from "mongodb";
const mongodbUri = process.env.MONGODB_URI!;
let mongoClient: MongoClient | null = null;
// S3 setup
const s3 = new S3();
const bucketName = process.env.S3_BUCKET_NAME!;
// DynamoDB setup
const client = new DynamoDBClient();
const CONNECTIONS_TABLE_NAME = "WebSocketConnections";
const MESSAGES_TABLE_NAME = "MessageLogs";

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
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
        "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
      },
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
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
        "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
      },
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
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
        "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
      },
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

//  WEBSOCKET SECTION 
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: process.env.WEBSOCKET_ENDPOINT,
});

export const identify = async (event: APIGatewayEvent) => {
  const { connectionId } = event.requestContext;
  const { username } = JSON.parse(event.body || '{}');

  const command = new GetCommand({
    TableName: CONNECTIONS_TABLE_NAME,
    Key: {
      connectionId: connectionId,
    },
  });
  const result = await client.send(command);
  if (result.Item) {
    try {
      const updateCommand = new PutCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        Item: {
          connectionId: connectionId,
          username: username,
          timestamp: new Date().toISOString(),
        },
      });
      await client.send(updateCommand);

    // Fetch the latest logs from Dynamo
    const latestLogsCmd = new ScanCommand({
      TableName: MESSAGES_TABLE_NAME,
    });
    const latestLogs = (await client.send(latestLogsCmd)).Items;
    // sort latestlogs by Date and time using the timestamp property
    const sortedLatestLogs: any[]= latestLogs.sort((a: any, b: any) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }).reverse();
      const postToConnectionCommand = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          action: "identify",
          status: 'success',
          sortedLatestLogs
        }),
      });
      await apiGatewayClient.send(postToConnectionCommand);
      return { 
        statusCode: 200,
        body: 'Username identified.',
        headers: {
          "Access-Control-Allow-Origin": "*", // Allow requests from any origin
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
          "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
        },
      };
    } catch (error) {
      console.error("Error saving User : ", error);
      const postToConnectionCommand = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          action: "identify",
          status: 'failed'
        }),
      });
      await apiGatewayClient.send(postToConnectionCommand);
      return {
        statusCode: 500,
        body: "Failed to identify username.",
      };
    }
  } 
}

export const connect = async (event: APIGatewayEvent) => {
  const { connectionId } = event.requestContext;
  console.log(`ConnectionId: ${connectionId}`);
  if ( connectionId ) {
    try {
      const command = new PutCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        Item: {
          connectionId: connectionId,
          timestamp: new Date().toISOString(),
        },
      });
  
      await client.send(command);
      return { 
        statusCode: 200,
        body: `${connectionId} Connected.`,
        headers: {
          "Access-Control-Allow-Origin": "*", // Allow requests from any origin
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
          "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
        },
      };
    } catch (error) {
      console.error("Error saving User : ", error);
      return {
        statusCode: 500,
        body: "Failed to connect.",
      };
    }
  }
};

export const disconnect = async (event: APIGatewayEvent) => {
  const { connectionId } = event.requestContext;
  try {
    const command = new DeleteCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        connectionId: connectionId,
      },
    });
    await client.send(command);
    return { 
      statusCode: 200,
      body: `${connectionId} Disconnected.`,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
        "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
      },
    };
  } catch (error) {
    console.error("Error removing connection:", error);
    return {
      statusCode: 500,
      body: "Failed to disconnect.",
    };
  }
  
};

export const manualDisconnect = async (event: APIGatewayEvent) => {
  const { connectionId } = event.requestContext;
  try {
    const postToConnectionCommand = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        action: "manualDisconnect",
        status: 'success'
      }),
    });
    await apiGatewayClient.send(postToConnectionCommand);
    return { 
      statusCode: 200,
      body: `${connectionId} Disconnected.`,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
        "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
      },
    };
  } catch (error) {
    console.error("Error removing connection:", error);
    return {
      statusCode: 500,
      body: "Failed to disconnect.",
    };
  }
};

export const keepConnectionAlive = async (event: APIGatewayEvent) => {
  const { connectionId } = event.requestContext;
  try {
    return {
      statusCode: 200,
      body: `${connectionId} Connection kept alive.`,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
        "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
      },
    };
  } catch (error) {
    console.error("Error keeping connection alive:", error);
    return {
      statusCode: 500,
      body: "Failed to keep connection alive.",
    };
  }
};

export const sendMessage = async (event: APIGatewayEvent) => {
  const { message } = JSON.parse(event.body || '{}');
  const { connectionId } = event.requestContext;

  try {
    // Fetch the user from DynamoDB
    const getCommand = new GetCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        connectionId: connectionId,
      },
    });
    const macthedUser = await client.send(getCommand);

    if (!macthedUser.Item) {
      console.error("Connection not found:", connectionId);
      return {
        statusCode: 404,
        body: "Connection not found.",
      };
    }

    const username = macthedUser.Item.username || "Anonymous";
    console.log(`Message from ${username}: ${message}`);

    const messageLogCommand = new PutCommand({
      TableName: MESSAGES_TABLE_NAME,
      Item: {
        id: uuidv4(),
        connectionId: connectionId,
        username: username,
        message: message,
        timestamp: new Date().toISOString(),
      },
    });
    await client.send(messageLogCommand);
    
    const latestLogsCmd = new ScanCommand({
      TableName: MESSAGES_TABLE_NAME,
    });
    const latestLogs = (await client.send(latestLogsCmd)).Items;

    // sort latestlogs by Date and time using the timestamp property
    const sortedLatestLogs: any[]= latestLogs.sort((a: any, b: any) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }).reverse();

    // Send the message to all connected clients
    const allUsersCommand = new ScanCommand({
      TableName: CONNECTIONS_TABLE_NAME,
    });
    const allUsers = await client.send(allUsersCommand);
    const allConnections = allUsers.Items.map((item: any) => item.connectionId);
    for (const connectionId of allConnections) {
      const postToConnectionCommand = new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify({
          status: 'success',
          action: 'sendMessage',
          sortedLatestLogs
        }),
      });
      await apiGatewayClient.send(postToConnectionCommand);
    }
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS", // Allow specific HTTP methods
        "Access-Control-Allow-Headers": "Content-Type,Authorization", // Allow specific headers
      },
    };
  } catch (error) {
    console.error("Error handling action:", error);
    const postToConnectionCommand = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({
        status: 'fail',
        action: 'sendMessage',
      }),
    });
    await apiGatewayClient.send(postToConnectionCommand);
    return {
      statusCode: 500,
      body: "Failed to handle message.",
    };
  }
};
