// 品川観光協会スクレイパーのテスト
require('dotenv').config();
const ShinagawaKankoScraper = require('./src/scrapers/ShinagawaKankoScraper');

async function test() {
  console.log('品川観光協会スクレイパーのテスト開始...');
  
  try {
    const scraper = new ShinagawaKankoScraper();
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
      console.log(`ソース: ${event.source}`);
      console.log(`URL: ${event.sourceUrl}`);
      
      // 日付が有効かチェック
      const dayjs = require('dayjs');
      const eventDate = dayjs(event.date);
      const now = dayjs();
      console.log(`日付有効: ${eventDate.isValid()}`);
      console.log(`未来のイベント: ${eventDate.isAfter(now.subtract(1, 'day'))}`);
    });
    
  } catch (error) {
    console.error('エラー発生:', error);
  }
}

test();
