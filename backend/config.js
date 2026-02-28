// Конфигурация приложения
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка переменных окружения (если используется .env файл)
// Для простоты используем process.env напрямую
// В продакшн можно добавить dotenv

export const config = {
  // Сервер
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // База данных
  database: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'database', 'portfolio.db')
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: '7d'
  },
  
  // Bcrypt
  bcrypt: {
    saltRounds: 10
  },
  
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || ''
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 минута
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // Файлы
  uploads: {
    maxFileSize: 5 * 1024 * 1024, // 5 МБ
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    uploadDir: path.join(__dirname, '..', 'frontend', 'images', 'uploads')
  },
  
  // Валидация
  validation: {
    password: {
      minLength: 8,
      maxLength: 100
    },
    name: {
      minLength: 2,
      maxLength: 100
    },
    message: {
      minLength: 1,
      maxLength: 5000
    },
    portfolioTitle: {
      minLength: 3,
      maxLength: 200
    },
    portfolioDescription: {
      maxLength: 500
    },
    portfolioContent: {
      maxLength: 50000
    }
  }
};

export default config;
