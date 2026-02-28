// Тесты для MessageService
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import MessageService from './MessageService.js';
import AuthService from './AuthService.js';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import fs from 'fs';

describe('MessageService', () => {
  let messageService;
  let authService;
  let testDbPath;
  let testUser1;
  let testUser2;
  let adminUser;

  beforeEach(async () => {
    // Создаем временную тестовую БД
    testDbPath = './test-messages.db';
    config.database.path = testDbPath;

    // Инициализируем БД
    const db = new Database(testDbPath);
    
    // Создаем таблицы
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        is_banned INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unread_count INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    
    db.close();

    // Создаем сервисы
    authService = new AuthService();
    messageService = new MessageService();

    // Создаем тестовых пользователей
    const user1Result = await authService.register('user1@test.com', 'password123', 'Test User 1');
    testUser1 = user1Result.user;

    const user2Result = await authService.register('user2@test.com', 'password123', 'Test User 2');
    testUser2 = user2Result.user;

    // Создаем админа
    const adminResult = await authService.register('admin@test.com', 'password123', 'Admin User');
    adminUser = adminResult.user;
    
    // Делаем пользователя админом
    const db2 = new Database(testDbPath);
    db2.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(adminUser.id);
    db2.close();
  });

  afterEach(() => {
    // Закрываем соединения
    if (messageService) {
      messageService.close();
    }
    if (authService) {
      authService.close();
    }

    // Удаляем тестовую БД
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('getOrCreateChat', () => {
    it('должен создать новый чат для пользователя', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);

      assert.ok(chat);
      assert.ok(chat.id);
      assert.strictEqual(chat.userId, testUser1.id);
      assert.strictEqual(chat.userName, testUser1.name);
      assert.strictEqual(chat.userEmail, testUser1.email);
      assert.strictEqual(chat.unreadCount, 0);
      assert.strictEqual(chat.lastMessage, null);
    });

    it('должен вернуть существующий чат при повторном вызове', async () => {
      const chat1 = await messageService.getOrCreateChat(testUser1.id);
      const chat2 = await messageService.getOrCreateChat(testUser1.id);

      assert.strictEqual(chat1.id, chat2.id);
      assert.strictEqual(chat1.userId, chat2.userId);
    });

    it('должен выбросить ошибку для несуществующего пользователя', async () => {
      await assert.rejects(
        async () => await messageService.getOrCreateChat(99999),
        /Пользователь не найден/
      );
    });
  });

  describe('getAllChats', () => {
    it('должен вернуть пустой массив если нет чатов', async () => {
      const chats = await messageService.getAllChats();
      assert.deepStrictEqual(chats, []);
    });

    it('должен вернуть все чаты', async () => {
      await messageService.getOrCreateChat(testUser1.id);
      await messageService.getOrCreateChat(testUser2.id);

      const chats = await messageService.getAllChats();
      assert.strictEqual(chats.length, 2);
      assert.ok(chats[0].userId);
      assert.ok(chats[1].userId);
    });

    it('должен вернуть чаты отсортированные по последнему сообщению', async () => {
      const chat1 = await messageService.getOrCreateChat(testUser1.id);
      await new Promise(resolve => setTimeout(resolve, 10)); // Задержка для разного времени создания
      const chat2 = await messageService.getOrCreateChat(testUser2.id);

      // Отправляем сообщение в первый чат (позже по времени)
      await new Promise(resolve => setTimeout(resolve, 10));
      await messageService.sendMessage(chat1.id, testUser1.id, 'Привет!');

      const chats = await messageService.getAllChats();
      // Первый чат в списке должен быть тот, где было последнее сообщение (chat1)
      assert.strictEqual(chats[0].id, chat1.id);
      assert.strictEqual(chats[1].id, chat2.id);
    });
  });

  describe('sendMessage', () => {
    it('должен отправить сообщение от пользователя', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      const message = await messageService.sendMessage(chat.id, testUser1.id, 'Тестовое сообщение');

      assert.ok(message);
      assert.ok(message.id);
      assert.strictEqual(message.chatId, chat.id);
      assert.strictEqual(message.senderId, testUser1.id);
      assert.strictEqual(message.content, 'Тестовое сообщение');
      assert.strictEqual(message.isRead, false);
    });

    it('должен отправить сообщение от админа', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      const message = await messageService.sendMessage(chat.id, adminUser.id, 'Ответ админа');

      assert.ok(message);
      assert.strictEqual(message.senderId, adminUser.id);
      assert.strictEqual(message.content, 'Ответ админа');
    });

    it('должен увеличить unread_count при отправке от пользователя', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 1');
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 2');

      const updatedChat = await messageService.getOrCreateChat(testUser1.id);
      assert.strictEqual(updatedChat.unreadCount, 2);
    });

    it('не должен увеличивать unread_count при отправке от админа', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await messageService.sendMessage(chat.id, adminUser.id, 'Ответ админа');

      const updatedChat = await messageService.getOrCreateChat(testUser1.id);
      assert.strictEqual(updatedChat.unreadCount, 0);
    });

    it('должен выбросить ошибку при отправке пустого сообщения', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await assert.rejects(
        async () => await messageService.sendMessage(chat.id, testUser1.id, ''),
        /Сообщение не может быть пустым/
      );
    });

    it('должен выбросить ошибку при отправке сообщения только с пробелами', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await assert.rejects(
        async () => await messageService.sendMessage(chat.id, testUser1.id, '   '),
        /Сообщение не может быть пустым/
      );
    });

    it('должен выбросить ошибку USER_BANNED для забаненного пользователя', async () => {
      // Баним пользователя
      const db = new Database(testDbPath);
      db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(testUser1.id);
      db.close();

      const chat = await messageService.getOrCreateChat(testUser1.id);
      await assert.rejects(
        async () => await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение'),
        /USER_BANNED/
      );
    });

    it('должен выбросить ошибку для несуществующего чата', async () => {
      await assert.rejects(
        async () => await messageService.sendMessage(99999, testUser1.id, 'Сообщение'),
        /Чат не найден/
      );
    });

    it('должен выбросить ошибку если пользователь пытается отправить в чужой чат', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await assert.rejects(
        async () => await messageService.sendMessage(chat.id, testUser2.id, 'Сообщение'),
        /Недостаточно прав/
      );
    });
  });

  describe('getChatMessages', () => {
    it('должен вернуть пустой массив для чата без сообщений', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      const messages = await messageService.getChatMessages(chat.id);

      assert.deepStrictEqual(messages, []);
    });

    it('должен вернуть все сообщения чата', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 1');
      await messageService.sendMessage(chat.id, adminUser.id, 'Ответ админа');
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 2');

      const messages = await messageService.getChatMessages(chat.id);
      assert.strictEqual(messages.length, 3);
      assert.strictEqual(messages[0].content, 'Сообщение 1');
      assert.strictEqual(messages[1].content, 'Ответ админа');
      assert.strictEqual(messages[2].content, 'Сообщение 2');
    });

    it('должен поддерживать пагинацию', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      for (let i = 1; i <= 5; i++) {
        await messageService.sendMessage(chat.id, testUser1.id, `Сообщение ${i}`);
      }

      const messages = await messageService.getChatMessages(chat.id, 2, 1);
      assert.strictEqual(messages.length, 2);
      assert.strictEqual(messages[0].content, 'Сообщение 2');
      assert.strictEqual(messages[1].content, 'Сообщение 3');
    });

    it('должен выбросить ошибку для несуществующего чата', async () => {
      await assert.rejects(
        async () => await messageService.getChatMessages(99999),
        /Чат не найден/
      );
    });
  });

  describe('markMessagesAsRead', () => {
    it('должен пометить все сообщения как прочитанные', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 1');
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 2');

      await messageService.markMessagesAsRead(chat.id, adminUser.id);

      const messages = await messageService.getChatMessages(chat.id);
      assert.strictEqual(messages[0].isRead, true);
      assert.strictEqual(messages[1].isRead, true);
    });

    it('должен обнулить счетчик непрочитанных сообщений', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 1');
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 2');

      await messageService.markMessagesAsRead(chat.id, adminUser.id);

      const unreadCount = await messageService.getUnreadCount(chat.id);
      assert.strictEqual(unreadCount, 0);
    });

    it('должен выбросить ошибку если пользователь не админ', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await assert.rejects(
        async () => await messageService.markMessagesAsRead(chat.id, testUser1.id),
        /Только администратор/
      );
    });

    it('должен выбросить ошибку для несуществующего чата', async () => {
      await assert.rejects(
        async () => await messageService.markMessagesAsRead(99999, adminUser.id),
        /Чат не найден/
      );
    });
  });

  describe('getUnreadCount', () => {
    it('должен вернуть 0 для нового чата', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      const count = await messageService.getUnreadCount(chat.id);
      assert.strictEqual(count, 0);
    });

    it('должен вернуть правильное количество непрочитанных сообщений', async () => {
      const chat = await messageService.getOrCreateChat(testUser1.id);
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 1');
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 2');
      await messageService.sendMessage(chat.id, testUser1.id, 'Сообщение 3');

      const count = await messageService.getUnreadCount(chat.id);
      assert.strictEqual(count, 3);
    });

    it('должен выбросить ошибку для несуществующего чата', async () => {
      await assert.rejects(
        async () => await messageService.getUnreadCount(99999),
        /Чат не найден/
      );
    });
  });

  describe('isUserBanned', () => {
    it('должен вернуть false для не забаненного пользователя', async () => {
      const isBanned = await messageService.isUserBanned(testUser1.id);
      assert.strictEqual(isBanned, false);
    });

    it('должен вернуть true для забаненного пользователя', async () => {
      const db = new Database(testDbPath);
      db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(testUser1.id);
      db.close();

      const isBanned = await messageService.isUserBanned(testUser1.id);
      assert.strictEqual(isBanned, true);
    });

    it('должен выбросить ошибку для несуществующего пользователя', async () => {
      await assert.rejects(
        async () => await messageService.isUserBanned(99999),
        /Пользователь не найден/
      );
    });
  });

  describe('validateMessageContent', () => {
    it('должен принять валидное сообщение', () => {
      assert.doesNotThrow(() => messageService.validateMessageContent('Валидное сообщение'));
    });

    it('должен выбросить ошибку для пустой строки', () => {
      assert.throws(
        () => messageService.validateMessageContent(''),
        /Сообщение не может быть пустым/
      );
    });

    it('должен выбросить ошибку для строки только с пробелами', () => {
      assert.throws(
        () => messageService.validateMessageContent('   '),
        /Сообщение не может быть пустым/
      );
    });

    it('должен выбросить ошибку для null', () => {
      assert.throws(
        () => messageService.validateMessageContent(null),
        /Текст сообщения обязателен/
      );
    });

    it('должен выбросить ошибку для слишком длинного сообщения', () => {
      const longMessage = 'a'.repeat(5001);
      assert.throws(
        () => messageService.validateMessageContent(longMessage),
        /максимум/
      );
    });
  });
});
