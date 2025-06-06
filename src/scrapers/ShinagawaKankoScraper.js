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
        
        // イベント一覧を取得
        const eventElements = $('.event-list__item, .post-list__item').toArray();
        console.log(`${eventElements.length}個のイベントを発見`);

        for (const element of eventElements) {
          try {
            const $elem = $(element);
            
            // タイトルとリンクを取得
            const titleElem = $elem.find('h3 a, .post-list__title a').first();
            const title = titleElem.text().trim();
            const link = titleElem.attr('href');
            
            if (!title || !link) continue;
            
            // 詳細ページを取得
            const eventDetail = await this.scrapeEventDetail(link);
            
            if (eventDetail) {
              events.push({
                ...eventDetail,
                title: title,
                sourceUrl: link.startsWith('http') ? link : `${this.baseUrl}${link}`
              });
            }
          } catch (error) {
            console.error(`イベント解析エラー:`, error.message);
          }
        }
        
        // 次のページがあるか確認
        hasNextPage = $('.pagination .next, .nav-links .next').length > 0;
        currentPage++;
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
      const response = await axios.get(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // イベント情報を抽出
      let date = '';
      let time = '詳細をご確認ください';
      let location = '';
      let address = '';
      let description = '';
      
      // 日付を探す（複数のパターンに対応）
      const datePatterns = [
        $('.event-date'),
        $('.post-meta__date'),
        $('dt:contains("開催日")').next('dd'),
        $('th:contains("開催日")').next('td'),
        $('.event-info__item:contains("開催日")')
      ];
      
      for (const pattern of datePatterns) {
        if (pattern.length > 0) {
          const dateText = pattern.first().text().trim();
          date = this.parseDate(dateText);
          if (date) break;
        }
      }
      
      // 時間を探す
      const timePatterns = [
        $('.event-time'),
        $('dt:contains("時間")').next('dd'),
        $('th:contains("時間")').next('td'),
        $('.event-info__item:contains("時間")')
      ];
      
      for (const pattern of timePatterns) {
        if (pattern.length > 0) {
          time = pattern.first().text().trim() || time;
          break;
        }
      }
      
      // 場所を探す
      const locationPatterns = [
        $('.event-location'),
        $('.event-venue'),
        $('dt:contains("場所")').next('dd'),
        $('dt:contains("会場")').next('dd'),
        $('th:contains("場所")').next('td'),
        $('th:contains("会場")').next('td')
      ];
      
      for (const pattern of locationPatterns) {
        if (pattern.length > 0) {
          location = pattern.first().text().trim();
          if (location) break;
        }
      }
      
      // 住所を探す
      const addressPatterns = [
        $('.event-address'),
        $('dt:contains("住所")').next('dd'),
        $('th:contains("住所")').next('td')
      ];
      
      for (const pattern of addressPatterns) {
        if (pattern.length > 0) {
          address = pattern.first().text().trim();
          if (address) break;
        }
      }
      
      // 説明文を取得
      const descPatterns = [
        $('.event-description'),
        $('.post-content'),
        $('.entry-content'),
        $('.event-detail')
      ];
      
      for (const pattern of descPatterns) {
        if (pattern.length > 0) {
          description = pattern.first().text().trim()
            .replace(/\s+/g, ' ')
            .substring(0, 500);
          if (description) break;
        }
      }
      
      // 最低限の情報がない場合はスキップ
      if (!date || date === 'Invalid Date') {
        return null;
      }
      
      // イベントオブジェクトを作成
      const event = new Event({
        title: '',
        date: date,
        time: time,
        location: location || '品川区内',
        address: address,
        description: description || '',
        source: 'shinagawa_kanko',
        sourceUrl: fullUrl,
        category: this.detectCategories(location + ' ' + description)
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
}

module.exports = ShinagawaKankoScraper;
