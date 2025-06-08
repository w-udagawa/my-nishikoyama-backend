// 西小山エリアの近い過去・未来のイベントを取得するスクリプト
const ShinagawaKankoScraper = require('./src/scrapers/ShinagawaKankoScraper');
const AWS = require('aws-sdk');
const dayjs = require('dayjs');
require('dotenv').config();

// AWS設定
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

class RecentEventCollector {
  constructor() {
    this.scraper = new ShinagawaKankoScraper();
  }

  async collectRecentEvents() {
    console.log('=== 西小山エリアの近い過去・未来のイベントを収集 ===');
    console.log('実行日時:', dayjs().format('YYYY-MM-DD HH:mm:ss'));
    
    try {
      // スクレイピング実行
      const events = await this.scraper.scrapeEvents();
      console.log(`品川観光協会から${events.length}件のイベントを取得`);
      
      // 西小山エリアのイベントのみ抽出
      const nishikoyamaEvents = events.filter(event => event.area === 'nishikoyama');
      console.log(`西小山エリアのイベント: ${nishikoyamaEvents.length}件`);
      
      // 過去1週間〜未来のイベントを含める
      const oneWeekAgo = dayjs().subtract(7, 'day');
      const recentEvents = nishikoyamaEvents.filter(event => {
        return dayjs(event.date).isAfter(oneWeekAgo);
      });
      
      console.log(`過去1週間〜未来の西小山イベント: ${recentEvents.length}件`);
      
      // イベント詳細を表示
      recentEvents.forEach((event, i) => {
        const isPast = dayjs(event.date).isBefore(dayjs());
        console.log(`\n--- イベント ${i + 1} ${isPast ? '【最近終了】' : '【開催予定】'} ---`);
        console.log(`タイトル: ${event.title}`);
        console.log(`日付: ${event.date}`);
        console.log(`場所: ${event.location}`);
        console.log(`カテゴリー: ${event.category.join(', ')}`);
      });
      
      // データベースに保存（過去1週間のイベントも含む）
      if (recentEvents.length > 0) {
        console.log('\nデータベースに保存中...');
        for (const event of recentEvents) {
          try {
            await docClient.put({
              TableName: tableName,
              Item: {
                ...event,
                isDemo: false,
                createdAt: event.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            }).promise();
            console.log(`保存完了: ${event.title}`);
          } catch (error) {
            console.error(`保存エラー: ${event.title}`, error.message);
          }
        }
      }
      
    } catch (error) {
      console.error('エラー:', error);
    }
  }
}

// 実行
const collector = new RecentEventCollector();
collector.collectRecentEvents();
