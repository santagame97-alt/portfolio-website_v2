// Тесты для PortfolioService
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import PortfolioService from './PortfolioService.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PortfolioService', () => {
  let service;
  let testDbPath;

  beforeEach(() => {
    // Создаем временную тестовую БД
    testDbPath = path.join(__dirname, '..', '..', 'database', 'test-portfolio.db');
    
    // Удаляем если существует
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Создаем схему
    const db = new Database(testDbPath);
    const schema = fs.readFileSync(
      path.join(__dirname, '..', '..', 'database', 'schema.sql'),
      'utf-8'
    );
    db.exec(schema);
    db.close();

    // Переопределяем путь к БД для тестов
    process.env.DB_PATH = testDbPath;
    
    // Создаем сервис
    service = new PortfolioService();
  });

  afterEach(() => {
    service.close();
    
    // Удаляем тестовую БД
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('getAllItems', () => {
    it('должен вернуть пустой массив если нет работ', async () => {
      const result = await service.getAllItems();
      
      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.items, []);
    });

    it('должен вернуть все работы портфолио', async () => {
      await service.createItem({
        title: 'Работа 1',
        description: 'Описание 1',
        content: 'Контент 1',
        order: 1
      });
      
      await service.createItem({
        title: 'Работа 2',
        description: 'Описание 2',
        content: 'Контент 2',
        order: 2
      });

      const result = await service.getAllItems();
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.items[0].title, 'Работа 1');
      assert.strictEqual(result.items[1].title, 'Работа 2');
    });
  });

  describe('getItemById', () => {
    it('должен вернуть ошибку если работа не найдена', async () => {
      const result = await service.getItemById(999);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_FOUND');
    });

    it('должен вернуть работу по ID', async () => {
      const createResult = await service.createItem({
        title: 'Тестовая работа',
        description: 'Тестовое описание',
        content: 'Тестовый контент'
      });

      const itemId = createResult.item.id;
      const result = await service.getItemById(itemId);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.item.title, 'Тестовая работа');
      assert.strictEqual(result.item.description, 'Тестовое описание');
      assert.strictEqual(result.item.content, 'Тестовый контент');
    });
  });

  describe('createItem', () => {
    it('должен создать работу с валидными данными', async () => {
      const result = await service.createItem({
        title: 'Новая работа',
        description: 'Новое описание',
        content: 'Новый контент',
        order: 5
      });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.item.title, 'Новая работа');
      assert.strictEqual(result.item.description, 'Новое описание');
      assert.strictEqual(result.item.content, 'Новый контент');
      assert.strictEqual(result.item.order, 5);
      assert.ok(result.item.id);
    });

    it('должен отклонить создание с коротким названием', async () => {
      const result = await service.createItem({
        title: 'AB',
        description: 'Описание',
        content: 'Контент'
      });
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'CREATE_ITEM_ERROR');
    });
  });

  describe('updateItem', () => {
    it('должен обновить работу', async () => {
      const createResult = await service.createItem({
        title: 'Старое название',
        description: 'Старое описание',
        content: 'Старый контент'
      });

      const itemId = createResult.item.id;
      
      const updateResult = await service.updateItem(itemId, {
        title: 'Новое название',
        description: 'Новое описание'
      });
      
      assert.strictEqual(updateResult.success, true);
      assert.strictEqual(updateResult.item.title, 'Новое название');
      assert.strictEqual(updateResult.item.description, 'Новое описание');
      assert.strictEqual(updateResult.item.content, 'Старый контент');
    });

    it('должен вернуть ошибку если работа не найдена', async () => {
      const result = await service.updateItem(999, {
        title: 'Новое название'
      });
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_FOUND');
    });
  });

  describe('deleteItem', () => {
    it('должен удалить работу', async () => {
      const createResult = await service.createItem({
        title: 'Работа для удаления',
        description: 'Описание',
        content: 'Контент'
      });

      const itemId = createResult.item.id;
      
      const deleteResult = await service.deleteItem(itemId);
      assert.strictEqual(deleteResult.success, true);
      
      const getResult = await service.getItemById(itemId);
      assert.strictEqual(getResult.success, false);
      assert.strictEqual(getResult.error, 'NOT_FOUND');
    });

    it('должен вернуть ошибку если работа не найдена', async () => {
      const result = await service.deleteItem(999);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_FOUND');
    });
  });

  describe('uploadImage', () => {
    it('должен загрузить изображение для существующей работы', async () => {
      const createResult = await service.createItem({
        title: 'Работа',
        description: 'Описание',
        content: 'Контент'
      });

      const itemId = createResult.item.id;
      
      const mockFile = {
        buffer: Buffer.from('fake image data'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg'
      };

      const result = await service.uploadImage(itemId, mockFile, 'Test alt text', 0);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.image.portfolioItemId, itemId);
      assert.strictEqual(result.image.altText, 'Test alt text');
      assert.ok(result.image.filePath.includes('portfolio_'));
      assert.ok(result.image.filePath.includes('.jpg'));
    });

    it('должен вернуть ошибку если работа не найдена', async () => {
      const mockFile = {
        buffer: Buffer.from('fake image data'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg'
      };

      const result = await service.uploadImage(999, mockFile);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_FOUND');
    });

    it('должен отклонить файл с недопустимым типом', async () => {
      const createResult = await service.createItem({
        title: 'Работа',
        description: 'Описание',
        content: 'Контент'
      });

      const itemId = createResult.item.id;
      
      const mockFile = {
        buffer: Buffer.from('fake file data'),
        mimetype: 'application/pdf',
        originalname: 'test.pdf'
      };

      const result = await service.uploadImage(itemId, mockFile);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'UPLOAD_IMAGE_ERROR');
    });
  });

  describe('deleteImage', () => {
    it('должен удалить изображение', async () => {
      const createResult = await service.createItem({
        title: 'Работа',
        description: 'Описание',
        content: 'Контент'
      });

      const itemId = createResult.item.id;

      const imageResult = service.db.prepare(`
        INSERT INTO portfolio_images (portfolio_item_id, file_path, alt_text, order_num)
        VALUES (?, ?, ?, ?)
      `).run(itemId, 'test_delete.jpg', 'Test', 0);

      const imageId = imageResult.lastInsertRowid;
      
      const deleteResult = await service.deleteImage(imageId);
      assert.strictEqual(deleteResult.success, true);
      
      const image = service.db.prepare('SELECT id FROM portfolio_images WHERE id = ?').get(imageId);
      assert.strictEqual(image, undefined);
    });

    it('должен вернуть ошибку если изображение не найдено', async () => {
      const result = await service.deleteImage(999);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_FOUND');
    });
  });

  describe('validation', () => {
    it('validateTitle должен принимать валидное название', () => {
      assert.doesNotThrow(() => service.validateTitle('Валидное название'));
    });

    it('validateTitle должен отклонять короткое название', () => {
      assert.throws(() => service.validateTitle('AB'));
    });

    it('validateDescription должен принимать валидное описание', () => {
      assert.doesNotThrow(() => service.validateDescription('Валидное описание'));
    });

    it('validateDescription должен отклонять пустое описание', () => {
      assert.throws(() => service.validateDescription(''));
    });

    it('validateContent должен принимать валидный контент', () => {
      assert.doesNotThrow(() => service.validateContent('Валидный контент'));
    });

    it('validateContent должен отклонять пустой контент', () => {
      assert.throws(() => service.validateContent(''));
    });
  });
});
