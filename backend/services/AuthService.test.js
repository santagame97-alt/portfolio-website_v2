// Unit тесты для AuthService
import { test } from 'node:test';
import assert from 'node:assert';
import AuthService from './AuthService.js';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

// Создаем тестовую БД
const testDbPath = path.join(process.cwd(), 'database', 'test-auth.db');

// Очистка тестовой БД перед тестами
function setupTestDb() {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  const db = new Database(testDbPath);
  
  // Создаем таблицу users
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.close();
}

// Очистка после тестов
function cleanupTestDb() {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

test('AuthService - register with valid data', async () => {
  setupTestDb();
  
  // Временно меняем путь к БД
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const result = await authService.register('test@example.com', 'password123', 'Test User');
  
  assert.strictEqual(result.success, true);
  assert.ok(result.user);
  assert.ok(result.token);
  assert.strictEqual(result.user.email, 'test@example.com');
  assert.strictEqual(result.user.name, 'Test User');
  assert.strictEqual(result.user.isAdmin, false);
  assert.strictEqual(result.user.isBanned, false);
  assert.ok(result.user.id);
  assert.ok(result.user.createdAt);
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - register with duplicate email returns error', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  await authService.register('test@example.com', 'password123', 'Test User');
  const result = await authService.register('test@example.com', 'password456', 'Another User');
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'EMAIL_EXISTS');
  assert.strictEqual(result.message, 'Email уже зарегистрирован');
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - register with invalid email returns error', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const result = await authService.register('invalid-email', 'password123', 'Test User');
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'REGISTRATION_ERROR');
  assert.ok(result.message.includes('Некорректный формат email'));
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - register with short password returns error', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const result = await authService.register('test@example.com', 'short', 'Test User');
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'REGISTRATION_ERROR');
  assert.ok(result.message.includes('Пароль должен содержать минимум 8 символов'));
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - login with correct credentials', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  await authService.register('test@example.com', 'password123', 'Test User');
  const result = await authService.login('test@example.com', 'password123');
  
  assert.strictEqual(result.success, true);
  assert.ok(result.token);
  assert.ok(result.userId);
  assert.ok(result.expiresAt);
  assert.ok(result.user);
  assert.strictEqual(result.user.email, 'test@example.com');
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - login with incorrect password returns error', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  await authService.register('test@example.com', 'password123', 'Test User');
  const result = await authService.login('test@example.com', 'wrongpassword');
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'INVALID_CREDENTIALS');
  assert.strictEqual(result.message, 'Неверный email или пароль');
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - login with non-existent email returns error', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const result = await authService.login('nonexistent@example.com', 'password123');
  
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.error, 'INVALID_CREDENTIALS');
  assert.strictEqual(result.message, 'Неверный email или пароль');
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - validateSession with valid token', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const regResult = await authService.register('test@example.com', 'password123', 'Test User');
  const loginResult = await authService.login('test@example.com', 'password123');
  
  const user = await authService.validateSession(loginResult.token);
  
  assert.ok(user);
  assert.strictEqual(user.email, 'test@example.com');
  assert.strictEqual(user.name, 'Test User');
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - validateSession with invalid token returns null', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const user = await authService.validateSession('invalid-token');
  
  assert.strictEqual(user, null);
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - hashPassword creates different hash than original', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const password = 'mypassword123';
  const hash = await authService.hashPassword(password);
  
  assert.notStrictEqual(hash, password);
  assert.ok(hash.length > password.length);
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - verifyPassword returns true for correct password', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const password = 'mypassword123';
  const hash = await authService.hashPassword(password);
  const isValid = await authService.verifyPassword(password, hash);
  
  assert.strictEqual(isValid, true);
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - verifyPassword returns false for incorrect password', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  const password = 'mypassword123';
  const hash = await authService.hashPassword(password);
  const isValid = await authService.verifyPassword('wrongpassword', hash);
  
  assert.strictEqual(isValid, false);
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - logout validates token', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  await authService.register('test@example.com', 'password123', 'Test User');
  const loginResult = await authService.login('test@example.com', 'password123');
  
  // Logout с валидным токеном должен пройти успешно
  await assert.doesNotReject(async () => {
    await authService.logout(loginResult.token);
  });
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});

test('AuthService - logout with invalid token throws error', async () => {
  setupTestDb();
  
  const originalDbPath = config.database.path;
  config.database.path = testDbPath;
  
  const authService = new AuthService();
  
  await assert.rejects(
    async () => {
      await authService.logout('invalid-token');
    },
    {
      message: 'Невалидный токен сессии'
    }
  );
  
  authService.close();
  config.database.path = originalDbPath;
  cleanupTestDb();
});
