// イベントデータモデル
class Event {
  constructor(data) {
    this.id = data.id || this.generateId(data);
    this.title = data.title;
    this.date = data.date; // YYYY-MM-DD
    this.time = data.time; // HH:mm-HH:mm
    this.location = data.location;
    this.address = data.address || '';
    this.description = data.description;
    this.category = data.category || []; // ['family', 'free', 'food']
    this.source = data.source; // 'meguro_official', 'shinagawa_official', etc
    this.sourceUrl = data.sourceUrl;
    this.imageUrl = data.imageUrl || null;
    this.coordinates = data.coordinates || null; // {lat, lng}
    this.isDemo = data.isDemo || false; // デモ/ダミーデータフラグ
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId(data) {
    // タイトルと日付からユニークIDを生成
    // URLも含めてより確実にユニークにする
    const baseString = `${data.title}-${data.date}-${data.sourceUrl}`;
    // ハッシュ化してより短く、重複しにくいIDを生成
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(baseString).digest('hex');
    return hash.substring(0, 20);
  }

  // カテゴリーの自動判定
  autoDetectCategories() {
    const categories = [];
    const text = `${this.title} ${this.description}`.toLowerCase();

    // 家族・子供向け
    if (text.includes('親子') || text.includes('子ども') || text.includes('子供') || 
        text.includes('キッズ') || text.includes('ファミリー')) {
      categories.push('family');
    }

    // 無料イベント
    if (text.includes('無料') || text.includes('費用なし') || text.includes('参加費無料')) {
      categories.push('free');
    }

    // グルメ・食べ歩き
    if (text.includes('グルメ') || text.includes('食') || text.includes('マルシェ') || 
        text.includes('屋台') || text.includes('フード')) {
      categories.push('food');
    }

    // スポーツ・健康
    if (text.includes('スポーツ') || text.includes('体操') || text.includes('ヨガ') || 
        text.includes('ウォーキング')) {
      categories.push('sports');
    }

    // 文化・アート
    if (text.includes('展示') || text.includes('美術') || text.includes('音楽') || 
        text.includes('コンサート') || text.includes('文化')) {
      categories.push('culture');
    }

    // シニア向け
    if (text.includes('シニア') || text.includes('高齢者') || text.includes('敬老')) {
      categories.push('senior');
    }

    return categories;
  }

  // DynamoDB用のオブジェクトに変換
  toDynamoDBItem() {
    return {
      id: { S: this.id },
      title: { S: this.title },
      date: { S: this.date },
      time: { S: this.time },
      location: { S: this.location },
      address: { S: this.address },
      description: { S: this.description },
      category: { SS: this.category.length > 0 ? this.category : ['general'] },
      source: { S: this.source },
      sourceUrl: { S: this.sourceUrl },
      imageUrl: { S: this.imageUrl || '' },
      coordinates: this.coordinates ? {
        M: {
          lat: { N: this.coordinates.lat.toString() },
          lng: { N: this.coordinates.lng.toString() }
        }
      } : { NULL: true },
      isDemo: { BOOL: this.isDemo },
      createdAt: { S: this.createdAt },
      updatedAt: { S: this.updatedAt }
    };
  }

  // DynamoDBから復元
  static fromDynamoDBItem(item) {
    return new Event({
      id: item.id.S,
      title: item.title.S,
      date: item.date.S,
      time: item.time.S,
      location: item.location.S,
      address: item.address?.S || '',
      description: item.description.S,
      category: item.category.SS || [],
      source: item.source.S,
      sourceUrl: item.sourceUrl.S,
      imageUrl: item.imageUrl?.S || null,
      coordinates: item.coordinates?.M ? {
        lat: parseFloat(item.coordinates.M.lat.N),
        lng: parseFloat(item.coordinates.M.lng.N)
      } : null,
      isDemo: item.isDemo?.BOOL || false,
      createdAt: item.createdAt.S,
      updatedAt: item.updatedAt.S
    });
  }
}

module.exports = Event;
