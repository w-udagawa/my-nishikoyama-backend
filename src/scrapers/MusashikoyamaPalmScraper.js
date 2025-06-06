// 武蔵小山パルムのイベント情報をスクレイピング
const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const Event = require('../models/Event');

dayjs.extend(customParseFormat);

class MusashikoyamaPalmScraper {
  constructor() {
    this.baseUrl = 'https://musashikoyama-palm.jp';
    this.eventsUrl = `${this.baseUrl}/news/event`;
  }

  async scrapeEvents() {
    console.log('武蔵小山パルムのイベント情報を収集開始...');
    const events = [];

    try {
      const response = await axios.get(this.eventsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // イベント一覧を取得
      const eventElements = $('a[href*="/news/"]').toArray();
      console.log(`${eventElements.length}個のリンクを発見`);

      // イベントリンクのみをフィルタリング（数字を含むパスのみ）
      const eventLinks = [];
      eventElements.forEach(element => {
        const $elem = $(element);
        const href = $elem.attr('href');
        
        // /news/数字 のパターンに一致するリンクのみ収集
        if (href && href.match(/\/news\/\d+$/)) {
          const title = $elem.text().trim();
          if (title && !eventLinks.some(link => link.href === href)) {
            eventLinks.push({
              href: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
              title: title
            });
          }
        }
      });

      console.log(`${eventLinks.length}個のイベントリンクを発見`);

      // 各イベントの詳細を取得
      for (const link of eventLinks) {
        try {
          console.log(`イベント詳細取得: ${link.title}`);
          const eventDetail = await this.scrapeEventDetail(link.href, link.title);
          
          if (eventDetail) {
            events.push(eventDetail);
          }
          
          // レート制限対策
          await this.delay(500);
          
        } catch (error) {
          console.error(`イベント詳細取得エラー (${link.title}):`, error.message);
        }
      }

      console.log(`武蔵小山パルムから${events.length}件のイベントを取得`);
      return events;

    } catch (error) {
      console.error('武蔵小山パルムスクレイピングエラー:', error);
      return events;
    }
  }

  async scrapeEventDetail(url, fallbackTitle) {
    try {
      console.log(`詳細ページ取得: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // タイトルを取得
      const title = $('h1').first().text().trim() || 
                   $('.news-title').text().trim() ||
                   $('.article-title').text().trim() ||
                   $('title').text().trim() ||
                   fallbackTitle;
      
      // 本文を取得
      const contentArea = $('.news-content, .article-content, .content-area, .entry-content, main').first();
      const contentText = contentArea.text().trim();
      
      // 日付を抽出
      let date = '';
      
      // ページ内の日付パターンを探す
      const datePatterns = [
        /(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})日?/,
        /(\d{1,2})[月\/](\d{1,2})日?/,
        /開催日[：:]\s*(.+)/,
        /日[時程][：:]\s*(.+)/
      ];
      
      for (const pattern of datePatterns) {
        const match = contentText.match(pattern);
        if (match) {
          date = this.parseDate(match[0]);
          if (date) break;
        }
      }
      
      // 時間情報を抽出
      let time = '詳細をご確認ください';
      const timePattern = /(\d{1,2})[時：:](\d{2})?[分]?\s*[~～〜\-]\s*(\d{1,2})[時：:]?(\d{2})?[分]?/;
      const timeMatch = contentText.match(timePattern);
      if (timeMatch) {
        time = timeMatch[0];
      }
      
      // 場所情報を抽出
      let location = '武蔵小山パルム商店街';
      const locationPatterns = [
        /場所[：:]\s*([^\n]+)/,
        /会場[：:]\s*([^\n]+)/,
        /開催場所[：:]\s*([^\n]+)/
      ];
      
      for (const pattern of locationPatterns) {
        const match = contentText.match(pattern);
        if (match) {
          location = match[1].trim();
          break;
        }
      }
      
      // 説明文を作成
      const description = contentText
        .replace(/\s+/g, ' ')
        .substring(0, 500);
      
      // 日付が見つからない場合はスキップ
      if (!date || date === 'Invalid Date') {
        console.log(`日付が見つかりません: ${title}`);
        return null;
      }
      
      // イベントオブジェクトを作成
      const event = new Event({
        title: title,
        date: date,
        time: time,
        location: location,
        address: '東京都品川区小山3丁目 武蔵小山パルム商店街',
        description: description,
        source: 'musashikoyama_palm',
        sourceUrl: url,
        category: this.detectCategories(title + ' ' + location + ' ' + description),
        area: 'musashikoyama' // エリア情報を追加
      });
      
      return event;
      
    } catch (error) {
      console.error(`詳細ページ取得エラー (${url}):`, error.message);
      return null;
    }
  }

  parseDate(dateText) {
    if (!dateText) return '';
    
    // 年を含まない日付の場合、現在の年を追加
    const currentYear = dayjs().year();
    
    // 日本語の日付パターン
    const patterns = [
      { regex: /(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})日?/, format: 'YYYY-M-D' },
      { regex: /(\d{1,2})[月\/](\d{1,2})日?/, format: 'M-D', needYear: true }
    ];
    
    for (const pattern of patterns) {
      const match = dateText.match(pattern.regex);
      if (match) {
        let dateStr = match[0];
        
        // 年が必要な場合は追加
        if (pattern.needYear) {
          dateStr = `${currentYear}年${dateStr}`;
        }
        
        // 正規化
        dateStr = dateStr
          .replace(/[年\/]/g, '-')
          .replace(/[月日]/g, '')
          .trim();
        
        const parsed = dayjs(dateStr, pattern.needYear ? 'YYYY-M-D' : pattern.format);
        if (parsed.isValid()) {
          return parsed.format('YYYY-MM-DD');
        }
      }
    }
    
    return '';
  }

  detectCategories(text) {
    const categories = [];
    const lowerText = text.toLowerCase();
    
    // 地域イベント
    categories.push('local');
    
    if (lowerText.includes('セール') || lowerText.includes('sale') || 
        lowerText.includes('お得') || lowerText.includes('割引')) {
      categories.push('sale');
    }
    
    if (lowerText.includes('マルシェ') || lowerText.includes('物産') || 
        lowerText.includes('フェア') || lowerText.includes('食')) {
      categories.push('food');
    }
    
    if (lowerText.includes('祭') || lowerText.includes('まつり') || 
        lowerText.includes('フェス')) {
      categories.push('festival');
    }
    
    if (lowerText.includes('ワークショップ') || lowerText.includes('体験') || 
        lowerText.includes('教室') || lowerText.includes('づくり')) {
      categories.push('workshop');
    }
    
    if (lowerText.includes('子ども') || lowerText.includes('子供') || 
        lowerText.includes('キッズ') || lowerText.includes('親子')) {
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

module.exports = MusashikoyamaPalmScraper;
