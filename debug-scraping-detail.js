// スクレイピングの詳細デバッグ
const MeguroScraper = require('./src/scrapers/MeguroScraper');
const ShinagawaScraper = require('./src/scrapers/ShinagawaScraper');

async function debugScraping() {
  console.log('=== 詳細デバッグ開始 ===\n');
  
  // 品川区のスクレイピング
  console.log('【品川区のスクレイピング】');
  const shinagawaScraper = new ShinagawaScraper();
  
  try {
    const events = await shinagawaScraper.scrapeEvents();
    console.log(`取得イベント数: ${events.length}`);
    
    // 最初の5件を詳細表示
    console.log('\n--- 取得したイベントの例（最初の5件）---');
    events.slice(0, 5).forEach((event, index) => {
      console.log(`\n${index + 1}. ${event.title}`);
      console.log(`   日付: ${event.date}`);
      console.log(`   場所: ${event.location}`);
      console.log(`   URL: ${event.sourceUrl}`);
      console.log(`   説明: ${event.description.substring(0, 50)}...`);
    });
    
    // 西小山関連のイベントを検索
    console.log('\n--- 西小山関連のイベント検索 ---');
    const nishikoyamaEvents = events.filter(event => 
      event.title.includes('西小山') || 
      event.location.includes('西小山') ||
      event.description.includes('西小山')
    );
    
    if (nishikoyamaEvents.length > 0) {
      console.log(`西小山関連: ${nishikoyamaEvents.length}件`);
      nishikoyamaEvents.forEach(event => {
        console.log(`- ${event.title}`);
      });
    } else {
      console.log('西小山関連のイベントは見つかりませんでした');
    }
    
  } catch (error) {
    console.error('品川区スクレイピングエラー:', error.message);
  }
  
  // 目黒区のスクレイピング
  console.log('\n\n【目黒区のスクレイピング】');
  const meguroScraper = new MeguroScraper();
  
  try {
    const events = await meguroScraper.scrapeEvents();
    console.log(`取得イベント数: ${events.length}`);
    
    if (events.length === 0) {
      console.log('イベントが取得できませんでした。サイトの構造が変更された可能性があります。');
    }
  } catch (error) {
    console.error('目黒区スクレイピングエラー:', error.message);
  }
}

debugScraping();
