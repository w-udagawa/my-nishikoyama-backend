const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const Event = require('../models/Event');

class ShinagawaScraper {
  constructor() {
    this.baseUrl = 'https://www.city.shinagawa.tokyo.jp';
    this.eventsUrl = `${this.baseUrl}/PC/eventcalendar/index.html`;
    this.userAgent = process.env.SCRAPING_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  async scrapeEvents() {
    console.log('品川区のイベント情報を収集開始...');
    const events = [];

    try {
      // イベントカレンダーページを取得
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
      
      console.log('取得したHTMLの長さ:', response.data.length);

      // イベント関連のリンクを探す
      const eventLinks = $('a').filter((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        
        // イベントっぽいリンクを判定
        return text.length > 5 && 
               !text.includes('トップページ') && 
               !text.includes('検索') &&
               !text.includes('メニュー') &&
               (href.includes('event') || 
                href.includes('moyooshi') ||
                href.includes('kouza') ||
                text.includes('開催') ||
                text.includes('募集') ||
                text.includes('講座') ||
                text.includes('教室') ||
                text.includes('まつり') ||
                text.includes('イベント'));
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

      // 他のイベントページも確認
      const additionalEvents = await this.scrapeAdditionalEventPages();
      events.push(...additionalEvents);

      console.log(`品川区から${events.length}件のイベントを取得`);
      return events;

    } catch (error) {
      console.error('品川区スクレイピングエラー:', error.message);
      return [];
    }
  }

  async scrapeAdditionalEventPages() {
    const events = [];
    
    // 追加でチェックするページ
    const additionalUrls = [
      `${this.baseUrl}/PC/sangyo/sangyo-bunka/sangyo-bunka-bunnkaevento/index.html`, // 芸術・文化イベント
      `${this.baseUrl}/PC/kankyo/kankyo-kankyo/kankyo-kankyo-event/index.html`, // 環境イベント
      `${this.baseUrl}/PC/shisetsu/shisetsu-kuyakusyo/shisetsu-kuyakusyo-chiiki/hpg000017088.html` // 区民まつり
    ];

    for (const url of additionalUrls) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': this.userAgent
          }
        });

        const $ = cheerio.load(response.data);
        
        // イベント情報を抽出
        $('a').each((index, element) => {
          const eventData = this.parseEventLink($, element);
          if (eventData && this.isNishikoyamaRelated(eventData)) {
            events.push(eventData);
          }
        });
        
      } catch (error) {
        console.error(`追加ページスクレイピングエラー (${url}):`, error.message);
      }
    }
    
    return events;
  }

  parseEventLink($, element) {
    const $link = $(element);
    const title = $link.text().trim();
    const href = $link.attr('href');
    
    if (!title || !href || title.length < 5) return null;
    
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

    // 場所情報（品川区の施設名から推測）
    let location = '品川区内';
    const facilityKeywords = [
      '児童センター', '図書館', '区民センター', '公園',
      '文化センター', '体育館', '小学校', '中学校',
      '広場', 'ホール', '会館'
    ];
    
    for (const keyword of facilityKeywords) {
      if (title.includes(keyword)) {
        location = keyword;
        break;
      }
    }

    // イベントオブジェクトを作成
    const event = new Event({
      title,
      date,
      time: '詳細をご確認ください',
      location,
      description: title,
      source: 'shinagawa_official',
      sourceUrl,
      category: []
    });

    // カテゴリーを自動検出
    event.category = event.autoDetectCategories();

    return event;
  }

  isNishikoyamaRelated(event) {
    const searchText = `${event.title} ${event.location} ${event.description}`.toLowerCase();
    
    // 西小山に関連する可能性のあるキーワード
    const keywords = [
      '西小山', 'にしこやま', 
      '小山台', '小山', 
      '荏原', 'えばら',  // 西小山は荏原地区に含まれる
      '第二延山小学校',  // 西小山近辺の小学校
      '荏原第六中学校'   // 西小山近辺の中学校
    ];
    
    // すべてのイベントを取得する（開発中は地域限定なし）
    // return keywords.some(keyword => searchText.includes(keyword));
    return true; // 一時的にすべてのイベントを取得
  }

  parseDate(dateText) {
    if (!dateText) return null;

    // ISO形式（data-date属性など）
    if (dateText.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateText;
    }

    // 年月日形式
    const fullDateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (fullDateMatch) {
      return `${fullDateMatch[1]}-${fullDateMatch[2].padStart(2, '0')}-${fullDateMatch[3].padStart(2, '0')}`;
    }

    // 月日形式（今年と仮定）
    const monthDayMatch = dateText.match(/(\d{1,2})月(\d{1,2})日/);
    if (monthDayMatch) {
      const year = dayjs().year();
      const month = monthDayMatch[1].padStart(2, '0');
      const day = monthDayMatch[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 月/日形式
    const slashMatch = dateText.match(/(\d{1,2})\/(\d{1,2})/);
    if (slashMatch) {
      const year = dayjs().year();
      return `${year}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
    }

    return null;
  }
}

module.exports = ShinagawaScraper;
