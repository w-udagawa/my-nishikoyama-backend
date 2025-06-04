// DynamoDBテーブルのデータをクリアするスクリプト
require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function clearTable() {
  console.log('=== DynamoDBテーブルのクリア開始 ===');
  
  try {
    // 全件をスキャン
    const scanParams = {
      TableName: tableName,
      ProjectionExpression: 'id'
    };
    
    const scanResult = await docClient.scan(scanParams).promise();
    console.log(`${scanResult.Items.length}件のアイテムを削除します`);
    
    // バッチで削除
    const batchSize = 25;
    for (let i = 0; i < scanResult.Items.length; i += batchSize) {
      const batch = scanResult.Items.slice(i, i + batchSize);
      
      const deleteRequests = batch.map(item => ({
        DeleteRequest: {
          Key: { id: item.id }
        }
      }));
      
      const params = {
        RequestItems: {
          [tableName]: deleteRequests
        }
      };
      
      await docClient.batchWrite(params).promise();
      console.log(`${i + batch.length}/${scanResult.Items.length}件を削除`);
    }
    
    console.log('=== クリア完了 ===');
  } catch (error) {
    console.error('エラー:', error);
  }
}

clearTable();
