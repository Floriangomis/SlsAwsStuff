# Context 

I am just playing with aws (VPC, APGW, DynamoDB, NetGateway, Sns, ElasticIP ... ), Websocket, Mongodb, Auth0, serverless, typescript, Node and more...
No restriction, I just want to learn as much as possible.

So far we have :

- A realtime Chat ( the UI is in on a private repo ). It's using APGW, Websocket and some lambdas being inside a VPC.
- AUthentication system using Auth0
- A blog post system reading from a mongodb cluster. ( The lambda are inside a VPC and are able to communicate with the MONGODB cluster thanks to a whitelist and a restriction by IP ).


# Serverless command :

```sls deploy --stage <env>```
```sls offline --stage <env>```

# Env File :

You need either .env.dev or .env.prod -> 
```
MONGODB_URI=<value>
S3_BUCKET_NAME=<value>
```

# DynamoDB locally :

First run a container from this image : docker run -p 8000:8000 dwmkerr/dynamodb

You can either run the command above or dl the image and run it on docker. 

```
Insert one by one those 2 object in myLocalTable.json

{
    "TableName": "WebSocketConnections",
    "KeySchema": [
    { "AttributeName": "connectionId", "KeyType": "HASH"}
    ],
    "AttributeDefinitions": [
    {"AttributeName": "connectionId", "AttributeType": "S"}
    ],
    "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
    }
}
{
    "TableName": "MessageLogs",
    "KeySchema": [
    { "AttributeName": "id", "KeyType": "HASH"}
    ],
    "AttributeDefinitions": [
    {"AttributeName": "id", "AttributeType": "S"}
    ],
    "ProvisionedThroughput": {
        "ReadCapacityUnits": 5,
        "WriteCapacityUnits": 5
    }
}
```

then execute : 
```
aws dynamodb create-table --cli-input-json file://myLocalTable.json --endpoint-url http://localhost:8000
```

This will create both table 

You can then finally check that the table are created by running this command : 
```
aws dynamodb list-tables --endpoint-url http://localhost:8000
```
