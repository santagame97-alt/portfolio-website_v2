import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'portfolio.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Создание и инициализация базы данных
export function initDatabase() {
  console.log('Инициализация базы данных...');
  
  // Создание базы данных
  const db = new Database(DB_PATH);
  
  // Чтение и выполнение схемы
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  
  console.log('✓ Схема базы данных создана');
  
  // Создание администратора по умолчанию
  const adminEmail = 'admin@example.com';
  const adminPassword = 'admin123'; // Изменить в продакшн!
  
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(adminPassword, 10);
    db.prepare(`
      INSERT INTO users (email, password_hash, name, is_admin)
      VALUES (?, ?, ?, 1)
    `).run(adminEmail, passwordHash, 'Администратор');
    
    console.log('✓ Администратор создан');
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Пароль: ${adminPassword}`);
    console.log('  ⚠️  ВАЖНО: Измените пароль администратора после первого входа!');
  } else {
    console.log('✓ Администратор уже существует');
  }
  
  db.close();
  console.log('✓ База данных инициализирована успешно');
}

// Запуск инициализации если скрипт вызван напрямую
if (import.meta.url.startsWith('file:')) {
  const modulePath = fileURLToPath(import.meta.url);
  if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
    initDatabase();
  }
}
