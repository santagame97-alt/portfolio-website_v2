// Маршруты для портфолио
import PortfolioService from '../services/PortfolioService.js';

const portfolioService = new PortfolioService();

/**
 * Получение всех работ портфолио
 */
export async function handleGetAllItems(req, res) {
  try {
    const result = await portfolioService.getAllItems();
    
    if (result.success) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result.items));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: result.error,
        message: result.message
      }));
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  }
}

/**
 * Получение одной работы по ID
 */
export async function handleGetItemById(req, res, id) {
  try {
    const result = await portfolioService.getItemById(id);
    
    if (result.success) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result.item));
    } else if (result.error === 'NOT_FOUND') {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'NOT_FOUND',
        message: result.message
      }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: result.error,
        message: result.message
      }));
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  }
}

/**
 * Создание новой работы портфолио (только для админа)
 */
export async function handleCreateItem(req, res) {
  try {
    // Проверка прав администратора
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

    // Чтение тела запроса
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const result = await portfolioService.createItem(data);
        
        if (result.success) {
          res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result.item));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            code: result.error,
            message: result.message
          }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          code: 'INVALID_JSON',
          message: 'Неверный формат данных'
        }));
      }
    });
  } catch (error) {
    console.error('Ошибка создания работы:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  }
}

/**
 * Удаление работы портфолио (только для админа)
 */
export async function handleDeleteItem(req, res, id) {
  try {
    // Проверка прав администратора
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

    const result = await portfolioService.deleteItem(id);
    
    if (result.success) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'Работа удалена' }));
    } else if (result.error === 'NOT_FOUND') {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'NOT_FOUND',
        message: result.message
      }));
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: result.error,
        message: result.message
      }));
    }
  } catch (error) {
    console.error('Ошибка удаления работы:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  }
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
 * Валидация токена и проверка прав администратора
 */
async function validateAdminToken(token) {
  if (!token) return null;
  
  try {
    const jwt = await import('jsonwebtoken');
    const Database = (await import('better-sqlite3')).default;
    const { config } = await import('../config.js');
    
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
 * Загрузка изображения для работы портфолио (только для админа)
 */
export async function handleUploadImage(req, res, itemId) {
  try {
    // Проверка прав администратора
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

    // Парсинг multipart/form-data
    const boundary = req.headers['content-type'].split('boundary=')[1];
    if (!boundary) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 'INVALID_REQUEST',
        message: 'Неверный формат запроса'
      }));
      return;
    }

    let body = Buffer.alloc(0);
    req.on('data', chunk => {
      body = Buffer.concat([body, chunk]);
    });

    req.on('end', async () => {
      try {
        const parts = parseMultipart(body, boundary);
        const imagePart = parts.find(p => p.name === 'image');
        const orderPart = parts.find(p => p.name === 'order');

        if (!imagePart) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            code: 'MISSING_IMAGE',
            message: 'Изображение не найдено'
          }));
          return;
        }

        const file = {
          buffer: imagePart.data,
          mimetype: imagePart.contentType,
          originalname: imagePart.filename
        };

        const order = orderPart ? parseInt(orderPart.data.toString()) : 0;

        const result = await portfolioService.uploadImage(itemId, file, '', order);
        
        if (result.success) {
          res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result.image));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            code: result.error,
            message: result.message
          }));
        }
      } catch (error) {
        console.error('Ошибка обработки изображения:', error);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          code: 'INTERNAL_ERROR',
          message: 'Внутренняя ошибка сервера'
        }));
      }
    });
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }));
  }
}

/**
 * Парсинг multipart/form-data
 */
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let start = 0;

  while (true) {
    const boundaryIndex = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIndex === -1) break;

    const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
    if (nextBoundaryIndex === -1) break;

    const partBuffer = buffer.slice(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex);
    
    // Разделяем заголовки и данные
    const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEndIndex === -1) {
      start = nextBoundaryIndex;
      continue;
    }

    const headersBuffer = partBuffer.slice(0, headerEndIndex);
    const dataBuffer = partBuffer.slice(headerEndIndex + 4, partBuffer.length - 2); // -2 для \r\n

    const headers = headersBuffer.toString();
    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type: (.+)/);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch ? filenameMatch[1] : null,
        contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'text/plain',
        data: dataBuffer
      });
    }

    start = nextBoundaryIndex;
  }

  return parts;
}
