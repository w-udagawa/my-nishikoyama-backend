// スクレイピングのテスト実行
const EventCollector = require('./src/scrapers');

async function testScraping() {
  console.log('=== スクレイピングテスト開始 ===');
  console.log('実行時刻:', new Date().toLocaleString('ja-JP'));
  
  const collector = new EventCollector();
  
  try {
    const events = await collector.collectAllEvents();
    console.log('\n=== 収集結果 ===');
    console.log(`収集イベント数: ${events.length}`);
    
    if (events.length > 0) {
      console.log('\n最初の3件を表示:');
      events.slice(0, 3).forEach((event, index) => {
        console.log(`\n--- イベント${index + 1} ---`);
        console.log(`タイトル: ${event.title}`);
        console.log(`日時: ${event.date} ${event.time}`);
        console.log(`場所: ${event.location}`);
        console.log(`ソース: ${event.source}`);
      });
    } else {
      console.log('\nイベントが収集できませんでした。');
      console.log('考えられる原因:');
      console.log('1. スクレイピング対象のサイトの構造が変わった');
      console.log('2. フィルタリングが厳しすぎる');
      console.log('3. 対象地域のイベント情報が掲載されていない');
    }
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

testScraping();
