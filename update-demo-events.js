// 既存のダミーイベントにisDemoフラグを設定するスクリプト
const AWS = require('aws-sdk');
require('dotenv').config();

// AWS DynamoDB設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

// ダミーイベントを識別するキーワード
const demoKeywords = [
  'サンプル',
  'テスト',
  'ダミー',
  'DEMO',
  'demo',
  'test',
  'sample',
  'dummy'
];

async function updateDemoEvents() {
  try {
    console.log('ダミーイベントの更新を開始します...');
    
    // 全イベントを取得
    const scanParams = {
      TableName: tableName
    };
    
    const result = await docClient.scan(scanParams).promise();
    console.log(`総イベント数: ${result.Items.length}`);
    
    let updatedCount = 0;
    let demoCount = 0;
    
    for (const item of result.Items) {
      // タイトルまたは説明にダミーキーワードが含まれているか確認
      const isDemo = demoKeywords.some(keyword => 
        (item.title && item.title.includes(keyword)) ||
        (item.description && item.description.includes(keyword))
      );
      
      if (isDemo) {
        demoCount++;
        console.log(`ダミーイベント検出: ${item.title}`);
        
        // isDemoフラグを設定
        const updateParams = {
          TableName: tableName,
          Key: {
            id: item.id
          },
          UpdateExpression: 'SET isDemo = :isDemo',
          ExpressionAttributeValues: {
            ':isDemo': true
          }
        };
        
        await docClient.update(updateParams).promise();
        updatedCount++;
        console.log(`✓ 更新完了: ${item.title}`);
      }
    }
    
    console.log(`\n=== 更新完了 ===`);
    console.log(`ダミーイベント数: ${demoCount}`);
    console.log(`更新したイベント数: ${updatedCount}`);
    console.log(`実データイベント数: ${result.Items.length - demoCount}`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行確認
console.log('このスクリプトは既存のイベントをスキャンし、ダミーイベントにisDemoフラグを設定します。');
console.log('続行しますか？ (Ctrl+Cでキャンセル)');

// 3秒待機
setTimeout(() => {
  updateDemoEvents();
}, 3000);
