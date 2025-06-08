// 西小山エリアのイベントをテストするスクリプト
const ShinagawaKankoScraper = require('./src/scrapers/ShinagawaKankoScraper');
const LoveNishikoyamaScraper = require('./src/scrapers/LoveNishikoyamaScraper');
const dayjs = require('dayjs');
require('dotenv').config();

async function testNishikoyamaEvents() {
  console.log('=== 西小山エリアイベントのテスト ===');
  console.log('実行日時:', dayjs().format('YYYY-MM-DD HH:mm:ss'));
  
  // 品川観光協会から西小山イベントを検索
  console.log('\n1. 品川観光協会のスクレイピングテスト');
  const kankoScraper = new ShinagawaKankoScraper();
  
  try {
    const kankoEvents = await kankoScraper.scrapeEvents();
    console.log(`品川観光協会: 合計${kankoEvents.length}件取得`);
    
    // 西小山エリアのイベントを抽出
    const nishikoyamaEvents = kankoEvents.filter(event => event.area === 'nishikoyama');
    console.log(`西小山エリアのイベント: ${nishikoyamaEvents.length}件`);
    
    nishikoyamaEvents.forEach(event => {
      console.log(`- ${event.title} (${event.date})`);
      console.log(`  場所: ${event.location}`);
      console.log(`  エリア判定根拠: タイトル・場所・説明に含まれるキーワード`);
    });
    
    // 西小山関連キーワードを含むが、他エリアに分類されたイベントも確認
    const maybeNishikoyama = kankoEvents.filter(event => 
      (event.title + event.location + event.description).includes('西小山') && 
      event.area !== 'nishikoyama'
    );
    
    if (maybeNishikoyama.length > 0) {
      console.log(`\n西小山キーワードを含むが他エリアに分類されたイベント: ${maybeNishikoyama.length}件`);
      maybeNishikoyama.forEach(event => {
        console.log(`- ${event.title} → ${event.area}エリア`);
      });
    }
    
  } catch (error) {
    console.error('品川観光協会スクレイピングエラー:', error.message);
  }
  
  // We Love 西小山から独自イベントを検索
  console.log('\n2. We Love 西小山のスクレイピングテスト');
  const loveScraper = new LoveNishikoyamaScraper();
  
  try {
    const loveEvents = await loveScraper.scrapeEvents();
    console.log(`We Love 西小山: 合計${loveEvents.length}件取得`);
    
    loveEvents.forEach(event => {
      console.log(`- ${event.title} (${event.date})`);
      console.log(`  カテゴリー: ${event.category.join(', ')}`);
    });
    
  } catch (error) {
    console.error('We Love 西小山スクレイピングエラー:', error.message);
  }
  
  // 今後の西小山イベント予定
  console.log('\n3. 今後の西小山エリアイベント（既知の情報）');
  const knownFutureEvents = [
    { 
      name: 'にしこやまつり', 
      expectedDate: '2025年10月末（毎年10月最終日曜日）',
      source: '品川観光協会で告知予定'
    },
    {
      name: '西小山イルミネーション',
      expectedDate: '2026年2月～3月（バレンタイン＆ホワイトデー期間）',
      source: '品川観光協会で告知予定'
    }
  ];
  
  knownFutureEvents.forEach(event => {
    console.log(`- ${event.name}`);
    console.log(`  予定時期: ${event.expectedDate}`);
    console.log(`  情報源: ${event.source}`);
  });
}

// 実行
testNishikoyamaEvents().catch(console.error);
