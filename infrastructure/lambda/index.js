const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE;
const SETTINGS_TABLE = process.env.SETTINGS_TABLE;

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event));

    // Support CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            body: ''
        };
    }

    try {
        // Extract user from Cognito Authorizer
        const claims = event.requestContext?.authorizer?.claims;
        if (!claims || !claims.email) {
            return generateResponse(401, { error: 'Unauthorized' });
        }
        const userId = claims.email; // Using email as the primary partition key

        const path = event.resource || event.requestContext?.resourcePath;
        const method = event.httpMethod;

        if (path === '/transactions') {
            if (method === 'GET') {
                const params = {
                    TableName: TRANSACTIONS_TABLE,
                    KeyConditionExpression: 'userId = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId
                    }
                };
                const command = new QueryCommand(params);
                const response = await docClient.send(command);
                return generateResponse(200, response.Items || []);
            } else if (method === 'POST') {
                const body = JSON.parse(event.body);
                if (!body.id) {
                    body.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                }
                body.userId = userId;

                const params = {
                    TableName: TRANSACTIONS_TABLE,
                    Item: body
                };
                await docClient.send(new PutCommand(params));
                return generateResponse(201, body);
            }
        } else if (path === '/transactions/{id}') {
            const id = event.pathParameters?.id;
            if (!id) return generateResponse(400, { error: 'Missing transaction ID' });

            if (method === 'DELETE') {
                const params = {
                    TableName: TRANSACTIONS_TABLE,
                    Key: { userId, id }
                };
                await docClient.send(new DeleteCommand(params));
                return generateResponse(200, { success: true });
            } else if (method === 'PUT') {
                const body = JSON.parse(event.body);
                body.userId = userId;
                body.id = id;

                const params = {
                    TableName: TRANSACTIONS_TABLE,
                    Item: body
                };
                await docClient.send(new PutCommand(params));
                return generateResponse(200, body);
            }
        } else if (path === '/settings') {
            if (method === 'GET') {
                const params = {
                    TableName: SETTINGS_TABLE,
                    Key: { userId }
                };
                const response = await docClient.send(new GetCommand(params));
                return generateResponse(200, response.Item || {});
            } else if (method === 'POST' || method === 'PUT') {
                const body = JSON.parse(event.body);
                body.userId = userId;

                const params = {
                    TableName: SETTINGS_TABLE,
                    Item: body
                };
                await docClient.send(new PutCommand(params));
                return generateResponse(200, body);
            }
        }

        return generateResponse(404, { error: 'Not Found' });

    } catch (error) {
        console.error('Error:', error);
        return generateResponse(500, { error: 'Internal Server Error', message: error.message });
    }
};

function generateResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify(body)
    };
}
