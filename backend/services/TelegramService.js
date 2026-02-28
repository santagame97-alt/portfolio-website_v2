// Сервис для отправки уведомлений в Telegram
import https from 'https';

class TelegramService {
  constructor() {
    // Токен бота и ID чата администратора
    // Получите токен у @BotFather в Telegram
    // ID чата можно получить у @userinfobot
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
    this.enabled = this.botToken && this.adminChatId;
    
    // Логирование для отладки
    if (!this.enabled) {
      console.log('Telegram config:', {
        hasToken: !!this.botToken,
        tokenLength: this.botToken.length,
        hasChatId: !!this.adminChatId,
        chatIdLength: this.adminChatId.length
      });
    } else {
      console.log('✅ Telegram уведомления включены');
    }
  }

  /**
   * Отправка сообщения в Telegram
   * @param {string} text - Текст сообщения
   * @param {Object} options - Дополнительные опции
   */
  async sendMessage(text, options = {}) {
    if (!this.enabled) {
      console.log('Telegram уведомления отключены (не настроены токен или chat ID)');
      return { success: false, error: 'NOT_CONFIGURED' };
    }

    try {
      const data = JSON.stringify({
        chat_id: this.adminChatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });

      const result = await this.makeRequest('sendMessage', data);
      return { success: true, result };
    } catch (error) {
      console.error('Ошибка отправки Telegram уведомления:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Уведомление о новом пользователе
   * @param {Object} user - Данные пользователя
   */
  async notifyNewUser(user) {
    const text = `
🆕 <b>Новый пользователь зарегистрирован!</b>

👤 <b>Имя:</b> ${this.escapeHtml(user.name)}
📧 <b>Email:</b> ${this.escapeHtml(user.email)}
🕐 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}
    `.trim();

    return await this.sendMessage(text);
  }

  /**
   * Уведомление о новом сообщении
   * @param {Object} message - Данные сообщения
   * @param {Object} sender - Данные отправителя
   */
  async notifyNewMessage(message, sender) {
    const text = `
💬 <b>Новое сообщение!</b>

👤 <b>От:</b> ${this.escapeHtml(sender.name)}
📧 <b>Email:</b> ${this.escapeHtml(sender.email)}
📝 <b>Сообщение:</b>
${this.escapeHtml(message.content.substring(0, 200))}${message.content.length > 200 ? '...' : ''}

🕐 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}
    `.trim();

    return await this.sendMessage(text);
  }

  /**
   * Выполнение HTTP запроса к Telegram API
   * @param {string} method - Метод API
   * @param {string} data - Данные для отправки
   */
  makeRequest(method, data) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${this.botToken}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.ok) {
              resolve(response.result);
            } else {
              reject(new Error(response.description || 'Telegram API error'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Экранирование HTML для Telegram
   * @param {string} text - Текст для экранирования
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Проверка настройки сервиса
   */
  isConfigured() {
    return this.enabled;
  }
}

export default TelegramService;
