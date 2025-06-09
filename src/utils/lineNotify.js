// src/utils/lineNotify.js
// LINE Notifyを使った自動通知機能

const axios = require('axios');

class LineNotify {
  constructor(token) {
    this.token = token;
    this.apiUrl = 'https://notify-api.line.me/api/notify';
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
      
      console.log('LINE Notify送信成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('LINE Notify送信エラー:', error.response?.data || error.message);
      throw error;
    }
  }

  // イベント情報をフォーマットしてメッセージを作成
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

  // 複数イベントをまとめて通知
  async notifyNewEvents(events) {
    if (!events || events.length === 0) return;

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
    
    await this.sendMessage(message);
  }
}

module.exports = LineNotify;
