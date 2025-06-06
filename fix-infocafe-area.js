// 特定のイベントのエリアを修正
require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function fixInfoCafeSquare() {
  try {
    // 全イベントを取得
    const scanResult = await docClient.scan({
      TableName: tableName
    }).promise();
    
    const realEvents = scanResult.Items.filter(item => !item.isDemo);
    
    console.log(`\n=== info&cafe SQUAREのエリア修正 ===\n`);
    
    // info&cafe SQUAREを探す
    const infoCafeEvent = realEvents.find(event => 
      event.title.includes('info＆cafe SQUARE') || 
      event.location.includes('荏原4-5-28')
    );
    
    if (infoCafeEvent) {
      console.log(`対象イベント: ${infoCafeEvent.title}`);
      console.log(`現在のエリア: ${infoCafeEvent.area}`);
      console.log(`住所: 荏原4-5-28（武蔵小山駅近く）`);
      console.log(`新しいエリア: musashikoyama\n`);
      
      // DynamoDBを更新
      await docClient.update({
        TableName: tableName,
        Key: { id: infoCafeEvent.id },
        UpdateExpression: 'SET #area = :area, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#area': 'area'
        },
        ExpressionAttributeValues: {
          ':area': 'musashikoyama',
          ':updatedAt': new Date().toISOString()
        }
      }).promise();
      
      console.log(`✅ 修正完了！`);
    } else {
      console.log('info&cafe SQUAREのイベントが見つかりませんでした。');
    }
    
    // 修正後の集計を表示
    const updatedResult = await docClient.scan({
      TableName: tableName
    }).promise();
    
    const updatedRealEvents = updatedResult.Items.filter(item => !item.isDemo);
    const areaCount = {};
    
    updatedRealEvents.forEach(event => {
      const area = event.area || 'undefined';
      areaCount[area] = (areaCount[area] || 0) + 1;
    });
    
    console.log(`\n=== 修正後のエリア別集計 ===`);
    console.log(`西小山: ${areaCount.nishikoyama || 0}件`);
    console.log(`武蔵小山: ${areaCount.musashikoyama || 0}件`);
    console.log(`品川区その他: ${areaCount.shinagawa_other || 0}件`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

fixInfoCafeSquare();
