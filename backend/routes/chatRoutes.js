// Маршруты для чата
import MessageService from '../services/MessageService.js';
import AuthService from '../services/AuthService.js';
import TelegramService from '../services/TelegramService.js';

const telegramService = new TelegramService();

/**
 * Получение тела запроса
 */
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Невалидный JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Извлечение токена из заголовка Authorization
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Валидация токена и получение пользователя
 */
async function validateToken(token) {
  if (!token) {
    return null;
  }
  
  const authService = new AuthService();
  try {
    const user = await authService.validateSession(token);
    return user;
  } catch (error) {
    return null;
  } finally {
    authService.close();
  }
}

/**
 * Middleware для проверки аутентификации
 */
async function requireAuth(req, res) {
  const token = extractToken(req);
  const user = await validateToken(token);
  
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'AUTH_ERROR',
      message: 'Требуется аутентификация',
      reason: 'INVALID_TOKEN'
    }));
    return null;
  }
  
  if (user.is_banned) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'FORBIDDEN',
      message: 'Ваш доступ к чату заблокирован',
      reason: 'USER_BANNED'
    }));
    return null;
  }
  
  return user;
}

/**
 * GET /api/chats/my - Получение или создание чата текущего пользователя
 */
export async function handleGetMyChat(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const messageService = new MessageService();
  
  try {
    const chat = await messageService.getOrCreateChat(user.id);
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(chat));
  } catch (error) {
    console.error('Ошибка при получении чата:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: error.message
    }));
  } finally {
    messageService.close();
  }
}

/**
 * GET /api/chats - Получение всех чатов (только для админа)
 */
export async function handleGetAllChats(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (!user.is_admin) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав',
      reason: 'INSUFFICIENT_PERMISSIONS'
    }));
    return;
  }

  const messageService = new MessageService();
  
  try {
    const chats = await messageService.getAllChats();
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(chats));
  } catch (error) {
    console.error('Ошибка при получении списка чатов:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: error.message
    }));
  } finally {
    messageService.close();
  }
}

/**
 * GET /api/chats/:chatId/messages - Получение сообщений чата
 */
export async function handleGetChatMessages(req, res, chatId) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const messageService = new MessageService();
  
  try {
    // Проверка доступа к чату
    const chat = await messageService.getOrCreateChat(user.id);
    
    if (chat.id !== chatId && !user.is_admin) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для доступа к этому чату',
        reason: 'INSUFFICIENT_PERMISSIONS'
      }));
      return;
    }

    const messages = await messageService.getChatMessages(chatId);
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(messages));
  } catch (error) {
    console.error('Ошибка при получении сообщений:', error);
    
    if (error.message === 'Чат не найден') {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'NOT_FOUND',
        message: error.message,
        resource: 'chat'
      }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'INTERNAL_ERROR',
        message: error.message
      }));
    }
  } finally {
    messageService.close();
  }
}

/**
 * POST /api/chats/:chatId/messages - Отправка сообщения
 */
export async function handleSendMessage(req, res, chatId) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const messageService = new MessageService();
  
  try {
    const body = await getRequestBody(req);
    const { content } = body;

    if (!content) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: 'Текст сообщения обязателен',
        fields: { content: ['Поле обязательно для заполнения'] }
      }));
      return;
    }

    // Проверка доступа к чату
    const chat = await messageService.getOrCreateChat(user.id);
    
    if (chat.id !== chatId && !user.is_admin) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'FORBIDDEN',
        message: 'Недостаточно прав для отправки сообщения в этот чат',
        reason: 'INSUFFICIENT_PERMISSIONS'
      }));
      return;
    }

    const message = await messageService.sendMessage(chatId, user.id, content);
    
    // Отправка уведомления в Telegram если сообщение от обычного пользователя
    if (!user.is_admin) {
      telegramService.notifyNewMessage(
        { content },
        { name: user.name, email: user.email }
      ).catch(err => console.error('Ошибка отправки Telegram уведомления:', err));
    }
    
    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(message));
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error);
    
    if (error.message === 'USER_BANNED') {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'FORBIDDEN',
        message: 'Ваш доступ к чату заблокирован',
        reason: 'USER_BANNED'
      }));
    } else if (error.message.includes('не может быть пустым') || error.message.includes('минимум') || error.message.includes('максимум')) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: error.message,
        fields: { content: [error.message] }
      }));
    } else if (error.message === 'Чат не найден') {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'NOT_FOUND',
        message: error.message,
        resource: 'chat'
      }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'INTERNAL_ERROR',
        message: error.message
      }));
    }
  } finally {
    messageService.close();
  }
}

/**
 * POST /api/chats/:chatId/read - Пометка сообщений как прочитанных (только для админа)
 */
export async function handleMarkMessagesAsRead(req, res, chatId) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (!user.is_admin) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав',
      reason: 'INSUFFICIENT_PERMISSIONS'
    }));
    return;
  }

  const messageService = new MessageService();
  
  try {
    await messageService.markMessagesAsRead(chatId, user.id);
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error('Ошибка при пометке сообщений как прочитанных:', error);
    
    if (error.message === 'Чат не найден') {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'NOT_FOUND',
        message: error.message,
        resource: 'chat'
      }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'INTERNAL_ERROR',
        message: error.message
      }));
    }
  } finally {
    messageService.close();
  }
}
