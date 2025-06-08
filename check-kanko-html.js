// 品川観光協会のHTML構造を確認
const axios = require('axios');
const cheerio = require('cheerio');

async function checkHtmlStructure() {
  console.log('=== 品川観光協会のHTML構造確認 ===\n');
  
  try {
    const url = 'https://shinagawa-kanko.or.jp/event/';
    console.log(`URL: ${url}\n`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('--- ページタイトル ---');
    console.log($('title').text());
    
    console.log('\n--- イベントリストの可能性があるセレクター ---');
    
    // よくあるイベントリストのセレクター
    const selectors = [
      '.event-list',
      '.event-item',
      '.post-list',
      '.article-list',
      'article',
      '.entry',
      '.card',
      '.item',
      '[class*="event"]',
      '[class*="post"]',
      '[class*="article"]',
      '[class*="list"]'
    ];
    
    selectors.forEach(selector => {
      const count = $(selector).length;
      if (count > 0) {
        console.log(`${selector}: ${count}個`);
        
        // 最初の要素の構造を表示
        if (count > 0 && selector.includes('event')) {
          const first = $(selector).first();
          console.log(`  最初の要素のHTML:`);
          console.log(`  ${first.html()?.substring(0, 200)}...`);
        }
      }
    });
    
    console.log('\n--- リンクを含む要素 ---');
    // h2, h3, h4内のリンクを探す
    ['h2 a', 'h3 a', 'h4 a', '.title a', '.heading a'].forEach(selector => {
      const links = $(selector);
      if (links.length > 0) {
        console.log(`\n${selector}: ${links.length}個`);
        links.slice(0, 3).each((i, elem) => {
          const $link = $(elem);
          console.log(`  ${i+1}. ${$link.text().trim()}`);
          console.log(`     href: ${$link.attr('href')}`);
        });
      }
    });
    
    console.log('\n--- ページ内のテキスト検索 ---');
    const bodyText = $('body').text();
    if (bodyText.includes('西小山')) {
      console.log('✅ "西小山"というテキストが見つかりました');
    }
    if (bodyText.includes('イベント')) {
      console.log('✅ "イベント"というテキストが見つかりました');
    }
    
    // HTMLの一部を保存して詳細確認
    console.log('\n--- メインコンテンツエリアの確認 ---');
    const mainSelectors = ['main', '#main', '.main', '#content', '.content'];
    mainSelectors.forEach(selector => {
      const elem = $(selector);
      if (elem.length > 0) {
        console.log(`\n${selector}が見つかりました`);
        const html = elem.html();
        if (html) {
          console.log(`内容の一部: ${html.substring(0, 500)}...`);
        }
      }
    });
    
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
  }
}

checkHtmlStructure();
