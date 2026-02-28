// Сервис сообщений
import Database from 'better-sqlite3';
import { config } from '../config.js';

class MessageService {
  constructor() {
    this.db = new Database(config.database.path);
  }

  /**
   * Получение или создание чата для пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<Object>} Объект чата
   */
  async getOrCreateChat(userId) {
    try {
      // Проверка существования пользователя
      const user = this.db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Попытка получить существующий чат
      let chat = this.db.prepare(`
        SELECT c.id, c.user_id, c.created_at, c.last_message_at, c.unread_count,
               u.name as user_name, u.email as user_email
        FROM chats c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_id = ?
      `).get(userId);

      // Если чат не существует, создаем новый
      if (!chat) {
        const stmt = this.db.prepare(`
          INSERT INTO chats (user_id, created_at, last_message_at, unread_count)
          VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        `);
        
        const result = stmt.run(userId);
        const chatId = result.lastInsertRowid;

        // Получаем созданный чат
        chat = this.db.prepare(`
          SELECT c.id, c.user_id, c.created_at, c.last_message_at, c.unread_count,
                 u.name as user_name, u.email as user_email
          FROM chats c
          JOIN users u ON c.user_id = u.id
          WHERE c.id = ?
        `).get(chatId);
      }

      // Получаем последнее сообщение
      const lastMessage = this.db.prepare(`
        SELECT m.id, m.chat_id, m.sender_id, m.content, m.is_read, m.created_at,
               u.name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.created_at DESC
        LIMIT 1
      `).get(chat.id);

      return this.formatChat(chat, lastMessage);
    } catch (error) {
      throw new Error(`Ошибка при получении/создании чата: ${error.message}`);
    }
  }

  /**
   * Получение всех чатов (только для админа)
   * @returns {Promise<Array>} Массив чатов
   */
  async getAllChats() {
    try {
      const chats = this.db.prepare(`
        SELECT c.id, c.user_id, c.created_at, c.last_message_at, c.unread_count,
               u.name as user_name, u.email as user_email
        FROM chats c
        JOIN users u ON c.user_id = u.id
        ORDER BY c.last_message_at DESC
      `).all();

      // Для каждого чата получаем последнее сообщение
      const chatsWithMessages = chats.map(chat => {
        const lastMessage = this.db.prepare(`
          SELECT m.id, m.chat_id, m.sender_id, m.content, m.is_read, m.created_at,
                 u.name as sender_name
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.chat_id = ?
          ORDER BY m.created_at DESC
          LIMIT 1
        `).get(chat.id);

        return this.formatChat(chat, lastMessage);
      });

      return chatsWithMessages;
    } catch (error) {
      throw new Error(`Ошибка при получении списка чатов: ${error.message}`);
    }
  }

  /**
   * Получение истории сообщений чата
   * @param {number} chatId - ID чата
   * @param {number} limit - Лимит сообщений (по умолчанию 50)
   * @param {number} offset - Смещение для пагинации (по умолчанию 0)
   * @returns {Promise<Array>} Массив сообщений
   */
  async getChatMessages(chatId, limit = 50, offset = 0) {
    try {
      // Проверка существования чата
      const chat = this.db.prepare('SELECT id FROM chats WHERE id = ?').get(chatId);
      if (!chat) {
        throw new Error('Чат не найден');
      }

      const messages = this.db.prepare(`
        SELECT m.id, m.chat_id, m.sender_id, m.content, m.is_read, m.created_at,
               u.name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.created_at ASC
        LIMIT ? OFFSET ?
      `).all(chatId, limit, offset);

      return messages.map(msg => this.formatMessage(msg));
    } catch (error) {
      throw new Error(`Ошибка при получении сообщений: ${error.message}`);
    }
  }

  /**
   * Отправка сообщения
   * @param {number} chatId - ID чата
   * @param {number} senderId - ID отправителя
   * @param {string} content - Текст сообщения
   * @returns {Promise<Object>} Объект сообщения
   */
  async sendMessage(chatId, senderId, content) {
    try {
      // Валидация контента
      this.validateMessageContent(content);

      // Проверка существования чата
      const chat = this.db.prepare('SELECT id, user_id FROM chats WHERE id = ?').get(chatId);
      if (!chat) {
        throw new Error('Чат не найден');
      }

      // Проверка, что отправитель является участником чата или админом
      const sender = this.db.prepare('SELECT id, is_admin, is_banned FROM users WHERE id = ?').get(senderId);
      if (!sender) {
        throw new Error('Отправитель не найден');
      }

      // Проверка бана
      if (sender.is_banned) {
        throw new Error('USER_BANNED');
      }

      // Проверка, что отправитель - это пользователь чата или админ
      if (chat.user_id !== senderId && !sender.is_admin) {
        throw new Error('Недостаточно прав для отправки сообщения в этот чат');
      }

      // Создание сообщения
      const stmt = this.db.prepare(`
        INSERT INTO messages (chat_id, sender_id, content, is_read, created_at)
        VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
      `);
      
      const result = stmt.run(chatId, senderId, content);
      const messageId = result.lastInsertRowid;

      // Обновление чата (last_message_at и unread_count)
      // Увеличиваем unread_count только если отправитель не админ
      if (!sender.is_admin) {
        this.db.prepare(`
          UPDATE chats
          SET last_message_at = CURRENT_TIMESTAMP,
              unread_count = unread_count + 1
          WHERE id = ?
        `).run(chatId);
      } else {
        this.db.prepare(`
          UPDATE chats
          SET last_message_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(chatId);
      }

      // Получение созданного сообщения
      const message = this.db.prepare(`
        SELECT m.id, m.chat_id, m.sender_id, m.content, m.is_read, m.created_at,
               u.name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `).get(messageId);

      return this.formatMessage(message);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Пометка сообщений как прочитанных
   * @param {number} chatId - ID чата
   * @param {number} userId - ID пользователя (админа)
   * @returns {Promise<void>}
   */
  async markMessagesAsRead(chatId, userId) {
    try {
      // Проверка существования чата
      const chat = this.db.prepare('SELECT id FROM chats WHERE id = ?').get(chatId);
      if (!chat) {
        throw new Error('Чат не найден');
      }

      // Проверка, что пользователь - админ
      const user = this.db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId);
      if (!user || !user.is_admin) {
        throw new Error('Только администратор может помечать сообщения как прочитанные');
      }

      // Помечаем все непрочитанные сообщения как прочитанные
      this.db.prepare(`
        UPDATE messages
        SET is_read = 1
        WHERE chat_id = ? AND is_read = 0
      `).run(chatId);

      // Обнуляем счетчик непрочитанных сообщений
      this.db.prepare(`
        UPDATE chats
        SET unread_count = 0
        WHERE id = ?
      `).run(chatId);
    } catch (error) {
      throw new Error(`Ошибка при пометке сообщений как прочитанных: ${error.message}`);
    }
  }

  /**
   * Получение количества непрочитанных сообщений
   * @param {number} chatId - ID чата
   * @returns {Promise<number>} Количество непрочитанных сообщений
   */
  async getUnreadCount(chatId) {
    try {
      const chat = this.db.prepare('SELECT unread_count FROM chats WHERE id = ?').get(chatId);
      if (!chat) {
        throw new Error('Чат не найден');
      }
      return chat.unread_count;
    } catch (error) {
      throw new Error(`Ошибка при получении количества непрочитанных сообщений: ${error.message}`);
    }
  }

  /**
   * Проверка, забанен ли пользователь
   * @param {number} userId - ID пользователя
   * @returns {Promise<boolean>} true если пользователь забанен
   */
  async isUserBanned(userId) {
    try {
      const user = this.db.prepare('SELECT is_banned FROM users WHERE id = ?').get(userId);
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      return Boolean(user.is_banned);
    } catch (error) {
      throw new Error(`Ошибка при проверке статуса бана: ${error.message}`);
    }
  }

  /**
   * Валидация контента сообщения
   * @param {string} content - Текст сообщения
   * @throws {Error} Если контент невалиден
   */
  validateMessageContent(content) {
    if (content === null || content === undefined || typeof content !== 'string') {
      throw new Error('Текст сообщения обязателен');
    }

    // Проверка на пустую строку или только пробелы
    if (content.trim().length === 0) {
      throw new Error('Сообщение не может быть пустым');
    }

    const minLength = config.validation.message.minLength;
    const maxLength = config.validation.message.maxLength;

    if (content.trim().length < minLength) {
      throw new Error(`Сообщение должно содержать минимум ${minLength} символ`);
    }

    if (content.length > maxLength) {
      throw new Error(`Сообщение должно содержать максимум ${maxLength} символов`);
    }
  }

  /**
   * Форматирование объекта чата
   * @param {Object} chat - Чат из БД
   * @param {Object|null} lastMessage - Последнее сообщение
   * @returns {Object} Отформатированный объект чата
   */
  formatChat(chat, lastMessage = null) {
    return {
      id: chat.id,
      userId: chat.user_id,
      userName: chat.user_name,
      userEmail: chat.user_email,
      lastMessage: lastMessage ? this.formatMessage(lastMessage) : null,
      unreadCount: chat.unread_count,
      createdAt: chat.created_at,
      lastMessageAt: chat.last_message_at
    };
  }

  /**
   * Форматирование объекта сообщения
   * @param {Object} message - Сообщение из БД
   * @returns {Object} Отформатированный объект сообщения
   */
  formatMessage(message) {
    return {
      id: message.id,
      chatId: message.chat_id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      content: message.content,
      isRead: Boolean(message.is_read),
      createdAt: message.created_at
    };
  }

  /**
   * Закрытие соединения с БД
   */
  close() {
    this.db.close();
  }
}

export default MessageService;
