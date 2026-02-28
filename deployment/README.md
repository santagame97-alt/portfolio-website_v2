# Инструкция по деплою на хостинг

Этот проект можно задеплоить на различные платформы. Ниже инструкции для самых популярных.

## Подготовка проекта

Перед деплоем убедитесь что:
1. ✅ Все работает локально
2. ✅ Файл `.env` НЕ добавлен в git (он в .gitignore)
3. ✅ База данных создана и заполнена
4. ✅ Есть хотя бы один администратор

## Railway.app (Рекомендуется) ⭐

### Преимущества:
- Простой деплой через GitHub
- Поддержка WebSocket
- Persistent storage для SQLite
- Бесплатный план ($5 кредитов/месяц)

### Инструкция:

1. **Создайте аккаунт на Railway.app**
   - Перейдите на https://railway.app
   - Войдите через GitHub

2. **Загрузите проект на GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/ваш-username/ваш-репозиторий.git
   git push -u origin main
   ```

3. **Создайте новый проект в Railway**
   - Нажмите "New Project"
   - Выберите "Deploy from GitHub repo"
   - Выберите ваш репозиторий

4. **Настройте переменные окружения**
   В разделе Variables добавьте:
   ```
   PORT=3000
   NODE_ENV=production
   JWT_SECRET=ваш-секретный-ключ-минимум-32-символа
   TELEGRAM_BOT_TOKEN=ваш-токен-бота
   TELEGRAM_ADMIN_CHAT_ID=ваш-chat-id
   ```

5. **Добавьте Volume для базы данных**
   - В настройках проекта добавьте Volume
   - Mount path: `/app/database`
   - Это сохранит базу данных между перезапусками

6. **Добавьте Volume для загрузок**
   - Добавьте еще один Volume
   - Mount path: `/app/frontend/images/uploads`

7. **Деплой**
   - Railway автоматически задеплоит проект
   - Получите URL вашего приложения

## Render.com

### Инструкция:

1. **Создайте аккаунт на Render.com**
   - https://render.com

2. **Создайте Web Service**
   - New → Web Service
   - Подключите GitHub репозиторий

3. **Настройки:**
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `node backend/server.js`
   - Plan: Free или Starter ($7/мес)

4. **Переменные окружения:**
   Добавьте те же переменные что и для Railway

5. **Добавьте Disk**
   - В настройках добавьте Persistent Disk
   - Mount path: `/app/database`
   - Size: 1GB

## VPS (DigitalOcean, Hetzner, Contabo)

### Инструкция:

1. **Создайте VPS сервер**
   - Ubuntu 22.04 LTS
   - Минимум 1GB RAM

2. **Подключитесь по SSH**
   ```bash
   ssh root@ваш-ip-адрес
   ```

3. **Установите Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Установите PM2**
   ```bash
   npm install -g pm2
   ```

5. **Клонируйте проект**
   ```bash
   git clone https://github.com/ваш-username/ваш-репозиторий.git
   cd ваш-репозиторий
   npm install
   ```

6. **Создайте .env файл**
   ```bash
   nano .env
   ```
   Вставьте ваши переменные окружения

7. **Инициализируйте базу данных**
   ```bash
   node database/init.js
   ```

8. **Запустите с PM2**
   ```bash
   pm2 start backend/server.js --name portfolio
   pm2 save
   pm2 startup
   ```

9. **Настройте Nginx (опционально)**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/portfolio
   ```

   Конфигурация Nginx:
   ```nginx
   server {
       listen 80;
       server_name ваш-домен.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

10. **Настройте SSL с Let's Encrypt**
    ```bash
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d ваш-домен.com
    ```

## Важные замечания

### Безопасность:
- ⚠️ Измените JWT_SECRET на случайную строку минимум 32 символа
- ⚠️ Не коммитьте .env файл в git
- ⚠️ Используйте HTTPS в продакшне

### База данных:
- SQLite подходит для небольших проектов (до 1000 пользователей)
- Для больших проектов рассмотрите PostgreSQL или MySQL

### Резервное копирование:
- Регулярно делайте бэкап базы данных
- Сохраняйте загруженные изображения

### Мониторинг:
- Используйте PM2 для автоматического перезапуска
- Настройте логирование ошибок
- Мониторьте использование ресурсов

## Проверка после деплоя

1. ✅ Откройте главную страницу
2. ✅ Зарегистрируйте тестового пользователя
3. ✅ Проверьте что пришло уведомление в Telegram
4. ✅ Отправьте сообщение в чат
5. ✅ Проверьте админ-панель
6. ✅ Загрузите тестовую работу с изображением

## Поддержка

Если возникли проблемы:
1. Проверьте логи сервера
2. Убедитесь что все переменные окружения установлены
3. Проверьте что порты открыты
4. Убедитесь что база данных инициализирована

## Полезные команды

### Railway CLI:
```bash
npm i -g @railway/cli
railway login
railway logs
railway variables
```

### PM2:
```bash
pm2 list                 # Список процессов
pm2 logs portfolio       # Логи
pm2 restart portfolio    # Перезапуск
pm2 stop portfolio       # Остановка
pm2 delete portfolio     # Удаление
```

### Git:
```bash
git status               # Статус
git add .                # Добавить все файлы
git commit -m "message"  # Коммит
git push                 # Отправить на GitHub
```
