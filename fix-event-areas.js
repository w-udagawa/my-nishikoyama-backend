// 既存イベントのエリア情報を修正
require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function fixEventAreas() {
  try {
    // 全イベントを取得
    const scanResult = await docClient.scan({
      TableName: tableName
    }).promise();
    
    const realEvents = scanResult.Items.filter(item => !item.isDemo);
    console.log(`\n=== 実データのエリア修正開始 ===`);
    console.log(`対象: ${realEvents.length}件\n`);
    
    // エリア修正の定義
    const areaFixes = [
      {
        title: 'CAFE & HALL ours',
        keywords: ['北品川', '大崎駅'],
        newArea: 'shinagawa_other',
        reason: '北品川・大崎エリア'
      },
      {
        title: '五反田 TOC',
        keywords: ['五反田', 'TOC'],
        newArea: 'shinagawa_other',
        reason: '五反田エリア'
      },
      {
        title: '品川区立大井図書館',
        keywords: ['大井', '大森駅'],
        newArea: 'shinagawa_other',
        reason: '大井町エリア'
      },
      {
        title: 'ホテル雅叙園東京',
        keywords: ['目黒', '雅叙園'],
        newArea: 'shinagawa_other',
        reason: '目黒エリア'
      }
    ];
    
    let fixedCount = 0;
    
    for (const event of realEvents) {
      const eventText = `${event.title} ${event.location} ${event.address || ''}`.toLowerCase();
      
      for (const fix of areaFixes) {
        const shouldFix = fix.keywords.some(keyword => 
          eventText.includes(keyword.toLowerCase())
        );
        
        if (shouldFix && event.area !== fix.newArea) {
          console.log(`修正対象: ${event.title}`);
          console.log(`  現在のエリア: ${event.area}`);
          console.log(`  新しいエリア: ${fix.newArea}`);
          console.log(`  理由: ${fix.reason}\n`);
          
          // DynamoDBを更新
          await docClient.update({
            TableName: tableName,
            Key: { id: event.id },
            UpdateExpression: 'SET #area = :area, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#area': 'area'
            },
            ExpressionAttributeValues: {
              ':area': fix.newArea,
              ':updatedAt': new Date().toISOString()
            }
          }).promise();
          
          fixedCount++;
          break;
        }
      }
    }
    
    console.log(`=== エリア修正完了 ===`);
    console.log(`修正件数: ${fixedCount}件\n`);
    
    // 修正後の状態を確認
    const updatedResult = await docClient.scan({
      TableName: tableName
    }).promise();
    
    const updatedRealEvents = updatedResult.Items.filter(item => !item.isDemo);
    const areaCount = {};
    
    updatedRealEvents.forEach(event => {
      const area = event.area || 'undefined';
      areaCount[area] = (areaCount[area] || 0) + 1;
    });
    
    console.log(`=== 修正後のエリア別集計 ===`);
    Object.entries(areaCount).forEach(([area, count]) => {
      console.log(`${area}: ${count}件`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

fixEventAreas();
