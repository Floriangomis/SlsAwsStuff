#Serverless command :#

```sls deploy --stage <env>```
```sls offline --stage <env>```

#Env File :#

You need either .env.dev or .env.prod -> 
```
MONGODB_URI=<value>
S3_BUCKET_NAME=<value>
```

#DynamoDB locally : #

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