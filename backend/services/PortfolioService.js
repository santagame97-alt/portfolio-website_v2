// Сервис управления портфолио
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PortfolioService {
  constructor() {
    this.db = new Database(config.database.path);
  }

  /**
   * Получение всех работ портфолио (публичный доступ)
   * @returns {Promise<Array>} Массив работ портфолио
   */
  async getAllItems() {
    try {
      const items = this.db.prepare(`
        SELECT id, title, description, content, order_num, created_at, updated_at
        FROM portfolio_items
        ORDER BY order_num ASC, created_at DESC
      `).all();

      // Получаем изображения для каждой работы
      const itemsWithImages = items.map(item => {
        const images = this.db.prepare(`
          SELECT id, portfolio_item_id, file_path, alt_text, order_num
          FROM portfolio_images
          WHERE portfolio_item_id = ?
          ORDER BY order_num ASC
        `).all(item.id);

        return this.formatPortfolioItem(item, images);
      });

      return {
        success: true,
        items: itemsWithImages
      };
    } catch (error) {
      return {
        success: false,
        error: 'GET_ITEMS_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Получение одной работы по ID
   * @param {number} id - ID работы
   * @returns {Promise<Object>} Работа портфолио или null
   */
  async getItemById(id) {
    try {
      const item = this.db.prepare(`
        SELECT id, title, description, content, order_num, created_at, updated_at
        FROM portfolio_items
        WHERE id = ?
      `).get(id);

      if (!item) {
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'Работа не найдена'
        };
      }

      // Получаем изображения для работы
      const images = this.db.prepare(`
        SELECT id, portfolio_item_id, file_path, alt_text, order_num
        FROM portfolio_images
        WHERE portfolio_item_id = ?
        ORDER BY order_num ASC
      `).all(id);

      return {
        success: true,
        item: this.formatPortfolioItem(item, images)
      };
    } catch (error) {
      return {
        success: false,
        error: 'GET_ITEM_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Создание новой работы портфолио (только для админа)
   * @param {Object} data - Данные работы
   * @param {string} data.title - Название работы
   * @param {string} data.description - Краткое описание
   * @param {string} data.content - Полное описание
   * @param {number} [data.order] - Порядок отображения
   * @returns {Promise<Object>} Созданная работа
   */
  async createItem(data) {
    try {
      // Валидация данных
      this.validateTitle(data.title);
      this.validateDescription(data.description);
      this.validateContent(data.content);

      const order = data.order !== undefined ? data.order : 0;

      // Создание работы
      const stmt = this.db.prepare(`
        INSERT INTO portfolio_items (title, description, content, order_num)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(data.title, data.description, data.content, order);
      const itemId = result.lastInsertRowid;

      // Получение созданной работы
      const item = this.db.prepare(`
        SELECT id, title, description, content, order_num, created_at, updated_at
        FROM portfolio_items
        WHERE id = ?
      `).get(itemId);

      return {
        success: true,
        item: this.formatPortfolioItem(item, [])
      };
    } catch (error) {
      return {
        success: false,
        error: 'CREATE_ITEM_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Обновление работы портфолио (только для админа)
   * @param {number} id - ID работы
   * @param {Object} data - Данные для обновления
   * @param {string} [data.title] - Название работы
   * @param {string} [data.description] - Краткое описание
   * @param {string} [data.content] - Полное описание
   * @param {number} [data.order] - Порядок отображения
   * @returns {Promise<Object>} Обновленная работа
   */
  async updateItem(id, data) {
    try {
      // Проверка существования работы
      const existingItem = this.db.prepare('SELECT id FROM portfolio_items WHERE id = ?').get(id);
      if (!existingItem) {
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'Работа не найдена'
        };
      }

      // Валидация данных
      if (data.title !== undefined) {
        this.validateTitle(data.title);
      }
      if (data.description !== undefined) {
        this.validateDescription(data.description);
      }
      if (data.content !== undefined) {
        this.validateContent(data.content);
      }

      // Построение запроса обновления
      const updates = [];
      const values = [];

      if (data.title !== undefined) {
        updates.push('title = ?');
        values.push(data.title);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      if (data.content !== undefined) {
        updates.push('content = ?');
        values.push(data.content);
      }
      if (data.order !== undefined) {
        updates.push('order_num = ?');
        values.push(data.order);
      }

      // Всегда обновляем updated_at
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      if (updates.length === 1) {
        // Только updated_at, ничего не меняем
        return this.getItemById(id);
      }

      const stmt = this.db.prepare(`
        UPDATE portfolio_items
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...values);

      // Получение обновленной работы
      return this.getItemById(id);
    } catch (error) {
      return {
        success: false,
        error: 'UPDATE_ITEM_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Удаление работы портфолио (только для админа)
   * @param {number} id - ID работы
   * @returns {Promise<Object>} Результат удаления
   */
  async deleteItem(id) {
    try {
      // Проверка существования работы
      const existingItem = this.db.prepare('SELECT id FROM portfolio_items WHERE id = ?').get(id);
      if (!existingItem) {
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'Работа не найдена'
        };
      }

      // Получаем все изображения для удаления файлов
      const images = this.db.prepare(`
        SELECT file_path FROM portfolio_images WHERE portfolio_item_id = ?
      `).all(id);

      // Удаление работы (изображения удалятся автоматически через CASCADE)
      const stmt = this.db.prepare('DELETE FROM portfolio_items WHERE id = ?');
      stmt.run(id);

      // Удаление файлов изображений
      images.forEach(image => {
        try {
          const fullPath = path.join(config.uploads.uploadDir, image.file_path);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          console.error(`Ошибка удаления файла ${image.file_path}:`, err);
        }
      });

      return {
        success: true,
        message: 'Работа успешно удалена'
      };
    } catch (error) {
      return {
        success: false,
        error: 'DELETE_ITEM_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Загрузка изображения для работы
   * @param {number} itemId - ID работы
   * @param {Object} file - Объект файла
   * @param {Buffer} file.buffer - Буфер с данными файла
   * @param {string} file.mimetype - MIME тип файла
   * @param {string} file.originalname - Оригинальное имя файла
   * @param {string} [altText] - Альтернативный текст
   * @param {number} [order] - Порядок отображения
   * @returns {Promise<Object>} Созданное изображение
   */
  async uploadImage(itemId, file, altText = '', order = 0) {
    try {
      // Проверка существования работы
      const existingItem = this.db.prepare('SELECT id FROM portfolio_items WHERE id = ?').get(itemId);
      if (!existingItem) {
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'Работа не найдена'
        };
      }

      // Валидация файла
      this.validateImageFile(file);

      // Создание директории для загрузок если не существует
      if (!fs.existsSync(config.uploads.uploadDir)) {
        fs.mkdirSync(config.uploads.uploadDir, { recursive: true });
      }

      // Генерация уникального имени файла
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `portfolio_${itemId}_${timestamp}${ext}`;
      const filePath = path.join(config.uploads.uploadDir, filename);

      // Сохранение файла
      fs.writeFileSync(filePath, file.buffer);

      // Сохранение записи в БД
      const stmt = this.db.prepare(`
        INSERT INTO portfolio_images (portfolio_item_id, file_path, alt_text, order_num)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(itemId, filename, altText, order);
      const imageId = result.lastInsertRowid;

      // Получение созданного изображения
      const image = this.db.prepare(`
        SELECT id, portfolio_item_id, file_path, alt_text, order_num
        FROM portfolio_images
        WHERE id = ?
      `).get(imageId);

      return {
        success: true,
        image: this.formatPortfolioImage(image)
      };
    } catch (error) {
      return {
        success: false,
        error: 'UPLOAD_IMAGE_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Удаление изображения
   * @param {number} imageId - ID изображения
   * @returns {Promise<Object>} Результат удаления
   */
  async deleteImage(imageId) {
    try {
      // Получение изображения
      const image = this.db.prepare(`
        SELECT id, file_path FROM portfolio_images WHERE id = ?
      `).get(imageId);

      if (!image) {
        return {
          success: false,
          error: 'NOT_FOUND',
          message: 'Изображение не найдено'
        };
      }

      // Удаление записи из БД
      const stmt = this.db.prepare('DELETE FROM portfolio_images WHERE id = ?');
      stmt.run(imageId);

      // Удаление файла
      try {
        const fullPath = path.join(config.uploads.uploadDir, image.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {
        console.error(`Ошибка удаления файла ${image.file_path}:`, err);
      }

      return {
        success: true,
        message: 'Изображение успешно удалено'
      };
    } catch (error) {
      return {
        success: false,
        error: 'DELETE_IMAGE_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Валидация названия работы
   * @param {string} title - Название для валидации
   * @throws {Error} Если название невалидно
   */
  validateTitle(title) {
    if (!title || typeof title !== 'string') {
      throw new Error('Название обязательно');
    }

    const minLength = config.validation.portfolioTitle.minLength;
    const maxLength = config.validation.portfolioTitle.maxLength;

    if (title.trim().length < minLength) {
      throw new Error(`Название должно содержать минимум ${minLength} символа`);
    }

    if (title.length > maxLength) {
      throw new Error(`Название должно содержать максимум ${maxLength} символов`);
    }
  }

  /**
   * Валидация описания работы
   * @param {string} description - Описание для валидации
   * @throws {Error} Если описание невалидно
   */
  validateDescription(description) {
    if (!description || typeof description !== 'string') {
      throw new Error('Описание обязательно');
    }

    const maxLength = config.validation.portfolioDescription.maxLength;

    if (description.length > maxLength) {
      throw new Error(`Описание должно содержать максимум ${maxLength} символов`);
    }
  }

  /**
   * Валидация контента работы
   * @param {string} content - Контент для валидации
   * @throws {Error} Если контент невалиден
   */
  validateContent(content) {
    if (!content || typeof content !== 'string') {
      throw new Error('Контент обязателен');
    }

    const maxLength = config.validation.portfolioContent.maxLength;

    if (content.length > maxLength) {
      throw new Error(`Контент должен содержать максимум ${maxLength} символов`);
    }
  }

  /**
   * Валидация файла изображения
   * @param {Object} file - Файл для валидации
   * @throws {Error} Если файл невалиден
   */
  validateImageFile(file) {
    if (!file || !file.buffer) {
      throw new Error('Файл обязателен');
    }

    // Проверка типа файла
    if (!config.uploads.allowedImageTypes.includes(file.mimetype)) {
      throw new Error(`Недопустимый тип файла. Разрешены: ${config.uploads.allowedImageTypes.join(', ')}`);
    }

    // Проверка размера файла
    if (file.buffer.length > config.uploads.maxFileSize) {
      const maxSizeMB = config.uploads.maxFileSize / (1024 * 1024);
      throw new Error(`Размер файла превышает максимально допустимый (${maxSizeMB} МБ)`);
    }
  }

  /**
   * Форматирование объекта работы портфолио
   * @param {Object} item - Работа из БД
   * @param {Array} images - Массив изображений
   * @returns {Object} Отформатированный объект работы
   */
  formatPortfolioItem(item, images) {
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      content: item.content,
      images: images.map(img => this.formatPortfolioImage(img)),
      order: item.order_num,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };
  }

  /**
   * Форматирование объекта изображения
   * @param {Object} image - Изображение из БД
   * @returns {Object} Отформатированный объект изображения
   */
  formatPortfolioImage(image) {
    return {
      id: image.id,
      portfolioItemId: image.portfolio_item_id,
      filePath: image.file_path,
      altText: image.alt_text || '',
      order: image.order_num
    };
  }

  /**
   * Закрытие соединения с БД
   */
  close() {
    this.db.close();
  }
}

export default PortfolioService;
