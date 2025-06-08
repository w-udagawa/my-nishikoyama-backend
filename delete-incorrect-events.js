// 日付がおかしいイベントを削除（品川区公式のイベント含む）
require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function deleteIncorrectDateEvents() {
  try {
    // 全イベントを取得
    const params = {
      TableName: tableName
    };
    
    const result = await docClient.scan(params).promise();
    
    // 削除対象のイベントを抽出
    const eventsToDelete = result.Items.filter(item => {
      // 武蔵小山パルムのイベント（残っていれば）
      if (item.source === 'musashikoyama_palm' && !item.isDemo) {
        return true;
      }
      
      // 品川区公式の日付がおかしいイベント
      if (item.id === '121_【平成30年11月11日開催】しながわくの魅力発見ツアー' ||
          item.title === '121_【平成30年11月11日開催】しながわくの魅力発見ツアー') {
        return true;
      }
      
      return false;
    });
    
    console.log(`削除対象のイベント: ${eventsToDelete.length}件`);
    
    // 削除
    let deletedCount = 0;
    for (const event of eventsToDelete) {
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
    
    // 削除後の状態を確認
    const afterResult = await docClient.scan(params).promise();
    const realEvents = afterResult.Items.filter(item => !item.isDemo);
    console.log(`\n削除後の実データ: ${realEvents.length}件`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

deleteIncorrectDateEvents();
