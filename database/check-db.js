import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'portfolio.db');

/**
 * Проверка состояния базы данных
 */
function checkDatabase() {
  console.log('=== Проверка базы данных ===\n');

  // Проверка существования файла
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ База данных не найдена!');
    console.log('   Путь:', DB_PATH);
    console.log('\n💡 Запустите: node database/init.js');
    return;
  }

  console.log('✓ Файл базы данных существует');
  console.log('  Путь:', DB_PATH);

  try {
    const db = new Database(DB_PATH);

    // Проверка таблиц
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all();

    console.log('\n✓ Таблицы в базе данных:');
    tables.forEach(table => {
      console.log(`  - ${table.name}`);
    });

    // Проверка пользователей
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();

    console.log('\n✓ Пользователи:');
    console.log(`  Всего: ${userCount.count}`);
    console.log(`  Администраторов: ${adminCount.count}`);

    // Список администраторов
    if (adminCount.count > 0) {
      const admins = db.prepare('SELECT id, email, name FROM users WHERE is_admin = 1').all();
      console.log('\n  Администраторы:');
      admins.forEach(admin => {
        console.log(`    - ${admin.name} (${admin.email})`);
      });
    }

    // Проверка портфолио
    const portfolioCount = db.prepare('SELECT COUNT(*) as count FROM portfolio_items').get();
    console.log(`\n✓ Работ в портфолио: ${portfolioCount.count}`);

    // Проверка чатов
    const chatCount = db.prepare('SELECT COUNT(*) as count FROM chats').get();
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    console.log(`\n✓ Чаты: ${chatCount.count}`);
    console.log(`✓ Сообщения: ${messageCount.count}`);

    db.close();
    console.log('\n✅ База данных в порядке!');
  } catch (error) {
    console.error('\n❌ Ошибка при проверке базы данных:', error.message);
  }
}

checkDatabase();
