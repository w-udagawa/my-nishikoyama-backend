// 正常に動作するスクレイパーのみをインポート
const ShinagawaKankoScraper = require('./ShinagawaKankoScraper');
const MusashikoyamaPalmScraper = require('./MusashikoyamaPalmScraper');
const LoveNishikoyamaScraper = require('./LoveNishikoyamaScraper');
const PushNotificationService = require('../services/PushNotificationService');
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
      new ShinagawaKankoScraper(),    // 品川観光協会
      new MusashikoyamaPalmScraper(),  // 武蔵小山パルム
      new LoveNishikoyamaScraper()     // We Love 西小山
    ];
    this.pushService = new PushNotificationService();
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
    
    // フィルタリングを無効化（すべてのイベントを通す）
    const realEvents = allEvents;
    console.log(`フィルタリング後: ${realEvents.length}件`);
    
    // 重複を除去
    const uniqueEvents = this.removeDuplicates(realEvents);
    console.log(`重複除去後: ${uniqueEvents.length}件`);
    
    // 過去のイベントを除外
    const futureEvents = uniqueEvents.filter(event => {
      return dayjs(event.date).isAfter(dayjs().subtract(1, 'day'));
    });
    console.log(`未来のイベント: ${futureEvents.length}件`);
    
    // 既存のイベントIDを取得
    const existingEventIds = await this.getExistingEventIds();
    
    // 新規イベントを検出
    const newEvents = futureEvents.filter(event => !existingEventIds.has(event.id));
    console.log(`新規イベント: ${newEvents.length}件`);
    
    // DynamoDBに保存
    await this.saveEvents(futureEvents);
    
    // 新規イベントがある場合は通知を送信
    if (newEvents.length > 0) {
      console.log('=== 新規イベント通知送信 ===');
      for (const event of newEvents) {
        try {
          const result = await this.pushService.sendNewEventNotification(event);
          console.log(`通知送信: ${event.title} - 成功${result.successful}件, 失敗${result.failed}件`);
        } catch (error) {
          console.error(`通知送信エラー: ${event.title}`, error);
        }
      }
    }
    
    console.log('=== イベント収集完了 ===');
    
    return futureEvents;
  }

  // 既存のイベントIDを取得
  async getExistingEventIds() {
    try {
      const params = {
        TableName: tableName,
        ProjectionExpression: 'id',
        FilterExpression: 'isDemo = :isDemo',
        ExpressionAttributeValues: {
          ':isDemo': false
        }
      };
      
      const result = await docClient.scan(params).promise();
      const ids = new Set();
      
      if (result.Items) {
        result.Items.forEach(item => ids.add(item.id));
      }
      
      // ページネーション対応
      let lastEvaluatedKey = result.LastEvaluatedKey;
      while (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
        const nextResult = await docClient.scan(params).promise();
        
        if (nextResult.Items) {
          nextResult.Items.forEach(item => ids.add(item.id));
        }
        
        lastEvaluatedKey = nextResult.LastEvaluatedKey;
      }
      
      return ids;
    } catch (error) {
      console.error('既存イベントID取得エラー:', error);
      return new Set();
    }
  }

  // フィルタリング機能（現在は無効化）
  filterNonEvents(events) {
    // フィルタリングを無効化 - すべてのイベントを通す
    return events;
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
      // タイトルを正規化（スペースや記号の違いを吸収）
      const normalizedTitle = event.title.replace(/[　・・！？「」]/g, '').trim();
      const normalizedLocation = event.location.replace(/[　・・]/g, '').trim();
      const key = `${normalizedTitle}-${event.date}-${normalizedLocation}`;
      
      if (seen.has(key)) {
        // 既存のイベントより情報が充実していれば更新
        const existing = seen.get(key);
        console.log(`重複イベント検出: ${event.title} (${event.source}) - 既存: ${existing.source}`);
        
        // 情報の充実度で判定（説明が長いほうを優先）
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
        console.log(`保存: ${event.title} (${event.date})`);
      } catch (error) {
        console.error('保存エラー:', event.title, error.message);
      }
    }
    
    console.log(`DynamoDB保存完了: ${savedCount}/${events.length}件`);
  }

  // 日次サマリー送信（cronジョブから呼び出される）
  async sendDailySummary() {
    try {
      // 今日のイベントを取得
      const today = dayjs().format('YYYY-MM-DD');
      const params = {
        TableName: tableName,
        FilterExpression: '#date = :today AND isDemo = :isDemo',
        ExpressionAttributeNames: {
          '#date': 'date'
        },
        ExpressionAttributeValues: {
          ':today': today,
          ':isDemo': false
        }
      };
      
      const result = await docClient.scan(params).promise();
      const todayEvents = result.Items || [];
      
      // 日次サマリー通知を送信
      if (todayEvents.length > 0) {
        const summary = await this.pushService.sendDailySummary(todayEvents);
        console.log(`日次サマリー送信: 成功${summary.successful}件, 失敗${summary.failed}件`);
      }
    } catch (error) {
      console.error('日次サマリー送信エラー:', error);
    }
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
