const MeguroScraper = require('./MeguroScraper');
const ShinagawaScraper = require('./ShinagawaScraper');
const AWS = require('aws-sdk');
const dayjs = require('dayjs');

// AWS DynamoDB設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamoDB = new AWS.DynamoDB();
const tableName = process.env.DYNAMODB_TABLE_NAME;

class EventCollector {
  constructor() {
    this.scrapers = [
      new MeguroScraper(),
      new ShinagawaScraper()
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
    
    // イベントらしくないものを除外
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
    // 除外するキーワード
    const excludeKeywords = [
      // 言語関連
      'English', 'Kurdî', '中文', '한국어', 'Tiếng Việt', 
      'Español', 'Português', 'Français', 'Deutsch',
      
      // ナビゲーション関連
      'トップページ', 'ホーム', 'サイトマップ', 'お問い合わせ',
      'アクセス', 'プライバシーポリシー', '利用規約', 'ヘルプ',
      
      // カテゴリー名のみ
      '地域でのスポーツ教室', '手当・医療費助成', '子育て・児童家庭相談',
      '家庭相談・ひとり親家庭支援', '妊娠・出産', '保育園・幼稚園',
      '児童センター', 'すまいるスクール', '学校', '青少年育成',
      
      // 一般的なメニュー項目
      'イベント情報', '施設案内', '区政情報', '文化・スポーツ',
      '健康・福祉', '子ども・教育', '環境・まちづくり',
      
      // その他
      'FAQ', 'RSS', 'PDF', '一覧', 'もっと見る',
      '地域センターの詳細についてはこちら'
    ];

    // タイトルの最小文字数
    const MIN_TITLE_LENGTH = 8;

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

      // イベントらしいキーワードが含まれているか確認
      const eventKeywords = [
        '開催', '募集', '講座', '教室', 'まつり', '祭り', 'フェス',
        'ワークショップ', 'セミナー', '体験', '展示', 'コンサート',
        '大会', '競技', '発表', '公演', '上映', '相談会', '説明会',
        '会議', 'シンポジウム', 'フォーラム', '交流', '研修'
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
    
    // バッチ書き込み（25件ずつ）
    const batchSize = 25;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      // バッチ内のID重複チェック
      const batchIds = new Set();
      const uniqueBatch = [];
      
      for (const event of batch) {
        if (!batchIds.has(event.id)) {
          batchIds.add(event.id);
          uniqueBatch.push(event);
        } else {
          console.log(`バッチ内重複スキップ: ${event.id} - ${event.title}`);
        }
      }
      
      const putRequests = uniqueBatch.map(event => ({
        PutRequest: {
          Item: event.toDynamoDBItem()
        }
      }));
      
      const params = {
        RequestItems: {
          [tableName]: putRequests
        }
      };
      
      try {
        await dynamoDB.batchWriteItem(params).promise();
        console.log(`${i + uniqueBatch.length}/${events.length}件を保存`);
      } catch (error) {
        console.error('DynamoDB保存エラー:', error.message);
        // 個別に保存を試みる
        for (const event of uniqueBatch) {
          try {
            await this.saveSingleEvent(event);
          } catch (err) {
            console.error('個別保存エラー:', event.title, err.message);
          }
        }
      }
    }
    
    console.log('DynamoDB保存完了');
  }

  async saveSingleEvent(event) {
    const params = {
      TableName: tableName,
      Item: event.toDynamoDBItem()
    };
    
    await dynamoDB.putItem(params).promise();
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
