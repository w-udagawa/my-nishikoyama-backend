// fix-missing-area-field.js
// 既存のイベントにareaフィールドを追加するスクリプト

require('dotenv').config();
const AWS = require('aws-sdk');

// AWS設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

// エリアを判定する関数
function determineArea(event) {
  const title = event.title || '';
  const location = event.location || '';
  const address = event.address || '';
  const source = event.source || '';
  
  // すべてのテキストを結合して判定
  const allText = `${title} ${location} ${address} ${source}`.toLowerCase();
  
  // 西小山の判定
  if (allText.includes('西小山') || allText.includes('nishikoyama')) {
    return 'nishikoyama';
  }
  
  // 武蔵小山の判定
  if (allText.includes('武蔵小山') || allText.includes('musashikoyama') || 
      allText.includes('武蔵小山商店街') || allText.includes('パルム')) {
    return 'musashikoyama';
  }
  
  // 品川区その他（デフォルト）
  return 'shinagawa_other';
}

async function fixMissingAreaField() {
  console.log('既存イベントのareaフィールドを修正中...');
  
  try {
    // 全イベントを取得
    const scanParams = {
      TableName: tableName
    };
    
    const result = await docClient.scan(scanParams).promise();
    const events = result.Items;
    
    console.log(`総イベント数: ${events.length}`);
    
    let updateCount = 0;
    let nishikoyamaCount = 0;
    let musashikoyamaCount = 0;
    let shinagawaOtherCount = 0;
    
    // 各イベントを処理
    for (const event of events) {
      // areaフィールドが存在しない、または空の場合
      if (!event.area) {
        const area = determineArea(event);
        
        const updateParams = {
          TableName: tableName,
          Key: {
            id: event.id
          },
          UpdateExpression: 'SET area = :area',
          ExpressionAttributeValues: {
            ':area': area
          }
        };
        
        await docClient.update(updateParams).promise();
        
        console.log(`✅ ${event.title} → エリア: ${area}`);
        updateCount++;
        
        // エリア別カウント
        if (area === 'nishikoyama') nishikoyamaCount++;
        else if (area === 'musashikoyama') musashikoyamaCount++;
        else shinagawaOtherCount++;
      }
    }
    
    console.log('\n=== 修正完了 ===');
    console.log(`更新したイベント数: ${updateCount}`);
    console.log(`- 西小山: ${nishikoyamaCount}件`);
    console.log(`- 武蔵小山: ${musashikoyamaCount}件`);
    console.log(`- 品川区その他: ${shinagawaOtherCount}件`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// 実行
fixMissingAreaField();
