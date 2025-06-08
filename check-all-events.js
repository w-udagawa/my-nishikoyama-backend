// 過去のイベントも含めてデータベースを確認するスクリプト
const AWS = require('aws-sdk');
const dayjs = require('dayjs');
require('dotenv').config();

// AWS設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

async function checkAllEvents() {
  console.log('=== データベース内の全イベント（過去のイベント含む） ===');
  
  try {
    const params = {
      TableName: tableName
    };
    
    const result = await docClient.scan(params).promise();
    const events = result.Items || [];
    
    // ソート（日付順）
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 実データのみ抽出
    const realEvents = events.filter(e => !e.isDemo);
    const demoEvents = events.filter(e => e.isDemo);
    
    console.log(`総数: ${events.length}件`);
    console.log(`実データ: ${realEvents.length}件`);
    console.log(`デモデータ: ${demoEvents.length}件`);
    
    // エリア別に分類
    const nishikoyamaEvents = realEvents.filter(e => e.area === 'nishikoyama');
    const musashikoyamaEvents = realEvents.filter(e => e.area === 'musashikoyama');
    const shinagawaOtherEvents = realEvents.filter(e => e.area === 'shinagawa_other');
    
    console.log('\n=== エリア別実データ ===');
    console.log(`西小山: ${nishikoyamaEvents.length}件`);
    console.log(`武蔵小山: ${musashikoyamaEvents.length}件`);
    console.log(`品川区その他: ${shinagawaOtherEvents.length}件`);
    
    // 西小山イベントの詳細（過去・未来含む）
    if (nishikoyamaEvents.length > 0) {
      console.log('\n=== 西小山エリアのイベント詳細 ===');
      nishikoyamaEvents.forEach((event, i) => {
        const isPast = dayjs(event.date).isBefore(dayjs());
        console.log(`\n--- イベント ${i + 1} ${isPast ? '【過去】' : '【未来】'} ---`);
        console.log(`タイトル: ${event.title}`);
        console.log(`日付: ${event.date}`);
        console.log(`場所: ${event.location}`);
        console.log(`ソース: ${event.source}`);
        console.log(`カテゴリー: ${event.category ? event.category.join(', ') : 'なし'}`);
      });
    }
    
    // 西小山関連キーワードを含むが他エリアに分類されたイベント
    const maybeNishikoyama = realEvents.filter(e => 
      e.area !== 'nishikoyama' && 
      (e.title.includes('西小山') || 
       e.location.includes('西小山') || 
       (e.description && e.description.includes('西小山')))
    );
    
    if (maybeNishikoyama.length > 0) {
      console.log('\n=== 西小山キーワードを含むが他エリアに分類されたイベント ===');
      maybeNishikoyama.forEach(event => {
        console.log(`- ${event.title} → ${event.area}エリア`);
        console.log(`  場所: ${event.location}`);
      });
    }
    
    // 今日から1週間以内の全エリアイベント
    const weekFromNow = dayjs().add(7, 'day');
    const upcomingEvents = realEvents.filter(e => 
      dayjs(e.date).isAfter(dayjs()) && dayjs(e.date).isBefore(weekFromNow)
    );
    
    console.log('\n=== 今後1週間のイベント（全エリア） ===');
    if (upcomingEvents.length > 0) {
      upcomingEvents.forEach(event => {
        console.log(`- ${event.date}: ${event.title} (${event.area})`);
      });
    } else {
      console.log('今後1週間のイベントはありません');
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 実行
checkAllEvents();
