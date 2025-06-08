// We Love 西小山のイベント情報をスクレイピング
const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const Event = require('../models/Event');

dayjs.extend(customParseFormat);

class LoveNishikoyamaScraper {
  constructor() {
    this.baseUrl = 'https://lovenishikoyama.com';
  }

  async scrapeEvents() {
    console.log('We Love 西小山の独自イベント情報を収集開始...');
    console.log('（品川観光協会に掲載されていない地域の小規模イベントを中心に収集）');
    const events = [];

    try {
      // カテゴリーページやイベント投稿を探す
      const eventPages = [
        `${this.baseUrl}/`,  // トップページ
        `${this.baseUrl}/category/event/`,  // イベントカテゴリー
        `${this.baseUrl}/category/news/`    // ニュースカテゴリー
      ];

      for (const pageUrl of eventPages) {
        try {
          console.log(`ページを取得中: ${pageUrl}`);
          
          const response = await axios.get(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
          }).catch(() => null);

          if (!response) {
            console.log(`ページが見つかりません: ${pageUrl}`);
            continue;
          }

          const $ = cheerio.load(response.data);
          
          // 記事リンクを取得
          const articleLinks = [];
          $('article a, .post a, .entry-title a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href && href.includes('lovenishikoyama.com') && !href.includes('#')) {
              articleLinks.push(href);
            }
          });

          // 各記事をチェック
          for (const articleUrl of articleLinks.slice(0, 10)) { // 最新10記事まで
            const articleEvents = await this.scrapeArticle(articleUrl);
            events.push(...articleEvents);
            await this.delay(500);
          }

          await this.delay(1000);
          
        } catch (error) {
          console.error(`ページ取得エラー (${pageUrl}):`, error.message);
        }
      }

      // 重複除去（同じタイトルのイベントを除外）
      const uniqueEvents = [];
      const seenTitles = new Set();
      
      for (const event of events) {
        if (!seenTitles.has(event.title)) {
          seenTitles.add(event.title);
          uniqueEvents.push(event);
        }
      }

      console.log(`We Love 西小山から${uniqueEvents.length}件の独自イベントを取得`);
      return uniqueEvents;

    } catch (error) {
      console.error('We Love 西小山スクレイピングエラー:', error);
      return events;
    }
  }

  async scrapeArticle(url) {
    const events = [];
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const content = $('.entry-content, .post-content, article').text();
      
      // 小規模イベントのキーワード
      const smallEventKeywords = [
        'ワークショップ',
        'セール',
        '割引',
        'フェア',
        '体験会',
        '試食会',
        '相談会',
        '展示会',
        '発表会',
        '撮影会',
        'ライブ',
        '演奏会',
        'お話会',
        '交流会',
        '即売会',
        '手作り市',
        'マーケット',
        '蚤の市'
      ];

      // 品川観光協会に載らないような小規模イベントを探す
      const isSmallEvent = smallEventKeywords.some(keyword => content.includes(keyword));
      const isMajorEvent = content.includes('にしこやまつり') || 
                          content.includes('西小山飲食大宴会') ||
                          content.includes('小山両社祭');

      // 大規模イベントは品川観光協会で取得するのでスキップ
      if (isMajorEvent) {
        return events;
      }

      // 小規模イベントの情報を抽出
      if (isSmallEvent) {
        $('p, li').each((i, elem) => {
          const text = $(elem).text();
          
          // 日付が含まれるテキストを探す
          if (text.match(/\d{1,2}月\d{1,2}日/)) {
            const eventInfo = this.parseEventFromText(text, url);
            if (eventInfo && this.isValidSmallEvent(eventInfo)) {
              events.push(eventInfo);
            }
          }
        });
      }

    } catch (error) {
      console.error(`記事取得エラー (${url}):`, error.message);
    }

    return events;
  }

  parseEventFromText(text, sourceUrl) {
    try {
      // 日付を抽出
      const dateMatch = text.match(/(\d{4}年)?(\d{1,2})月(\d{1,2})日/);
      if (!dateMatch) return null;
      
      const year = dateMatch[1] ? parseInt(dateMatch[1]) : dayjs().year();
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);
      const date = dayjs(`${year}-${month}-${day}`).format('YYYY-MM-DD');
      
      // 過去のイベントはスキップ
      if (dayjs(date).isBefore(dayjs().subtract(1, 'day'))) {
        return null;
      }

      // タイトルを抽出（「」内の文字列を優先）
      let title = '';
      const titleMatch = text.match(/「([^」]+)」/);
      if (titleMatch) {
        title = titleMatch[1];
      } else {
        // 「」がない場合は、イベントキーワードを含む部分を抽出
        const keywords = ['ワークショップ', 'セール', 'フェア', '体験会', 'ライブ', '即売会'];
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            const keywordIndex = text.indexOf(keyword);
            title = text.substring(Math.max(0, keywordIndex - 20), keywordIndex + keyword.length + 20).trim();
            break;
          }
        }
      }
      
      if (!title) return null;
      
      // 場所を抽出（デフォルトは西小山）
      let location = '西小山';
      const locationMatch = text.match(/場所[:：]([^、。\n]+)/);
      if (locationMatch) {
        location = locationMatch[1].trim();
      } else if (text.includes('於') || text.includes('にて')) {
        const venueMatch = text.match(/(?:於|にて)[:：]?([^、。\n]+)/);
        if (venueMatch) {
          location = venueMatch[1].trim();
        }
      }
      
      // 時間を抽出
      let time = '詳細は店舗にお問い合わせください';
      const timeMatch = text.match(/(\d{1,2}[:：時]\d{0,2}[～〜~-]\d{1,2}[:：時]\d{0,2})/);
      if (timeMatch) {
        time = timeMatch[1];
      }
      
      return new Event({
        title: title.substring(0, 100), // タイトルは100文字まで
        date: date,
        time: time,
        location: location,
        description: text.substring(0, 300),
        source: 'love_nishikoyama',
        sourceUrl: sourceUrl,
        category: this.detectCategories(title + ' ' + text),
        area: 'nishikoyama'
      });
      
    } catch (error) {
      console.error('イベント解析エラー:', error.message);
      return null;
    }
  }

  isValidSmallEvent(event) {
    // 品川観光協会に載るような大規模イベントを除外
    const majorEventKeywords = [
      'にしこやまつり',
      '西小山飲食大宴会',
      '小山両社祭',
      '品川区民まつり',
      'しながわ宿場まつり'
    ];
    
    const isMajor = majorEventKeywords.some(keyword => 
      event.title.includes(keyword) || event.description.includes(keyword)
    );
    
    return !isMajor;
  }

  detectCategories(text) {
    const categories = [];
    const lowerText = text.toLowerCase();
    
    categories.push('local'); // 西小山の地域イベント
    
    if (lowerText.includes('ワークショップ') || lowerText.includes('体験')) {
      categories.push('workshop');
    }
    
    if (lowerText.includes('セール') || lowerText.includes('割引') || 
        lowerText.includes('フェア')) {
      categories.push('shopping');
    }
    
    if (lowerText.includes('ライブ') || lowerText.includes('演奏') || 
        lowerText.includes('音楽')) {
      categories.push('music');
    }
    
    if (lowerText.includes('展示') || lowerText.includes('アート') || 
        lowerText.includes('作品')) {
      categories.push('art');
    }
    
    if (lowerText.includes('子ども') || lowerText.includes('親子') || 
        lowerText.includes('キッズ')) {
      categories.push('family');
    }
    
    if (lowerText.includes('マルシェ') || lowerText.includes('市') || 
        lowerText.includes('マーケット')) {
      categories.push('market');
    }
    
    return categories.length > 0 ? categories : ['general'];
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = LoveNishikoyamaScraper;
