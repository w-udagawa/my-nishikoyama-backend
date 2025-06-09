// check-area-distribution.js
// 現在のエリア分布を確認するスクリプト

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

async function checkAreaDistribution() {
  console.log('現在のエリア分布を確認中...\n');
  
  try {
    // 全イベントを取得
    const scanParams = {
      TableName: tableName
    };
    
    const result = await docClient.scan(scanParams).promise();
    const events = result.Items;
    
    console.log(`総イベント数: ${events.length}\n`);
    
    // エリア別に集計
    const areaCount = {};
    const areaEvents = {};
    
    events.forEach(event => {
      const area = event.area || 'undefined';
      
      // カウント
      if (!areaCount[area]) {
        areaCount[area] = 0;
        areaEvents[area] = [];
      }
      areaCount[area]++;
      
      // イベント情報を保存
      areaEvents[area].push({
        id: event.id,
        title: event.title,
        location: event.location,
        address: event.address,
        area: event.area,
        isDemo: event.isDemo || false
      });
    });
    
    // 結果を表示
    console.log('=== エリア別イベント数 ===');
    Object.keys(areaCount).sort().forEach(area => {
      console.log(`${area}: ${areaCount[area]}件`);
    });
    
    // 各エリアのイベントを詳細表示
    console.log('\n=== エリア別イベント詳細 ===');
    Object.keys(areaEvents).sort().forEach(area => {
      console.log(`\n【${area}】(${areaCount[area]}件)`);
      areaEvents[area].forEach((event, index) => {
        console.log(`${index + 1}. ${event.title}`);
        console.log(`   場所: ${event.location || 'なし'}`);
        console.log(`   住所: ${event.address || 'なし'}`);
        console.log(`   ID: ${event.id}`);
        console.log(`   デモ: ${event.isDemo ? 'はい' : 'いいえ'}`);
      });
    });
    
    // 西小山が含まれるイベントを検索
    console.log('\n=== "西小山"を含むイベント検索 ===');
    let nishikoyamaFound = 0;
    events.forEach(event => {
      const searchText = `${event.title} ${event.location} ${event.address}`.toLowerCase();
      if (searchText.includes('西小山') || searchText.includes('nishikoyama')) {
        nishikoyamaFound++;
        console.log(`\n発見: ${event.title}`);
        console.log(`  現在のarea: ${event.area}`);
        console.log(`  場所: ${event.location}`);
        console.log(`  住所: ${event.address}`);
        console.log(`  ID: ${event.id}`);
      }
    });
    console.log(`\n"西小山"を含むイベント総数: ${nishikoyamaFound}件`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

// 実行
checkAreaDistribution();
