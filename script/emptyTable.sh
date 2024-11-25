tableName="WebSocketConnections"
keys=$(aws dynamodb scan --table-name $tableName --attributes-to-get "connectionId" --query "Items" --output json --endpoint-url http://localhost:8000)

for key in $(echo $keys | jq -c '.[]'); do
    aws dynamodb delete-item --table-name $tableName --key "$key" --endpoint-url http://localhost:8000
    echo "Deleted $key"
done

echo "Table $tableName is empty now"