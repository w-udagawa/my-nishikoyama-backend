// スクレイピングを手動実行するスクリプト
const EventCollector = require('./src/scrapers');
require('dotenv').config();

async function runScraping() {
  console.log('スクレイピング開始...');
  
  const collector = new EventCollector();
  
  try {
    await collector.collectAllEvents();
    console.log('スクレイピング完了！');
  } catch (error) {
    console.error('スクレイピングエラー:', error);
  }
}

// 実行
runScraping();
