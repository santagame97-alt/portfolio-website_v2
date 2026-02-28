import AuthService from '../services/AuthService.js';
import TelegramService from '../services/TelegramService.js';

const authService = new AuthService();
const telegramService = new TelegramService();

/**
 * Обработка регистрации пользователя
 */
export async function handleRegister(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { name, email, password } = body;

    // Валидация входных данных
    const validationErrors = {};

    if (!name || name.trim().length < 2) {
      validationErrors.name = ['Имя должно содержать минимум 2 символа'];
    } else if (name.length > 100) {
      validationErrors.name = ['Имя слишком длинное (максимум 100 символов)'];
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      validationErrors.email = ['Введите корректный email'];
    }

    if (!password || password.length < 8) {
      validationErrors.password = ['Пароль должен содержать минимум 8 символов'];
    } else if (password.length > 100) {
      validationErrors.password = ['Пароль слишком длинный (максимум 100 символов)'];
    }

    if (Object.keys(validationErrors).length > 0) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: 'Ошибка валидации данных',
        fields: validationErrors
      }));
      return;
    }

    // Регистрация пользователя
    const result = await authService.register(email, password, name.trim());

    if (result.success) {
      // Отправка уведомления в Telegram
      telegramService.notifyNewUser({
        name: result.user.name,
        email: result.user.email
      }).catch(err => console.error('Ошибка отправки Telegram уведомления:', err));

      res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        message: 'Регистрация успешна',
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          isAdmin: result.user.isAdmin
        }
      }));
    } else {
      // Обработка ошибок от сервиса
      const statusCode = result.error === 'EMAIL_EXISTS' ? 409 : 400;
      res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: result.error || 'REGISTRATION_ERROR',
        message: result.message || 'Ошибка регистрации',
        fields: result.error === 'EMAIL_EXISTS' ? { email: ['Email уже используется'] } : {}
      }));
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  }
}

/**
 * Обработка входа пользователя
 */
export async function handleLogin(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { email, password } = body;

    // Валидация входных данных
    const validationErrors = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      validationErrors.email = ['Введите корректный email'];
    }

    if (!password) {
      validationErrors.password = ['Пароль обязателен'];
    }

    if (Object.keys(validationErrors).length > 0) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: 'Ошибка валидации данных',
        fields: validationErrors
      }));
      return;
    }

    // Вход пользователя
    const result = await authService.login(email, password);

    if (result.success) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        message: 'Вход выполнен успешно',
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          isAdmin: result.user.isAdmin,
          isBanned: result.user.isBanned
        }
      }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'AUTH_ERROR',
        message: 'Неверный email или пароль',
        reason: 'INVALID_CREDENTIALS'
      }));
    }
  } catch (error) {
    console.error('Login error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  }
}

/**
 * Обработка выхода пользователя
 */
export async function handleLogout(req, res) {
  try {
    const token = extractToken(req);

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'AUTH_ERROR',
        message: 'Токен не предоставлен'
      }));
      return;
    }

    await authService.logout(token);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      message: 'Выход выполнен успешно'
    }));
  } catch (error) {
    console.error('Logout error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  }
}

/**
 * Проверка валидности сессии
 */
export async function handleValidateSession(req, res) {
  try {
    const token = extractToken(req);

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'AUTH_ERROR',
        message: 'Токен не предоставлен',
        valid: false
      }));
      return;
    }

    const user = await authService.validateSession(token);

    if (user) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          isBanned: user.isBanned
        }
      }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'AUTH_ERROR',
        message: 'Недействительный или истекший токен',
        valid: false
      }));
    }
  } catch (error) {
    console.error('Validate session error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера',
      valid: false
    }));
  }
}

/**
 * Вспомогательная функция для парсинга тела запроса
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON'));
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
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}
