// src/services/lineNotifyService.js
// LINE Notifyを使った自動通知サービス

const axios = require('axios');
require('dotenv').config();

class LineNotifyService {
  constructor() {
    this.token = process.env.LINE_NOTIFY_TOKEN;
    this.enabled = process.env.LINE_NOTIFY_ENABLED === 'true';
    this.apiUrl = 'https://notify-api.line.me/api/notify';
    
    if (this.enabled && !this.token) {
      console.warn('⚠️ LINE Notify: トークンが設定されていません');
      this.enabled = false;
    }
  }

  async notifyNewEvent(event) {
    if (!this.enabled) {
      console.log('LINE Notify: 無効化されています');
      return;
    }

    try {
      const message = this.formatEventMessage(event);
      await this.sendMessage(message);
      console.log('✅ LINE通知送信成功:', event.title);
    } catch (error) {
      console.error('❌ LINE通知送信エラー:', error.message);
    }
  }

  async sendMessage(message) {
    try {
      const response = await axios.post(
        this.apiUrl,
        `message=${encodeURIComponent(message)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${this.token}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('LINE Notify APIエラー:', error.response?.data || error.message);
      throw error;
    }
  }

  formatEventMessage(event) {
    const emoji = this.getAreaEmoji(event.area);
    const dateStr = event.date;
    
    let message = `\n${emoji} 新着イベント情報\n`;
    message += `━━━━━━━━━━━━━━━\n`;
    message += `📌 ${event.title}\n`;
    message += `📅 ${dateStr} ${event.time}\n`;
    message += `📍 ${event.location}\n`;
    
    if (event.category && event.category.length > 0) {
      const categoryEmojis = {
        family: '👨‍👩‍👧‍👦',
        free: '🆓',
        food: '🍽️',
        sports: '🏃',
        culture: '🎨',
        senior: '👴'
      };
      
      const categories = event.category
        .map(cat => categoryEmojis[cat] || cat)
        .join(' ');
      message += `🏷️ ${categories}\n`;
    }
    
    if (event.description) {
      // 説明文を最大100文字に制限
      const shortDesc = event.description.length > 100 
        ? event.description.substring(0, 100) + '...' 
        : event.description;
      message += `\n${shortDesc}\n`;
    }
    
    message += `━━━━━━━━━━━━━━━\n`;
    message += `🔗 詳細: https://my-nishikoyama-frontend.vercel.app/event/${event.id}`;
    
    return message;
  }

  getAreaEmoji(area) {
    const areaEmojis = {
      nishikoyama: '🌸',
      musashikoyama: '🎋',
      shinagawa_other: '🗼'
    };
    return areaEmojis[area] || '📍';
  }

  // 複数イベントの一括通知（まとめて通知する場合）
  async notifyMultipleEvents(events) {
    if (!this.enabled || !events || events.length === 0) return;

    let message = '\n🆕 新着イベントが追加されました！\n';
    message += `━━━━━━━━━━━━━━━\n`;
    
    // エリア別に集計
    const areaCount = {
      nishikoyama: 0,
      musashikoyama: 0,
      shinagawa_other: 0
    };
    
    events.forEach(event => {
      if (areaCount[event.area] !== undefined) {
        areaCount[event.area]++;
      }
    });
    
    // サマリー
    if (areaCount.nishikoyama > 0) {
      message += `🌸 西小山: ${areaCount.nishikoyama}件\n`;
    }
    if (areaCount.musashikoyama > 0) {
      message += `🎋 武蔵小山: ${areaCount.musashikoyama}件\n`;
    }
    if (areaCount.shinagawa_other > 0) {
      message += `🗼 品川区その他: ${areaCount.shinagawa_other}件\n`;
    }
    
    message += `━━━━━━━━━━━━━━━\n`;
    
    // 最大3件まで詳細を表示
    const displayEvents = events.slice(0, 3);
    displayEvents.forEach((event, index) => {
      const emoji = this.getAreaEmoji(event.area);
      message += `\n${emoji} ${event.title}\n`;
      message += `📅 ${event.date} ${event.time}\n`;
      message += `📍 ${event.location}\n`;
    });
    
    if (events.length > 3) {
      message += `\n他 ${events.length - 3}件のイベント\n`;
    }
    
    message += `\n🔗 詳細はこちら:\nhttps://my-nishikoyama-frontend.vercel.app`;
    
    try {
      await this.sendMessage(message);
      console.log(`✅ ${events.length}件のイベントをまとめて通知しました`);
    } catch (error) {
      console.error('❌ まとめ通知エラー:', error.message);
    }
  }
}

module.exports = LineNotifyService;
