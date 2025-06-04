// スクレイピングテストスクリプト
require('dotenv').config();
const EventCollector = require('./src/scrapers');

async function testScraping() {
  console.log('=== スクレイピングテスト開始 ===');
  console.log('環境変数チェック:');
  console.log('- AWS_REGION:', process.env.AWS_REGION);
  console.log('- DYNAMODB_TABLE_NAME:', process.env.DYNAMODB_TABLE_NAME);
  console.log('- SCRAPING_USER_AGENT:', process.env.SCRAPING_USER_AGENT);
  console.log('');

  const collector = new EventCollector();
  
  try {
    console.log('EventCollectorを実行中...');
    const events = await collector.collectAllEvents();
    console.log(`\n結果: ${events.length}件のイベントを取得`);
    
    if (events.length > 0) {
      console.log('\n最初の3件のイベント:');
      events.slice(0, 3).forEach((event, index) => {
        console.log(`\n[${index + 1}] ${event.title}`);
        console.log(`  日付: ${event.date}`);
        console.log(`  場所: ${event.location}`);
        console.log(`  URL: ${event.sourceUrl}`);
      });
    }
  } catch (error) {
    console.error('\nエラーが発生しました:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

testScraping();
