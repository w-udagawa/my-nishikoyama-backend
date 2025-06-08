// 品川観光協会スクレイパーのテスト
const ShinagawaKankoScraper = require('./src/scrapers/ShinagawaKankoScraper');

async function testShinagawaKanko() {
  console.log('=== 品川観光協会スクレイパーテスト ===\n');
  
  const scraper = new ShinagawaKankoScraper();
  
  try {
    console.log('イベント情報を取得中...');
    const events = await scraper.scrapeEvents();
    
    console.log(`\n取得イベント数: ${events.length}件`);
    
    // 西小山関連のイベントを検索
    console.log('\n--- 西小山関連のイベント ---');
    const nishikoyamaEvents = events.filter(event => 
      event.title.includes('西小山') || 
      event.location.includes('西小山') ||
      event.description.includes('西小山')
    );
    
    if (nishikoyamaEvents.length > 0) {
      console.log(`西小山関連: ${nishikoyamaEvents.length}件`);
      nishikoyamaEvents.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   日付: ${event.date}`);
        console.log(`   場所: ${event.location}`);
        console.log(`   URL: ${event.sourceUrl}`);
      });
    } else {
      console.log('西小山関連のイベントは見つかりませんでした');
    }
    
    // 最初の5件を表示
    console.log('\n--- 取得したイベントの例（最初の5件）---');
    events.slice(0, 5).forEach((event, index) => {
      console.log(`\n${index + 1}. ${event.title}`);
      console.log(`   日付: ${event.date}`);
      console.log(`   時間: ${event.time}`);
      console.log(`   場所: ${event.location}`);
      console.log(`   カテゴリー: ${event.category.join(', ')}`);
      console.log(`   URL: ${event.sourceUrl}`);
    });
    
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    console.error(error.stack);
  }
}

testShinagawaKanko();
