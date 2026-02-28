// WebSocket сервер для real-time коммуникации
import { WebSocketServer as WSServer } from 'ws';
import AuthService from './AuthService.js';
import MessageService from './MessageService.js';
import {
  MessageTypes,
  createNewMessagePayload,
  createMessageReadPayload,
  createTypingPayload,
  createUserBannedPayload,
  createConnectedPayload,
  createErrorPayload,
  validateMessage,
  validateNewMessagePayload,
  validateMessageReadPayload,
  validateTypingPayload
} from '../types/WebSocketMessageTypes.js';

class WebSocketServer {
  constructor(server) {
    this.wss = new WSServer({ server });
    this.authService = new AuthService();
    this.messageService = new MessageService();
    
    // Хранилище подключенных клиентов: Map<userId, Set<WebSocket>>
    this.clients = new Map();
    
    // Heartbeat интервал (30 секунд)
    this.heartbeatInterval = 30000;
    
    this.setupServer();
  }

  /**
   * Настройка WebSocket сервера
   */
  setupServer() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Периодическая проверка живых соединений
    setInterval(() => {
      this.checkHeartbeats();
    }, this.heartbeatInterval);

    console.log('WebSocket сервер запущен');
  }

  /**
   * Обработка нового подключения
   * @param {WebSocket} ws - WebSocket соединение
   * @param {Object} req - HTTP запрос
   */
  async handleConnection(ws, req) {
    try {
      // Извлечение токена из query параметров или заголовков
      const token = this.extractToken(req);
      
      if (!token) {
        ws.close(1008, 'Токен аутентификации не предоставлен');
        return;
      }

      // Валидация токена и получение пользователя
      const user = await this.authenticateToken(token);
      
      if (!user) {
        ws.close(1008, 'Невалидный токен аутентификации');
        return;
      }

      // Проверка бана
      if (user.isBanned) {
        ws.close(1008, 'Пользователь заблокирован');
        return;
      }

      // Сохранение информации о пользователе в соединении
      ws.userId = user.id;
      ws.isAdmin = user.isAdmin;
      ws.isAlive = true;

      // Добавление клиента в хранилище
      this.addClient(user.id, ws);

      console.log(`Пользователь ${user.id} (${user.name}) подключился`);

      // Отправка подтверждения подключения
      this.sendToSocket(ws, createConnectedPayload(user.id, user.isAdmin));

      // Обработка pong ответов для heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Обработка входящих сообщений
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // Обработка отключения
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      // Обработка ошибок
      ws.on('error', (error) => {
        console.error(`WebSocket ошибка для пользователя ${ws.userId}:`, error);
      });

    } catch (error) {
      console.error('Ошибка при подключении:', error);
      ws.close(1011, 'Внутренняя ошибка сервера');
    }
  }

  /**
   * Обработка отключения клиента
   * @param {WebSocket} ws - WebSocket соединение
   */
  handleDisconnect(ws) {
    if (ws.userId) {
      this.removeClient(ws.userId, ws);
      console.log(`Пользователь ${ws.userId} отключился`);
    }
  }

  /**
   * Обработка входящего сообщения
   * @param {WebSocket} ws - WebSocket соединение
   * @param {Buffer} data - Данные сообщения
   */
  async handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Валидация сообщения
      validateMessage(message);
      
      switch (message.type) {
        case MessageTypes.NEW_MESSAGE:
          validateNewMessagePayload(message.payload);
          await this.handleNewMessage(ws, message.payload);
          break;
        
        case MessageTypes.MESSAGE_READ:
          validateMessageReadPayload(message.payload);
          await this.handleMessageRead(ws, message.payload);
          break;
        
        case MessageTypes.TYPING:
          validateTypingPayload(message.payload);
          await this.handleTyping(ws, message.payload);
          break;
        
        case MessageTypes.PING:
          // Ответ на ping для поддержания соединения
          this.sendToSocket(ws, { type: MessageTypes.PONG });
          break;
        
        default:
          console.warn(`Неизвестный тип сообщения: ${message.type}`);
      }
    } catch (error) {
      console.error('Ошибка при обработке сообщения:', error);
      this.sendToSocket(ws, createErrorPayload(error.message || 'Ошибка при обработке сообщения'));
    }
  }

  /**
   * Обработка нового сообщения
   * @param {WebSocket} ws - WebSocket соединение отправителя
   * @param {Object} payload - Данные сообщения
   */
  async handleNewMessage(ws, payload) {
    try {
      const { chatId, content } = payload;

      // Отправка сообщения через MessageService
      const message = await this.messageService.sendMessage(chatId, ws.userId, content);

      // Получение информации о чате для определения получателя
      const chat = await this.messageService.getOrCreateChat(message.chatId);

      // Отправка сообщения отправителю (подтверждение)
      this.sendToSocket(ws, createNewMessagePayload(message));

      // Отправка сообщения получателю
      if (ws.isAdmin) {
        // Админ отправил сообщение пользователю
        this.sendToUser(chat.userId, createNewMessagePayload(message));
      } else {
        // Пользователь отправил сообщение админу
        this.sendToAdmins(createNewMessagePayload(message));
      }

    } catch (error) {
      console.error('Ошибка при отправке сообщения:', error);
      
      // Отправка ошибки отправителю
      const errorMessage = error.message === 'USER_BANNED' 
        ? 'Вы заблокированы и не можете отправлять сообщения'
        : error.message;
      
      this.sendToSocket(ws, createErrorPayload(errorMessage));
    }
  }

  /**
   * Обработка пометки сообщений как прочитанных
   * @param {WebSocket} ws - WebSocket соединение
   * @param {Object} payload - Данные
   */
  async handleMessageRead(ws, payload) {
    try {
      const { chatId } = payload;

      // Только админ может помечать сообщения как прочитанные
      if (!ws.isAdmin) {
        throw new Error('Недостаточно прав');
      }

      await this.messageService.markMessagesAsRead(chatId, ws.userId);

      // Уведомление админа об успехе
      this.sendToSocket(ws, createMessageReadPayload(chatId));

    } catch (error) {
      console.error('Ошибка при пометке сообщений как прочитанных:', error);
      this.sendToSocket(ws, createErrorPayload(error.message));
    }
  }

  /**
   * Обработка индикатора набора текста
   * @param {WebSocket} ws - WebSocket соединение
   * @param {Object} payload - Данные
   */
  async handleTyping(ws, payload) {
    try {
      const { chatId, isTyping } = payload;

      // Получение информации о чате
      const chat = await this.messageService.getOrCreateChat(chatId);

      // Отправка индикатора набора текста получателю
      if (ws.isAdmin) {
        // Админ печатает - уведомляем пользователя
        this.sendToUser(chat.userId, createTypingPayload(chatId, isTyping, ws.userId));
      } else {
        // Пользователь печатает - уведомляем админов
        this.sendToAdmins(createTypingPayload(chatId, isTyping, ws.userId));
      }

    } catch (error) {
      console.error('Ошибка при обработке индикатора набора:', error);
    }
  }

  /**
   * Уведомление пользователя о бане
   * @param {number} userId - ID пользователя
   */
  notifyUserBanned(userId) {
    this.sendToUser(userId, createUserBannedPayload());

    // Закрытие всех соединений пользователя
    const userSockets = this.clients.get(userId);
    if (userSockets) {
      userSockets.forEach(socket => {
        socket.close(1008, 'Пользователь заблокирован');
      });
      this.clients.delete(userId);
    }
  }

  /**
   * Извлечение токена из запроса
   * @param {Object} req - HTTP запрос
   * @returns {string|null} JWT токен
   */
  extractToken(req) {
    // Попытка извлечь из query параметров
    const url = new URL(req.url, `http://${req.headers.host}`);
    const tokenFromQuery = url.searchParams.get('token');
    
    if (tokenFromQuery) {
      return tokenFromQuery;
    }

    // Попытка извлечь из заголовка Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Аутентификация токена
   * @param {string} token - JWT токен
   * @returns {Promise<Object|null>} Объект пользователя или null
   */
  async authenticateToken(token) {
    try {
      return await this.authService.validateSession(token);
    } catch (error) {
      console.error('Ошибка аутентификации токена:', error);
      return null;
    }
  }

  /**
   * Добавление клиента в хранилище
   * @param {number} userId - ID пользователя
   * @param {WebSocket} ws - WebSocket соединение
   */
  addClient(userId, ws) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);
  }

  /**
   * Удаление клиента из хранилища
   * @param {number} userId - ID пользователя
   * @param {WebSocket} ws - WebSocket соединение
   */
  removeClient(userId, ws) {
    const userSockets = this.clients.get(userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  /**
   * Отправка сообщения конкретному пользователю
   * @param {number} userId - ID пользователя
   * @param {Object} message - Сообщение для отправки
   */
  sendToUser(userId, message) {
    const userSockets = this.clients.get(userId);
    if (userSockets) {
      userSockets.forEach(socket => {
        this.sendToSocket(socket, message);
      });
    }
  }

  /**
   * Отправка сообщения всем подключенным админам
   * @param {Object} message - Сообщение для отправки
   */
  sendToAdmins(message) {
    this.clients.forEach((sockets, userId) => {
      sockets.forEach(socket => {
        if (socket.isAdmin) {
          this.sendToSocket(socket, message);
        }
      });
    });
  }

  /**
   * Отправка сообщения в конкретный сокет
   * @param {WebSocket} socket - WebSocket соединение
   * @param {Object} message - Сообщение для отправки
   */
  sendToSocket(socket, message) {
    if (socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(message));
    }
  }

  /**
   * Проверка живых соединений (heartbeat)
   */
  checkHeartbeats() {
    this.wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log(`Закрытие неактивного соединения для пользователя ${ws.userId}`);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }

  /**
   * Закрытие WebSocket сервера
   */
  close() {
    this.wss.close();
    this.authService.close();
    this.messageService.close();
  }
}

export default WebSocketServer;
