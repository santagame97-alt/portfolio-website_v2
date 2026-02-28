// Альтернативный скрипт инициализации БД для случаев, когда better-sqlite3 не компилируется
// Этот скрипт создает пустой файл БД и SQL скрипт для ручного выполнения

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'portfolio.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const INIT_SQL_PATH = path.join(__dirname, 'init-data.sql');

console.log('Создание SQL скрипта для инициализации...');

// Создание пустого файла БД
fs.writeFileSync(DB_PATH, '');
console.log('✓ Создан пустой файл базы данных');

// Генерация хеша пароля для администратора
const adminEmail = 'admin@example.com';
const adminPassword = 'admin123';
const passwordHash = bcrypt.hashSync(adminPassword, 10);

// Создание SQL скрипта с начальными данными
const initSQL = `
-- Вставка администратора по умолчанию
INSERT OR IGNORE INTO users (email, password_hash, name, is_admin)
VALUES ('${adminEmail}', '${passwordHash}', 'Администратор', 1);
`;

fs.writeFileSync(INIT_SQL_PATH, initSQL);

console.log('✓ Создан SQL скрипт с начальными данными');
console.log('\nДля завершения инициализации выполните следующие команды:');
console.log('1. Установите SQLite CLI (если еще не установлен)');
console.log('2. Выполните: sqlite3 database/portfolio.db < database/schema.sql');
console.log('3. Выполните: sqlite3 database/portfolio.db < database/init-data.sql');
console.log('\nИли используйте любой SQLite клиент для выполнения этих скриптов.');
console.log(`\nУчетные данные администратора:`);
console.log(`  Email: ${adminEmail}`);
console.log(`  Пароль: ${adminPassword}`);
console.log('  ⚠️  ВАЖНО: Измените пароль администратора после первого входа!');
