const webpush = require('web-push');
const AWS = require('aws-sdk');
require('dotenv').config();

// AWS DynamoDB設定
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'ap-northeast-1'
});

// Web Push設定
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

class PushNotificationService {
  constructor() {
    this.tableName = process.env.PUSH_SUBSCRIPTIONS_TABLE || 'my-nishikoyama-push-subscriptions';
  }

  /**
   * 購読情報を保存
   */
  async saveSubscription(subscription, preferences) {
    const item = {
      subscriptionId: this.generateSubscriptionId(subscription),
      subscription: subscription,
      preferences: preferences || {
        areas: ['all'],
        timing: 'immediate'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: this.tableName,
      Item: item
    }).promise();

    return item;
  }

  /**
   * 購読を削除
   */
  async removeSubscription(subscriptionId) {
    await dynamodb.delete({
      TableName: this.tableName,
      Key: { subscriptionId }
    }).promise();
  }

  /**
   * すべての購読を取得
   */
  async getAllSubscriptions() {
    const result = await dynamodb.scan({
      TableName: this.tableName
    }).promise();

    return result.Items || [];
  }

  /**
   * エリアとタイミングに基づいて購読をフィルタリング
   */
  async getFilteredSubscriptions(area, timing = 'immediate') {
    const allSubscriptions = await this.getAllSubscriptions();
    
    return allSubscriptions.filter(sub => {
      const prefs = sub.preferences || {};
      const areas = prefs.areas || ['all'];
      const subTiming = prefs.timing || 'immediate';
      
      // タイミングチェック
      if (timing !== subTiming && subTiming !== 'all') {
        return false;
      }
      
      // エリアチェック
      return areas.includes('all') || areas.includes(area);
    });
  }

  /**
   * 新規イベント通知を送信
   */
  async sendNewEventNotification(event) {
    const area = event.area || 'nishikoyama';
    const subscriptions = await this.getFilteredSubscriptions(area, 'immediate');
    
    const payload = JSON.stringify({
      title: '新しいイベントが登録されました',
      body: `${event.title} - ${event.date} @ ${event.location}`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {
        type: 'new_event',
        eventId: event.id,
        url: `/events/${event.id}`
      },
      tag: `event-${event.id}`,
      requireInteraction: false
    });

    const results = await Promise.allSettled(
      subscriptions.map(sub => this.sendNotification(sub.subscription, payload))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`通知送信完了: 成功${successful}件, 失敗${failed}件`);

    // 失敗した購読を削除
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected' && results[i].reason.statusCode === 410) {
        await this.removeSubscription(subscriptions[i].subscriptionId);
      }
    }

    return { successful, failed };
  }

  /**
   * 日次まとめ通知を送信
   */
  async sendDailySummary(events) {
    const subscriptions = await this.getFilteredSubscriptions('all', 'daily');
    
    if (events.length === 0) {
      return { successful: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title: '本日のイベント情報',
      body: `本日は${events.length}件のイベントがあります`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {
        type: 'daily_summary',
        eventCount: events.length,
        url: '/'
      },
      tag: 'daily-summary',
      requireInteraction: false
    });

    const results = await Promise.allSettled(
      subscriptions.map(sub => this.sendNotification(sub.subscription, payload))
    );

    return {
      successful: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length
    };
  }

  /**
   * テスト通知を送信
   */
  async sendTestNotification(subscription) {
    const payload = JSON.stringify({
      title: 'テスト通知',
      body: 'Web Push通知が正常に動作しています！',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      },
      tag: 'test-notification'
    });

    return await this.sendNotification(subscription, payload);
  }

  /**
   * 通知を送信（内部メソッド）
   */
  async sendNotification(subscription, payload) {
    try {
      await webpush.sendNotification(subscription, payload);
      return { success: true };
    } catch (error) {
      console.error('通知送信エラー:', error);
      throw error;
    }
  }

  /**
   * 購読IDを生成
   */
  generateSubscriptionId(subscription) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(subscription.endpoint);
    return hash.digest('hex').substring(0, 16);
  }
}

module.exports = PushNotificationService;
