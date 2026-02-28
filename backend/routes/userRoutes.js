// Маршруты для управления пользователями
import Database from 'better-sqlite3';
import { config } from '../config.js';

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
 * Валидация токена и проверка прав администратора
 */
async function validateAdminToken(token) {
  if (!token) return null;
  
  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, config.jwt.secret);
    
    const db = new Database(config.database.path);
    const user = db.prepare('SELECT id, email, name, is_admin, is_banned FROM users WHERE id = ?').get(decoded.userId);
    db.close();
    
    if (!user || !user.is_admin) return null;
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: Boolean(user.is_admin),
      isBanned: Boolean(user.is_banned)
    };
  } catch (error) {
    return null;
  }
}

/**
 * GET /api/users - Получение всех пользователей (только для админа)
 */
export async function handleGetAllUsers(req, res) {
  const token = extractToken(req);
  const admin = await validateAdminToken(token);
  
  if (!admin) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав'
    }));
    return;
  }

  const db = new Database(config.database.path);
  
  try {
    const users = db.prepare(`
      SELECT id, email, name, is_admin, is_banned, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: Boolean(user.is_admin),
      isBanned: Boolean(user.is_banned),
      createdAt: user.created_at
    }));

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(formattedUsers));
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  } finally {
    db.close();
  }
}

/**
 * POST /api/users/:userId/ban - Забанить пользователя (только для админа)
 */
export async function handleBanUser(req, res, userId) {
  const token = extractToken(req);
  const admin = await validateAdminToken(token);
  
  if (!admin) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав'
    }));
    return;
  }

  const db = new Database(config.database.path);
  
  try {
    // Проверяем, что пользователь существует
    const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'NOT_FOUND',
        message: 'Пользователь не найден'
      }));
      return;
    }

    // Нельзя забанить администратора
    if (user.is_admin) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: 'Нельзя забанить администратора'
      }));
      return;
    }

    // Баним пользователя
    db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(userId);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, message: 'Пользователь забанен' }));
  } catch (error) {
    console.error('Ошибка бана пользователя:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  } finally {
    db.close();
  }
}

/**
 * POST /api/users/:userId/unban - Разбанить пользователя (только для админа)
 */
export async function handleUnbanUser(req, res, userId) {
  const token = extractToken(req);
  const admin = await validateAdminToken(token);
  
  if (!admin) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав'
    }));
    return;
  }

  const db = new Database(config.database.path);
  
  try {
    // Проверяем, что пользователь существует
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'NOT_FOUND',
        message: 'Пользователь не найден'
      }));
      return;
    }

    // Разбаниваем пользователя
    db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(userId);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, message: 'Пользователь разбанен' }));
  } catch (error) {
    console.error('Ошибка разбана пользователя:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  } finally {
    db.close();
  }
}
