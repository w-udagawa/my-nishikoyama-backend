// データベース内のイベントを確認
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

async function checkEvents() {
  try {
    // 全イベントを取得
    const params = {
      TableName: tableName
    };
    
    const result = await docClient.scan(params).promise();
    
    console.log(`\n=== データベース内のイベント ===`);
    console.log(`総数: ${result.Items.length}件\n`);
    
    // デモデータと実データを分ける
    const demoEvents = result.Items.filter(item => item.isDemo);
    const realEvents = result.Items.filter(item => !item.isDemo);
    
    console.log(`デモデータ: ${demoEvents.length}件`);
    console.log(`実データ: ${realEvents.length}件\n`);
    
    // エリア別に集計
    const areaCount = {
      nishikoyama: 0,
      musashikoyama: 0,
      shinagawa_other: 0,
      undefined: 0
    };
    
    realEvents.forEach(event => {
      const area = event.area || 'undefined';
      if (area in areaCount) {
        areaCount[area]++;
      } else {
        areaCount[area] = 1;
      }
    });
    
    console.log(`=== エリア別実データ ===`);
    console.log(`西小山: ${areaCount.nishikoyama}件`);
    console.log(`武蔵小山: ${areaCount.musashikoyama}件`);
    console.log(`品川区その他: ${areaCount.shinagawa_other}件`);
    if (areaCount.undefined > 0) {
      console.log(`エリア未設定: ${areaCount.undefined}件`);
    }
    
    // その他のエリアがあれば表示
    Object.keys(areaCount).forEach(area => {
      if (!['nishikoyama', 'musashikoyama', 'shinagawa_other', 'undefined'].includes(area)) {
        console.log(`${area}: ${areaCount[area]}件`);
      }
    });
    
    // 実データの詳細を表示
    console.log(`\n=== 実データ詳細 ===`);
    realEvents
      .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
      .forEach((event, index) => {
        console.log(`\n--- イベント ${index + 1} ---`);
        console.log(`タイトル: ${event.title}`);
        console.log(`日付: ${event.date}`);
        console.log(`場所: ${event.location}`);
        console.log(`エリア: ${event.area || '未設定'}`);
        console.log(`ソース: ${event.source}`);
        console.log(`カテゴリー: ${(event.category || []).join(', ')}`);
      });
      
    // 日付による分析
    const now = dayjs();
    const futureEvents = realEvents.filter(event => 
      dayjs(event.date).isAfter(now.subtract(1, 'day'))
    );
    const pastEvents = realEvents.filter(event => 
      dayjs(event.date).isBefore(now.subtract(1, 'day'))
    );
    
    console.log(`\n=== 日付分析 ===`);
    console.log(`未来のイベント: ${futureEvents.length}件`);
    console.log(`過去のイベント: ${pastEvents.length}件`);
    
    // ソース別の集計も追加
    const sourceCount = {};
    realEvents.forEach(event => {
      const source = event.source || 'unknown';
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });
    
    console.log(`\n=== ソース別実データ ===`);
    Object.entries(sourceCount).forEach(([source, count]) => {
      console.log(`${source}: ${count}件`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

checkEvents();
