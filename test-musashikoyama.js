// 武蔵小山パルムスクレイパーのテスト
require('dotenv').config();
const MusashikoyamaPalmScraper = require('./src/scrapers/MusashikoyamaPalmScraper');

async function test() {
  console.log('武蔵小山パルムスクレイパーのテスト開始...');
  
  try {
    const scraper = new MusashikoyamaPalmScraper();
    const events = await scraper.scrapeEvents();
    
    console.log(`\n取得したイベント数: ${events.length}`);
    
    // 各イベントの詳細を表示
    events.forEach((event, index) => {
      console.log(`\n--- イベント ${index + 1} ---`);
      console.log(`タイトル: ${event.title}`);
      console.log(`日付: ${event.date}`);
      console.log(`場所: ${event.location}`);
      console.log(`エリア: ${event.area}`);
      console.log(`カテゴリー: ${event.category.join(', ')}`);
      console.log(`URL: ${event.sourceUrl}`);
    });
    
  } catch (error) {
    console.error('エラー発生:', error);
  }
}

test();
