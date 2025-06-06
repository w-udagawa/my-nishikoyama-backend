// 既存イベントのエリアを更新
require('dotenv').config();
const AWS = require('aws-sdk');
const dayjs = require('dayjs');

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function updateEventAreas() {
  try {
    // 全イベントを取得
    const params = {
      TableName: tableName
    };
    
    const result = await docClient.scan(params).promise();
    
    console.log(`総イベント数: ${result.Items.length}`);
    
    // エリアが未設定のイベントを探す
    const eventsWithoutArea = result.Items.filter(item => !item.area);
    
    console.log(`エリア未設定のイベント数: ${eventsWithoutArea.length}`);
    
    // エリアを更新
    let updatedCount = 0;
    for (const event of eventsWithoutArea) {
      // タイトルや場所からエリアを判定
      const allText = `${event.title} ${event.location} ${event.address || ''}`.toLowerCase();
      
      let area = 'nishikoyama'; // デフォルト
      
      if (allText.includes('武蔵小山') || allText.includes('むさしこやま') || 
          allText.includes('パルム') || allText.includes('palm')) {
        area = 'musashikoyama';
      }
      
      // 更新
      try {
        await docClient.update({
          TableName: tableName,
          Key: {
            id: event.id
          },
          UpdateExpression: 'SET #area = :area, updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#area': 'area'
          },
          ExpressionAttributeValues: {
            ':area': area,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();
        
        updatedCount++;
        console.log(`更新: ${event.title} -> エリア: ${area}`);
      } catch (error) {
        console.error(`更新エラー (${event.title}):`, error.message);
      }
    }
    
    console.log(`\n更新完了: ${updatedCount}件`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

updateEventAreas();
