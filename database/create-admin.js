import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'portfolio.db');

/**
 * Создание нового администратора
 */
async function createAdmin() {
  console.log('=== Создание администратора ===\n');

  // Запрос данных
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  try {
    const email = await question('Email администратора: ');
    const password = await question('Пароль (минимум 8 символов): ');
    const name = await question('Имя администратора: ');

    // Валидация
    if (!email || !email.includes('@')) {
      console.error('❌ Некорректный email');
      rl.close();
      return;
    }

    if (!password || password.length < 8) {
      console.error('❌ Пароль должен содержать минимум 8 символов');
      rl.close();
      return;
    }

    if (!name || name.trim().length < 2) {
      console.error('❌ Имя должно содержать минимум 2 символа');
      rl.close();
      return;
    }

    // Подключение к базе данных
    const db = new Database(DB_PATH);

    // Проверка существования пользователя
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (existingUser) {
      console.log('\n⚠️  Пользователь с таким email уже существует');
      const makeAdmin = await question('Сделать его администратором? (y/n): ');
      
      if (makeAdmin.toLowerCase() === 'y') {
        db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(email);
        console.log('✓ Пользователь теперь администратор');
      }
    } else {
      // Создание нового администратора
      const passwordHash = await bcrypt.hash(password, 10);
      
      db.prepare(`
        INSERT INTO users (email, password_hash, name, is_admin)
        VALUES (?, ?, ?, 1)
      `).run(email, passwordHash, name.trim());

      console.log('\n✓ Администратор успешно создан!');
      console.log(`  Email: ${email}`);
      console.log(`  Имя: ${name}`);
    }

    db.close();
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    rl.close();
  }
}

createAdmin();
