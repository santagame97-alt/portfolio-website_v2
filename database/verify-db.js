// Скрипт для проверки структуры базы данных
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'portfolio.db');

console.log('Проверка структуры базы данных...\n');

const db = new Database(DB_PATH, { readonly: true });

// Получение списка таблиц
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

console.log('Таблицы в базе данных:');
tables.forEach(table => {
  console.log(`  ✓ ${table.name}`);
  
  // Получение количества записей в таблице
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  console.log(`    Записей: ${count.count}`);
});

// Проверка индексов
const indexes = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='index' AND name NOT LIKE 'sqlite_%'
  ORDER BY name
`).all();

console.log('\nИндексы:');
indexes.forEach(index => {
  console.log(`  ✓ ${index.name}`);
});

// Проверка администратора
const admin = db.prepare('SELECT id, email, name, is_admin FROM users WHERE is_admin = 1').get();
if (admin) {
  console.log('\nАдминистратор:');
  console.log(`  ID: ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Имя: ${admin.name}`);
} else {
  console.log('\n⚠️  Администратор не найден!');
}

db.close();
console.log('\n✓ Проверка завершена');
