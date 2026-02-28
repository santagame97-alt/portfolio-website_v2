/**
 * Типы WebSocket сообщений для системы real-time коммуникации
 * Требования: 10.1, 10.2
 */

/**
 * Типы сообщений WebSocket
 */
export const MessageTypes = {
  // Клиент -> Сервер
  NEW_MESSAGE: 'new_message',
  MESSAGE_READ: 'message_read',
  TYPING: 'typing',
  PING: 'ping',
  
  // Сервер -> Клиент
  CONNECTED: 'connected',
  USER_BANNED: 'user_banned',
  MESSAGES_READ: 'messages_read',
  PONG: 'pong',
  ERROR: 'error'
};

/**
 * Создание сообщения о новом сообщении в чате
 * @param {Object} message - Объект сообщения
 * @returns {Object} WebSocket сообщение
 */
export function createNewMessagePayload(message) {
  return {
    type: MessageTypes.NEW_MESSAGE,
    payload: {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt
    }
  };
}

/**
 * Создание сообщения о прочтении сообщений
 * @param {number} chatId - ID чата
 * @returns {Object} WebSocket сообщение
 */
export function createMessageReadPayload(chatId) {
  return {
    type: MessageTypes.MESSAGE_READ,
    payload: {
      chatId
    }
  };
}

/**
 * Создание сообщения об индикаторе набора текста
 * @param {number} chatId - ID чата
 * @param {boolean} isTyping - Печатает ли пользователь
 * @param {number} userId - ID пользователя
 * @returns {Object} WebSocket сообщение
 */
export function createTypingPayload(chatId, isTyping, userId) {
  return {
    type: MessageTypes.TYPING,
    payload: {
      chatId,
      isTyping,
      userId
    }
  };
}

/**
 * Создание сообщения о бане пользователя
 * @param {string} message - Сообщение о бане
 * @returns {Object} WebSocket сообщение
 */
export function createUserBannedPayload(message = 'Вы были заблокированы администратором') {
  return {
    type: MessageTypes.USER_BANNED,
    payload: {
      message
    }
  };
}

/**
 * Создание сообщения об успешном подключении
 * @param {number} userId - ID пользователя
 * @param {boolean} isAdmin - Является ли пользователь администратором
 * @returns {Object} WebSocket сообщение
 */
export function createConnectedPayload(userId, isAdmin) {
  return {
    type: MessageTypes.CONNECTED,
    payload: {
      userId,
      isAdmin
    }
  };
}

/**
 * Создание сообщения об ошибке
 * @param {string} message - Сообщение об ошибке
 * @returns {Object} WebSocket сообщение
 */
export function createErrorPayload(message) {
  return {
    type: MessageTypes.ERROR,
    payload: {
      message
    }
  };
}

/**
 * Валидация входящего сообщения
 * @param {Object} message - Сообщение для валидации
 * @returns {boolean} true если сообщение валидно
 * @throws {Error} если сообщение невалидно
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'object') {
    throw new Error('Сообщение должно быть объектом');
  }
  
  if (!message.type || typeof message.type !== 'string') {
    throw new Error('Тип сообщения обязателен');
  }
  
  if (!Object.values(MessageTypes).includes(message.type)) {
    throw new Error(`Неизвестный тип сообщения: ${message.type}`);
  }
  
  return true;
}

/**
 * Валидация payload для нового сообщения
 * @param {Object} payload - Payload для валидации
 * @throws {Error} если payload невалиден
 */
export function validateNewMessagePayload(payload) {
  if (!payload.chatId) {
    throw new Error('chatId обязателен');
  }
  
  if (!payload.content || typeof payload.content !== 'string') {
    throw new Error('content обязателен и должен быть строкой');
  }
  
  if (payload.content.trim().length === 0) {
    throw new Error('content не может быть пустым');
  }
}

/**
 * Валидация payload для прочтения сообщений
 * @param {Object} payload - Payload для валидации
 * @throws {Error} если payload невалиден
 */
export function validateMessageReadPayload(payload) {
  if (!payload.chatId) {
    throw new Error('chatId обязателен');
  }
}

/**
 * Валидация payload для индикатора набора текста
 * @param {Object} payload - Payload для валидации
 * @throws {Error} если payload невалиден
 */
export function validateTypingPayload(payload) {
  if (!payload.chatId) {
    throw new Error('chatId обязателен');
  }
  
  if (typeof payload.isTyping !== 'boolean') {
    throw new Error('isTyping должен быть boolean');
  }
}
