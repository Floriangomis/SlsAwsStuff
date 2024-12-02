import { APIGatewayEvent } from "aws-lambda";
import { v4 as uuidv4 } from 'uuid';
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DeleteCommand, GetCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const env = process.env.ENV;

// DynamoDB setup ( Locally you need to run a local DynamoDB instance on port 8000 )
const webSocketEndpoint = (env === 'dev') ? 'ws://localhost:3001' : process.env.WEBSOCKET_ENDPOINT
const dynamoDBendpointLocal =  (env === 'dev') ? 'http://localhost:8000' : undefined;
const client = new DynamoDBClient({
  ...(dynamoDBendpointLocal && { endpoint: dynamoDBendpointLocal }), // If running locally, use the local endpoint
});
const CONNECTIONS_TABLE_NAME = "WebSocketConnections";
const MESSAGES_TABLE_NAME = "MessageLogs";


//  WEBSOCKET SECTION 
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: webSocketEndpoint,
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
