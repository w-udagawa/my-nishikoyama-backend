// 武蔵小山パルムの日付がおかしいイベントを削除
require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function deleteMusashikoyamaPalmEvents() {
  try {
    // 全イベントを取得
    const params = {
      TableName: tableName
    };
    
    const result = await docClient.scan(params).promise();
    
    // 武蔵小山パルムのイベントを抽出
    const palmEvents = result.Items.filter(item => 
      item.source === 'musashikoyama_palm' && !item.isDemo
    );
    
    console.log(`武蔵小山パルムのイベント: ${palmEvents.length}件`);
    
    // 削除
    let deletedCount = 0;
    for (const event of palmEvents) {
      try {
        await docClient.delete({
          TableName: tableName,
          Key: {
            id: event.id
          }
        }).promise();
        
        deletedCount++;
        console.log(`削除: ${event.title}`);
      } catch (error) {
        console.error(`削除エラー (${event.title}):`, error.message);
      }
    }
    
    console.log(`\n削除完了: ${deletedCount}件`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

deleteMusashikoyamaPalmEvents();
