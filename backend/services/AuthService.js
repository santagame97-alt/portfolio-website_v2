// Сервис аутентификации
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { config } from '../config.js';

class AuthService {
  constructor() {
    this.db = new Database(config.database.path);
    this.jwtSecret = config.jwt.secret;
    this.jwtExpiresIn = config.jwt.expiresIn;
    this.saltRounds = config.bcrypt.saltRounds;
  }

  /**
   * Регистрация нового пользователя
   * @param {string} email - Email пользователя
   * @param {string} password - Пароль пользователя
   * @param {string} name - Имя пользователя
   * @returns {Promise<Object>} Результат регистрации
   */
  async register(email, password, name) {
    try {
      // Валидация входных данных
      this.validateEmail(email);
      this.validatePassword(password);
      this.validateName(name);

      // Проверка существования пользователя
      const existingUser = this.db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return {
          success: false,
          error: 'EMAIL_EXISTS',
          message: 'Email уже зарегистрирован'
        };
      }

      // Хеширование пароля
      const passwordHash = await this.hashPassword(password);

      // Создание пользователя
      const stmt = this.db.prepare(`
        INSERT INTO users (email, password_hash, name, is_admin, is_banned)
        VALUES (?, ?, ?, 0, 0)
      `);
      
      const result = stmt.run(email, passwordHash, name);
      const userId = result.lastInsertRowid;

      // Получение созданного пользователя
      const user = this.db.prepare(`
        SELECT id, email, name, is_admin, is_banned, created_at
        FROM users WHERE id = ?
      `).get(userId);

      const formattedUser = this.formatUser(user);
      const token = this.generateToken(user.id);

      return {
        success: true,
        user: formattedUser,
        token
      };
    } catch (error) {
      return {
        success: false,
        error: 'REGISTRATION_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Вход в систему
   * @param {string} email - Email пользователя
   * @param {string} password - Пароль пользователя
   * @returns {Promise<Object>} Результат входа
   */
  async login(email, password) {
    try {
      // Получение пользователя по email
      const user = this.db.prepare(`
        SELECT id, email, password_hash, name, is_admin, is_banned, created_at
        FROM users WHERE email = ?
      `).get(email);

      if (!user) {
        return {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль'
        };
      }

      // Проверка пароля
      const isPasswordValid = await this.verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль'
        };
      }

      // Создание JWT токена
      const token = this.generateToken(user.id);
      
      // Вычисление времени истечения
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 дней

      return {
        success: true,
        token,
        userId: user.id,
        expiresAt: expiresAt.toISOString(),
        user: this.formatUser(user)
      };
    } catch (error) {
      return {
        success: false,
        error: 'LOGIN_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Выход из системы
   * @param {string} sessionToken - JWT токен сессии
   * @returns {Promise<void>}
   * @note В текущей реализации JWT токены stateless, поэтому logout просто валидирует токен
   * Для полноценного logout можно добавить blacklist токенов в БД или Redis
   */
  async logout(sessionToken) {
    // Валидация токена
    try {
      jwt.verify(sessionToken, this.jwtSecret);
    } catch (error) {
      throw new Error('Невалидный токен сессии');
    }
    
    // В текущей реализации просто возвращаем успех
    // Клиент должен удалить токен на своей стороне
    return;
  }

  /**
   * Проверка валидности сессии
   * @param {string} sessionToken - JWT токен сессии
   * @returns {Promise<Object|null>} Объект пользователя или null если токен невалиден
   */
  async validateSession(sessionToken) {
    try {
      // Верификация токена
      const decoded = jwt.verify(sessionToken, this.jwtSecret);
      
      // Получение пользователя из БД
      const user = this.db.prepare(`
        SELECT id, email, name, is_admin, is_banned, created_at
        FROM users WHERE id = ?
      `).get(decoded.userId);

      if (!user) {
        return null;
      }

      return this.formatUser(user);
    } catch (error) {
      return null;
    }
  }

  /**
   * Хеширование пароля
   * @param {string} password - Пароль в открытом виде
   * @returns {Promise<string>} Хеш пароля
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Проверка пароля
   * @param {string} password - Пароль в открытом виде
   * @param {string} hash - Хеш пароля
   * @returns {Promise<boolean>} true если пароль совпадает
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Генерация JWT токена
   * @param {number} userId - ID пользователя
   * @returns {string} JWT токен
   */
  generateToken(userId) {
    return jwt.sign(
      { userId },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );
  }

  /**
   * Валидация email
   * @param {string} email - Email для валидации
   * @throws {Error} Если email невалиден
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Email обязателен');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Некорректный формат email');
    }
  }

  /**
   * Валидация пароля
   * @param {string} password - Пароль для валидации
   * @throws {Error} Если пароль невалиден
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Пароль обязателен');
    }
    
    const minLength = config.validation.password.minLength;
    const maxLength = config.validation.password.maxLength;
    
    if (password.length < minLength) {
      throw new Error(`Пароль должен содержать минимум ${minLength} символов`);
    }
    
    if (password.length > maxLength) {
      throw new Error(`Пароль должен содержать максимум ${maxLength} символов`);
    }
  }

  /**
   * Валидация имени
   * @param {string} name - Имя для валидации
   * @throws {Error} Если имя невалидно
   */
  validateName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Имя обязательно');
    }
    
    const minLength = config.validation.name.minLength;
    const maxLength = config.validation.name.maxLength;
    
    if (name.trim().length < minLength) {
      throw new Error(`Имя должно содержать минимум ${minLength} символа`);
    }
    
    if (name.length > maxLength) {
      throw new Error(`Имя должно содержать максимум ${maxLength} символов`);
    }
  }

  /**
   * Форматирование объекта пользователя
   * @param {Object} user - Пользователь из БД
   * @returns {Object} Отформатированный объект пользователя
   */
  formatUser(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: Boolean(user.is_admin),
      isBanned: Boolean(user.is_banned),
      createdAt: user.created_at
    };
  }

  /**
   * Закрытие соединения с БД
   */
  close() {
    this.db.close();
  }
}

export default AuthService;
