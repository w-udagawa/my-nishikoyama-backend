// 西小山飲食大宴会を直接取得するテストスクリプト
const ShinagawaKankoScraper = require('./src/scrapers/ShinagawaKankoScraper');
const dayjs = require('dayjs');

async function testSpecificEvent() {
  console.log('=== 西小山飲食大宴会の取得テスト ===');
  
  const scraper = new ShinagawaKankoScraper();
  
  // URLを直接指定して取得
  const eventUrl = 'https://shinagawa-kanko.or.jp/event/nishiko-daienkai-2/';
  
  try {
    console.log('イベント詳細ページを取得中...');
    const eventDetail = await scraper.scrapeEventDetail(eventUrl);
    
    if (eventDetail) {
      console.log('\n取得成功！');
      console.log('タイトル:', eventDetail.title);
      console.log('日付:', eventDetail.date);
      console.log('場所:', eventDetail.location);
      console.log('エリア判定:', eventDetail.area);
      console.log('カテゴリー:', eventDetail.category);
      console.log('説明:', eventDetail.description.substring(0, 100) + '...');
      
      // エリア判定の詳細を確認
      console.log('\n=== エリア判定の詳細 ===');
      const testText = `${eventDetail.title} ${eventDetail.location} ${eventDetail.description}`;
      console.log('検査対象テキスト:', testText.substring(0, 200));
      
      // 西小山キーワードのチェック
      const nishikoyamaKeywords = [
        '西小山',
        'にしこやま',
        'ニシコヤマ',
        '西小山駅前広場',
        '西小山飲食'
      ];
      
      const foundKeywords = nishikoyamaKeywords.filter(keyword => 
        testText.toLowerCase().includes(keyword.toLowerCase())
      );
      
      console.log('見つかった西小山キーワード:', foundKeywords);
      
      // 日付の確認
      console.log('\n=== 日付の確認 ===');
      console.log('イベント日付:', eventDetail.date);
      console.log('今日の日付:', dayjs().format('YYYY-MM-DD'));
      console.log('過去のイベント?:', dayjs(eventDetail.date).isBefore(dayjs()));
      console.log('1週間以内?:', dayjs(eventDetail.date).isAfter(dayjs().subtract(7, 'day')));
      
    } else {
      console.log('イベント詳細の取得に失敗しました');
    }
    
  } catch (error) {
    console.error('エラー:', error.message);
  }
}

// 実行
testSpecificEvent();
