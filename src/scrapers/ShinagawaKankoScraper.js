// 品川観光協会のイベント情報をスクレイピング
const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const Event = require('../models/Event');

dayjs.extend(customParseFormat);

class ShinagawaKankoScraper {
  constructor() {
    this.baseUrl = 'https://shinagawa-kanko.or.jp';
    this.eventsUrl = `${this.baseUrl}/event/`;
  }

  async scrapeEvents() {
    console.log('品川観光協会のイベント情報を収集開始...');
    const events = [];

    try {
      // 最初のページを取得
      let currentPage = 1;
      let hasNextPage = true;
      
      while (hasNextPage && currentPage <= 5) { // 最大5ページまで
        const url = currentPage === 1 ? this.eventsUrl : `${this.eventsUrl}page/${currentPage}/`;
        console.log(`ページ${currentPage}を取得中: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const $ = cheerio.load(response.data);
        
        // イベント一覧を取得（修正版）
        const eventElements = $('.p-postList__item').toArray();
        console.log(`${eventElements.length}個のイベントを発見`);

        for (const element of eventElements) {
          try {
            const $elem = $(element);
            
            // リンクを取得
            const linkElem = $elem.find('.p-postList__link').first();
            const link = linkElem.attr('href');
            
            // タイトルを取得（画像のaltテキストまたはテキスト要素から）
            let title = $elem.find('.p-postList__title').text().trim() ||
                       $elem.find('img').attr('alt') ||
                       $elem.find('h3').text().trim() ||
                       $elem.find('.c-postCard__title').text().trim();
            
            if (!title || !link) {
              console.log('タイトルまたはリンクが見つかりません');
              continue;
            }
            
            console.log(`イベント発見: ${title}`);
            
            // 詳細ページを取得
            const eventDetail = await this.scrapeEventDetail(link);
            
            if (eventDetail) {
              events.push({
                ...eventDetail,
                title: eventDetail.title || title,
                sourceUrl: link.startsWith('http') ? link : `${this.baseUrl}${link}`
              });
            }
            
            // レート制限対策
            await this.delay(500);
            
          } catch (error) {
            console.error(`イベント解析エラー:`, error.message);
          }
        }
        
        // 次のページがあるか確認
        hasNextPage = $('.pagination .next, .nav-links .next, .page-numbers.next').length > 0;
        currentPage++;
        
        // レート制限対策
        await this.delay(1000);
      }

      console.log(`品川観光協会から${events.length}件のイベントを取得`);
      return events;

    } catch (error) {
      console.error('品川観光協会スクレイピングエラー:', error);
      return events;
    }
  }

  async scrapeEventDetail(url) {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
      console.log(`詳細ページ取得: ${fullUrl}`);
      
      const response = await axios.get(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // タイトルを取得
      let title = $('h1').first().text().trim() || 
                   $('.entry-title').text().trim() ||
                   $('.article-title').text().trim();
      
      // 【終了】タグを除去
      title = title.replace(/【終了】/g, '').trim();
      
      // イベント情報テーブルまたはリストから情報を抽出
      let date = '';
      let time = '詳細をご確認ください';
      let location = '';
      let address = '';
      let description = '';
      
      // テーブル形式の情報を探す
      $('table tr, dl').each((i, elem) => {
        const $elem = $(elem);
        const text = $elem.text();
        
        // 日付
        if (text.includes('開催日') || text.includes('日時') || text.includes('日程')) {
          const dateText = $elem.find('td, dd').text().trim() || 
                          $elem.text().replace(/開催日|日時|日程/, '').trim();
          date = this.parseDate(dateText);
        }
        
        // 時間
        if (text.includes('時間') || text.includes('開催時間')) {
          time = $elem.find('td, dd').text().trim() || 
                $elem.text().replace(/時間|開催時間/, '').trim();
        }
        
        // 場所
        if (text.includes('場所') || text.includes('会場') || text.includes('開催場所')) {
          location = $elem.find('td, dd').text().trim() || 
                    $elem.text().replace(/場所|会場|開催場所/, '').trim();
        }
        
        // 住所
        if (text.includes('住所') || text.includes('所在地')) {
          address = $elem.find('td, dd').text().trim() || 
                   $elem.text().replace(/住所|所在地/, '').trim();
        }
      });
      
      // 本文から説明を取得
      description = $('.entry-content, .article-content, .post-content, .content')
        .first()
        .text()
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, 500);
      
      // 日付が見つからない場合は本文から探す
      if (!date) {
        const bodyText = $('body').text();
        date = this.parseDate(bodyText);
      }
      
      // 最低限の情報がない場合はスキップ
      if (!date || date === 'Invalid Date' || !title) {
        console.log(`必要な情報が不足: タイトル="${title}", 日付="${date}"`);
        return null;
      }
      
      // エリアを判定（改善版）
      const area = this.detectArea(title, location, address, description);
      console.log(`エリア判定: ${title} → ${area}`);
      
      // イベントオブジェクトを作成
      const event = new Event({
        title: title,
        date: date,
        time: time,
        location: location || '品川区内',
        address: address,
        description: description || '',
        source: 'shinagawa_kanko',
        sourceUrl: fullUrl,
        category: this.detectCategories(title + ' ' + location + ' ' + description),
        area: area
      });
      
      return event;
      
    } catch (error) {
      console.error(`詳細ページ取得エラー (${url}):`, error.message);
      return null;
    }
  }

  parseDate(dateText) {
    if (!dateText) return '';
    
    // 日本語の日付パターン
    const patterns = [
      'YYYY年M月D日',
      'YYYY年MM月DD日',
      'YYYY/M/D',
      'YYYY/MM/DD',
      'YYYY-MM-DD',
      'M月D日',
      'MM月DD日'
    ];
    
    // 日付を含む可能性のある部分を抽出
    const dateMatch = dateText.match(/(\d{4}年)?\d{1,2}月\d{1,2}日|\d{4}\/\d{1,2}\/\d{1,2}|\d{4}-\d{1,2}-\d{1,2}/);
    if (dateMatch) {
      dateText = dateMatch[0];
    }
    
    // 年が含まれない場合は現在の年を追加
    if (!dateText.includes('年') && !dateText.includes('/') && !dateText.includes('-')) {
      if (dateText.match(/\d{1,2}月\d{1,2}日/)) {
        dateText = `${dayjs().year()}年${dateText}`;
      }
    }
    
    for (const pattern of patterns) {
      const parsed = dayjs(dateText, pattern);
      if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD');
      }
    }
    
    return '';
  }

  detectArea(title, location, address, description) {
    const allText = `${title} ${location} ${address} ${description}`.toLowerCase();
    
    // 武蔵小山のキーワード
    const musashikoyamaKeywords = [
      '武蔵小山',
      'むさしこやま',
      'ムサシコヤマ',
      'パルム',
      'palm',
      '小山3丁目',
      '小山三丁目',
      '荏原4'  // info&cafe SQUAREの住所
    ];
    
    // 西小山のキーワード
    const nishikoyamaKeywords = [
      '西小山',
      'にしこやま',
      'ニシコヤマ',
      '原町',
      '小山6丁目',
      '小山六丁目',
      '小山7丁目',
      '小山七丁目',
      'にこま',
      'にこまる',
      '西小山駅前広場',
      '西小山駅前',
      '西小山飲食',
      'ニシコヤマルシェ'
    ];
    
    // 品川区その他のキーワード（より具体的に）
    const shinagawaOtherKeywords = [
      '品川駅',
      '大井町',
      '大崎',
      '五反田',
      '目黒',
      '天王洲',
      '北品川',
      '南品川',
      '東品川',
      '西品川',
      '大井',
      '西五反田',
      '東五反田',
      '上大崎',
      '下目黒',
      '戸越',
      '中延',
      '旗の台',
      '荏原町',
      '雅叙園',
      'toc',
      'ビル'
    ];
    
    // 明示的なエリア判定（より厳密に）
    
    // まず品川区その他のキーワードをチェック（優先度高）
    const isShinagawaOther = shinagawaOtherKeywords.some(keyword => 
      allText.includes(keyword)
    );
    
    // 武蔵小山の判定
    const isMusashikoyama = musashikoyamaKeywords.some(keyword => 
      allText.includes(keyword)
    );
    
    // 西小山の判定  
    const isNishikoyama = nishikoyamaKeywords.some(keyword => 
      allText.includes(keyword)
    );
    
    // エリア判定の改善（優先順位を考慮）
    if (isShinagawaOther && !isMusashikoyama && !isNishikoyama) {
      return 'shinagawa_other';
    } else if (isMusashikoyama && !isNishikoyama) {
      return 'musashikoyama';
    } else if (isNishikoyama && !isMusashikoyama) {
      return 'nishikoyama';
    } else if (isMusashikoyama && isNishikoyama) {
      // 両方のキーワードが含まれる場合は、より多く含まれる方を選択
      const musashiCount = musashikoyamaKeywords.filter(k => allText.includes(k)).length;
      const nishiCount = nishikoyamaKeywords.filter(k => allText.includes(k)).length;
      return musashiCount > nishiCount ? 'musashikoyama' : 'nishikoyama';
    } else {
      // どのキーワードにも該当しない場合
      // 品川区のイベントなので、デフォルトは「その他」とする
      return 'shinagawa_other';
    }
  }

  detectCategories(text) {
    const categories = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('西小山') || lowerText.includes('武蔵小山')) {
      categories.push('local'); // 地域イベント
    }
    
    if (lowerText.includes('マルシェ') || lowerText.includes('宴会') || 
        lowerText.includes('飲食') || lowerText.includes('グルメ')) {
      categories.push('food');
    }
    
    if (lowerText.includes('祭') || lowerText.includes('まつり') || 
        lowerText.includes('フェス')) {
      categories.push('festival');
    }
    
    if (lowerText.includes('ワークショップ') || lowerText.includes('体験') || 
        lowerText.includes('教室')) {
      categories.push('workshop');
    }
    
    if (lowerText.includes('子ども') || lowerText.includes('子供') || 
        lowerText.includes('親子') || lowerText.includes('ファミリー')) {
      categories.push('family');
    }
    
    if (lowerText.includes('無料')) {
      categories.push('free');
    }
    
    return categories.length > 0 ? categories : ['general'];
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ShinagawaKankoScraper;
