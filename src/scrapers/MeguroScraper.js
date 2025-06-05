const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const Event = require('../models/Event');

class MeguroScraper {
  constructor() {
    this.baseUrl = 'https://www.city.meguro.tokyo.jp';
    this.eventsUrl = `${this.baseUrl}/event/index.html`;
    this.userAgent = process.env.SCRAPING_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  async scrapeEvents() {
    console.log('目黒区のイベント情報を収集開始...');
    const events = [];

    try {
      // イベント一覧ページを取得
      const response = await axios.get(this.eventsUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        }
      });

      const $ = cheerio.load(response.data);
      
      // デバッグ: HTMLの一部を確認
      console.log('取得したHTMLの長さ:', response.data.length);
      
      // 本文エリアを見つける
      const mainContent = $('#main, .main-content, #contents').first();
      
      // イベントリンクを探す（より幅広いセレクタ）
      const eventLinks = $('a').filter((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        
        // イベントっぽいリンクを判定
        return text.length > 5 && 
               !text.includes('トップページ') && 
               !text.includes('検索') &&
               !text.includes('メニュー') &&
               (href.includes('/event/') || 
                href.includes('event') || 
                text.includes('開催') ||
                text.includes('募集') ||
                text.includes('講座') ||
                text.includes('教室') ||
                text.includes('まつり'));
      });

      console.log(`${eventLinks.length}個のイベント候補リンクを発見`);

      // 各イベントリンクを処理
      eventLinks.each((index, element) => {
        try {
          const eventData = this.parseEventLink($, element);
          if (eventData && this.isNishikoyamaRelated(eventData)) {
            events.push(eventData);
          }
        } catch (error) {
          console.error('イベント解析エラー:', error.message);
        }
      });

      // イベントカレンダーからも取得を試みる
      const calendarEvents = await this.scrapeCalendarEvents();
      events.push(...calendarEvents);

      console.log(`目黒区から${events.length}件のイベントを取得`);
      return events;

    } catch (error) {
      console.error('目黒区スクレイピングエラー:', error.message);
      return [];
    }
  }

  parseEventLink($, element) {
    const $link = $(element);
    const title = $link.text().trim();
    const href = $link.attr('href');
    
    if (!title || !href) return null;
    
    const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

    // タイトルから日付を抽出
    let date = null;
    const datePatterns = [
      /(\d{4})年(\d{1,2})月(\d{1,2})日/,
      /令和(\d+)年(\d{1,2})月(\d{1,2})日/,
      /(\d{1,2})月(\d{1,2})日/
    ];

    for (const pattern of datePatterns) {
      const match = title.match(pattern);
      if (match) {
        if (pattern.source.includes('令和')) {
          const year = 2018 + parseInt(match[1]);
          date = `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else if (match.length === 4) {
          date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          const year = dayjs().year();
          date = `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        }
        break;
      }
    }

    // 日付が取得できない場合
    if (!date) {
      // URLから日付を推測してみる
      const urlDateMatch = href.match(/(\d{4})(\d{2})(\d{2})|20(\d{2})-(\d{1,2})-(\d{1,2})/);
      if (urlDateMatch) {
        if (urlDateMatch[1]) {
          // YYYYMMDD形式
          date = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;
        } else {
          // YYYY-MM-DD形式
          date = `20${urlDateMatch[4]}-${urlDateMatch[5].padStart(2, '0')}-${urlDateMatch[6].padStart(2, '0')}`;
        }
      } else {
        // タイトルによって日付を推測
        if (title.includes('夏') || title.includes('サマー')) {
          date = dayjs().month(6).date(15).format('YYYY-MM-DD'); // 7月5日
        } else if (title.includes('春')) {
          date = dayjs().month(3).date(15).format('YYYY-MM-DD'); // 4月5日
        } else if (title.includes('秋')) {
          date = dayjs().month(9).date(15).format('YYYY-MM-DD'); // 10月5日
        } else if (title.includes('冬')) {
          date = dayjs().month(11).date(15).format('YYYY-MM-DD'); // 12月5日
        } else {
          // デフォルトは1ヶ月後
          date = dayjs().add(1, 'month').format('YYYY-MM-DD');
        }
      }
    }

    // イベントオブジェクトを作成
    const event = new Event({
      title,
      date,
      time: '詳細をご確認ください',
      location: '目黒区内',
      description: title,
      source: 'meguro_official',
      sourceUrl,
      category: []
    });

    // カテゴリーを自動検出
    event.category = event.autoDetectCategories();

    return event;
  }

  async scrapeCalendarEvents() {
    const events = [];
    
    try {
      // カレンダーページURL
      const calendarUrl = `${this.baseUrl}/cgi-bin/event_cal_multi/calendar.cgi`;
      
      const response = await axios.get(calendarUrl, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      const $ = cheerio.load(response.data);
      
      // カレンダー内のイベントを探す
      const calendarLinks = $('a').filter((i, el) => {
        const href = $(el).attr('href') || '';
        return href.includes('event') && $(el).text().trim().length > 0;
      });

      console.log(`カレンダーから${calendarLinks.length}個のイベントを発見`);

      calendarLinks.each((index, element) => {
        const eventData = this.parseEventLink($, element);
        if (eventData && this.isNishikoyamaRelated(eventData)) {
          events.push(eventData);
        }
      });
      
    } catch (error) {
      console.error('カレンダースクレイピングエラー:', error.message);
    }
    
    return events;
  }

  isNishikoyamaRelated(event) {
    const searchText = `${event.title} ${event.location} ${event.description}`.toLowerCase();
    const keywords = ['西小山', 'にしこやま', '原町', '小山', '碑文谷', '目黒本町'];
    
    // 西小山関連のイベントのみ取得
    return keywords.some(keyword => searchText.includes(keyword));
  }

  parseDate(dateText) {
    if (!dateText) return null;

    // 年月日形式
    const fullDateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (fullDateMatch) {
      return `${fullDateMatch[1]}-${fullDateMatch[2].padStart(2, '0')}-${fullDateMatch[3].padStart(2, '0')}`;
    }

    // 月日形式（今年と仮定）
    const monthDayMatch = dateText.match(/(\d{1,2})月(\d{1,2})日/);
    if (monthDayMatch) {
      const year = dayjs().year();
      return `${year}-${monthDayMatch[1].padStart(2, '0')}-${monthDayMatch[2].padStart(2, '0')}`;
    }

    // 令和形式
    const reiwaMatch = dateText.match(/令和(\d+)年(\d{1,2})月(\d{1,2})日/);
    if (reiwaMatch) {
      const year = 2018 + parseInt(reiwaMatch[1]);
      return `${year}-${reiwaMatch[2].padStart(2, '0')}-${reiwaMatch[3].padStart(2, '0')}`;
    }

    return null;
  }
}

module.exports = MeguroScraper;
