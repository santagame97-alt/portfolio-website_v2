// Загрузка переменных окружения ПЕРВЫМ делом
import './loadEnv.js';

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleRegister, handleLogin, handleLogout, handleValidateSession } from './routes/authRoutes.js';
import { handleGetAllItems, handleGetItemById, handleDeleteItem, handleCreateItem, handleUploadImage } from './routes/portfolioRoutes.js';
import { handleGetMyChat, handleGetAllChats, handleGetChatMessages, handleSendMessage, handleMarkMessagesAsRead } from './routes/chatRoutes.js';
import { handleGetAllUsers, handleBanUser, handleUnbanUser } from './routes/userRoutes.js';
import WebSocketServer from './services/WebSocketServer.js';
import { initDatabase } from '../database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Инициализация базы данных при запуске
const DB_PATH = path.join(__dirname, '..', 'database', 'portfolio.db');
try {
  if (!fs.existsSync(DB_PATH)) {
    console.log('База данных не найдена, инициализация...');
    initDatabase();
  } else {
    // Проверка что таблицы существуют
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(DB_PATH);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    db.close();
    
    if (!tables) {
      console.log('Таблицы не найдены, инициализация...');
      initDatabase();
    } else {
      console.log('✓ База данных найдена');
    }
  }
} catch (error) {
  console.error('Ошибка при проверке базы данных:', error);
  console.log('Попытка инициализации...');
  initDatabase();
}

// MIME types для статических файлов
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Создание HTTP сервера
const server = http.createServer(async (req, res) => {
  // Обработка API запросов
  if (req.url.startsWith('/api/')) {
    // CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Обработка preflight запросов
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Маршрутизация API
    if (req.url === '/api/auth/register' && req.method === 'POST') {
      await handleRegister(req, res);
      return;
    }

    if (req.url === '/api/auth/login' && req.method === 'POST') {
      await handleLogin(req, res);
      return;
    }

    if (req.url === '/api/auth/logout' && req.method === 'POST') {
      await handleLogout(req, res);
      return;
    }

    if (req.url === '/api/auth/validate' && req.method === 'GET') {
      await handleValidateSession(req, res);
      return;
    }

    // Portfolio API endpoints
    if (req.url === '/api/portfolio' && req.method === 'GET') {
      await handleGetAllItems(req, res);
      return;
    }

    if (req.url === '/api/portfolio' && req.method === 'POST') {
      await handleCreateItem(req, res);
      return;
    }

    // Portfolio item by ID (e.g., /api/portfolio/1)
    const portfolioItemMatch = req.url.match(/^\/api\/portfolio\/(\d+)$/);
    if (portfolioItemMatch && req.method === 'GET') {
      const itemId = parseInt(portfolioItemMatch[1], 10);
      await handleGetItemById(req, res, itemId);
      return;
    }

    if (portfolioItemMatch && req.method === 'DELETE') {
      const itemId = parseInt(portfolioItemMatch[1], 10);
      await handleDeleteItem(req, res, itemId);
      return;
    }

    // Upload image for portfolio item (e.g., /api/portfolio/1/images)
    const portfolioImageMatch = req.url.match(/^\/api\/portfolio\/(\d+)\/images$/);
    if (portfolioImageMatch && req.method === 'POST') {
      const itemId = parseInt(portfolioImageMatch[1], 10);
      await handleUploadImage(req, res, itemId);
      return;
    }

    // Chat API endpoints
    if (req.url === '/api/chats/my' && req.method === 'GET') {
      await handleGetMyChat(req, res);
      return;
    }

    if (req.url === '/api/chats' && req.method === 'GET') {
      await handleGetAllChats(req, res);
      return;
    }

    // Chat messages by chat ID (e.g., /api/chats/1/messages)
    const chatMessagesMatch = req.url.match(/^\/api\/chats\/(\d+)\/messages$/);
    if (chatMessagesMatch && req.method === 'GET') {
      const chatId = parseInt(chatMessagesMatch[1], 10);
      await handleGetChatMessages(req, res, chatId);
      return;
    }

    if (chatMessagesMatch && req.method === 'POST') {
      const chatId = parseInt(chatMessagesMatch[1], 10);
      await handleSendMessage(req, res, chatId);
      return;
    }

    // Mark messages as read (e.g., /api/chats/1/read)
    const chatReadMatch = req.url.match(/^\/api\/chats\/(\d+)\/read$/);
    if (chatReadMatch && req.method === 'POST') {
      const chatId = parseInt(chatReadMatch[1], 10);
      await handleMarkMessagesAsRead(req, res, chatId);
      return;
    }

    // User management API endpoints
    if (req.url === '/api/users' && req.method === 'GET') {
      await handleGetAllUsers(req, res);
      return;
    }

    // Ban user (e.g., /api/users/1/ban)
    const banUserMatch = req.url.match(/^\/api\/users\/(\d+)\/ban$/);
    if (banUserMatch && req.method === 'POST') {
      const userId = parseInt(banUserMatch[1], 10);
      await handleBanUser(req, res, userId);
      return;
    }

    // Unban user (e.g., /api/users/1/unban)
    const unbanUserMatch = req.url.match(/^\/api\/users\/(\d+)\/unban$/);
    if (unbanUserMatch && req.method === 'POST') {
      const userId = parseInt(unbanUserMatch[1], 10);
      await handleUnbanUser(req, res, userId);
      return;
    }

    // API endpoint не найден
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      code: 'NOT_FOUND',
      message: 'API endpoint не найден'
    }));
    return;
  }

  // Обработка статических файлов
  // Удаляем query параметры из URL для правильной обработки файлов
  const urlWithoutQuery = req.url.split('?')[0];
  let filePath = path.join(__dirname, '..', 'frontend', urlWithoutQuery === '/' ? 'index.html' : urlWithoutQuery);
  
  // Специальная обработка для uploads
  if (urlWithoutQuery.startsWith('/uploads/')) {
    filePath = path.join(__dirname, '..', 'frontend', 'images', urlWithoutQuery);
  }
  
  // Получение расширения файла
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Чтение и отправка файла
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Файл не найден
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 - Страница не найдена</h1>', 'utf-8');
      } else {
        // Серверная ошибка
        res.writeHead(500);
        res.end(`Ошибка сервера: ${error.code}`, 'utf-8');
      }
    } else {
      // Успешная отправка файла
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});

// Инициализация WebSocket сервера
const wsServer = new WebSocketServer(server);

// Экспорт wsServer для использования в других модулях (например, для уведомлений о бане)
export { wsServer };
