const MeguroScraper = require('./MeguroScraper');
const ShinagawaScraper = require('./ShinagawaScraper');
const ShinagawaKankoScraper = require('./ShinagawaKankoScraper');
const MusashikoyamaPalmScraper = require('./MusashikoyamaPalmScraper');
const AWS = require('aws-sdk');
const dayjs = require('dayjs');
require('dotenv').config();

// AWS DynamoDB設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

class EventCollector {
  constructor() {
    this.scrapers = [
      new MeguroScraper(),
      new ShinagawaScraper(),
      new ShinagawaKankoScraper(),
      new MusashikoyamaPalmScraper() // 武蔵小山パルムを追加
    ];
  }

  async collectAllEvents() {
    console.log('=== イベント収集開始 ===');
    console.log('実行時刻:', dayjs().format('YYYY-MM-DD HH:mm:ss'));
    
    const allEvents = [];
    
    // 各スクレイパーを実行
    for (const scraper of this.scrapers) {
      try {
        const events = await scraper.scrapeEvents();
        allEvents.push(...events);
      } catch (error) {
        console.error(`スクレイピングエラー: ${scraper.constructor.name}`, error);
      }
    }
    
    console.log(`合計${allEvents.length}件のイベントを収集`);
    
    // イベントらしくないものを除外（緩和版）
    const realEvents = this.filterNonEvents(allEvents);
    console.log(`フィルタリング後: ${realEvents.length}件`);
    
    // 重複を除去
    const uniqueEvents = this.removeDuplicates(realEvents);
    console.log(`重複除去後: ${uniqueEvents.length}件`);
    
    // 過去のイベントを除外
    const futureEvents = uniqueEvents.filter(event => {
      return dayjs(event.date).isAfter(dayjs().subtract(1, 'day'));
    });
    console.log(`未来のイベント: ${futureEvents.length}件`);
    
    // DynamoDBに保存
    await this.saveEvents(futureEvents);
    
    console.log('=== イベント収集完了 ===');
    
    return futureEvents;
  }

  filterNonEvents(events) {
    // 除外するキーワード（厳選版）
    const excludeKeywords = [
      // 言語関連
      'English', 'Kurdî', '中文', '한국어', 'Tiếng Việt', 
      'Español', 'Português', 'Français', 'Deutsch',
      
      // ナビゲーション関連
      'トップページ', 'ホーム', 'サイトマップ', 'お問い合わせ',
      'アクセス', 'プライバシーポリシー', '利用規約', 'ヘルプ',
      
      // その他
      'FAQ', 'RSS', 'PDF', '一覧', 'もっと見る'
    ];

    // タイトルの最小文字数（緩和）
    const MIN_TITLE_LENGTH = 5;

    return events.filter(event => {
      // タイトルが短すぎる場合は除外
      if (event.title.length < MIN_TITLE_LENGTH) {
        return false;
      }

      // 除外キーワードが含まれている場合
      const titleLower = event.title.toLowerCase();
      for (const keyword of excludeKeywords) {
        if (titleLower.includes(keyword.toLowerCase())) {
          return false;
        }
      }

      // URL末尾が index.html や / で終わる場合は除外
      if (event.sourceUrl.match(/(index\.html|\/$|#$)/)) {
        return false;
      }

      // 品川観光協会と武蔵小山パルムのイベントは基本的に信頼できるので、フィルタリングを緩和
      if (event.source === 'shinagawa_kanko' || event.source === 'musashikoyama_palm') {
        return true;
      }

      // その他のソースはイベントキーワードチェック
      const eventKeywords = [
        '開催', '募集', '講座', '教室', 'まつり', '祭り', 'フェス',
        'ワークショップ', 'セミナー', '体験', '展示', 'コンサート',
        '大会', '競技', '発表', '公演', '上映', '相談会', '説明会',
        '会議', 'シンポジウム', 'フォーラム', '交流', '研修', 'マルシェ',
        '宴会', 'イベント', '縁日', 'ツアー', '見学', 'セール', 'フェア'
      ];

      const hasEventKeyword = eventKeywords.some(keyword => 
        event.title.includes(keyword) || event.description.includes(keyword)
      );

      return hasEventKeyword;
    });
  }

  removeDuplicates(events) {
    const seen = new Map();
    const seenIds = new Set();
    
    return events.filter(event => {
      // IDの重複チェック
      if (seenIds.has(event.id)) {
        console.log(`重複ID検出: ${event.id} - ${event.title}`);
        // 重複する場合は、タイムスタンプを追加して新しいIDを生成
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 5);
        event.id = `${event.id.substring(0, 12)}_${timestamp}_${randomStr}`.substring(0, 20);
      }
      seenIds.add(event.id);
      
      // タイトル、日付、場所の組み合わせで重複判定
      const key = `${event.title}-${event.date}-${event.location}`;
      
      if (seen.has(key)) {
        // 既存のイベントより情報が充実していれば更新
        const existing = seen.get(key);
        if (event.description.length > existing.description.length) {
          seen.set(key, event);
        }
        return false;
      }
      
      seen.set(key, event);
      return true;
    });
  }

  async saveEvents(events) {
    console.log('DynamoDBへの保存開始...');
    
    // 個別に保存
    let savedCount = 0;
    for (const event of events) {
      try {
        await docClient.put({
          TableName: tableName,
          Item: {
            id: event.id,
            title: event.title,
            date: event.date,
            time: event.time,
            location: event.location,
            address: event.address || '',
            description: event.description,
            category: event.category || [],
            source: event.source,
            sourceUrl: event.sourceUrl,
            imageUrl: event.imageUrl || null,
            coordinates: event.coordinates || null,
            isDemo: false, // 実データとして保存
            area: event.area || 'nishikoyama', // エリア情報を保存
            createdAt: event.createdAt,
            updatedAt: event.updatedAt
          }
        }).promise();
        savedCount++;
      } catch (error) {
        console.error('保存エラー:', event.title, error.message);
      }
    }
    
    console.log(`DynamoDB保存完了: ${savedCount}/${events.length}件`);
  }


  // 手動実行用
  async runOnce() {
    try {
      await this.collectAllEvents();
    } catch (error) {
      console.error('実行エラー:', error);
      process.exit(1);
    }
  }
}

// 直接実行された場合
if (require.main === module) {
  require('dotenv').config();
  const collector = new EventCollector();
  collector.runOnce();
}

module.exports = EventCollector;
