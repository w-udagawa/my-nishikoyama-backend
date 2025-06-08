// 過去1週間のイベントも含めてスクレイピング・保存するスクリプト
const EventCollector = require('./src/scrapers');
const dayjs = require('dayjs');
require('dotenv').config();

class ExtendedEventCollector extends EventCollector {
  async collectAllEvents() {
    console.log('=== イベント収集開始（過去1週間含む） ===');
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
    
    // 重複を除去
    const uniqueEvents = this.removeDuplicates(allEvents);
    console.log(`重複除去後: ${uniqueEvents.length}件`);
    
    // 過去1週間〜未来のイベントを含める
    const oneWeekAgo = dayjs().subtract(7, 'day');
    const recentAndFutureEvents = uniqueEvents.filter(event => {
      return dayjs(event.date).isAfter(oneWeekAgo);
    });
    console.log(`過去1週間〜未来のイベント: ${recentAndFutureEvents.length}件`);
    
    // エリア別の統計
    const nishikoyama = recentAndFutureEvents.filter(e => e.area === 'nishikoyama').length;
    const musashikoyama = recentAndFutureEvents.filter(e => e.area === 'musashikoyama').length;
    const other = recentAndFutureEvents.filter(e => e.area === 'shinagawa_other').length;
    
    console.log(`エリア別: 西小山${nishikoyama}件、武蔵小山${musashikoyama}件、その他${other}件`);
    
    // DynamoDBに保存
    await this.saveEvents(recentAndFutureEvents);
    
    console.log('=== イベント収集完了 ===');
    
    return recentAndFutureEvents;
  }
}

// 実行
async function run() {
  const collector = new ExtendedEventCollector();
  await collector.collectAllEvents();
}

run().catch(console.error);
