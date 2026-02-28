# Быстрая инструкция: Загрузка на GitHub

## Шаг 1: Создайте репозиторий на GitHub

1. Откройте https://github.com
2. Нажмите "New repository" (зеленая кнопка)
3. Введите название (например: `portfolio-website`)
4. Выберите "Private" если не хотите чтобы код был публичным
5. НЕ добавляйте README, .gitignore или лицензию (они уже есть)
6. Нажмите "Create repository"

## Шаг 2: Инициализируйте Git локально

Откройте терминал в папке проекта и выполните:

```bash
# Инициализация git
git init

# Добавление всех файлов
git add .

# Первый коммит
git commit -m "Initial commit: Portfolio website with chat"

# Переименование ветки в main
git branch -M main

# Добавление удаленного репозитория (замените YOUR_USERNAME и YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Отправка на GitHub
git push -u origin main
```

## Шаг 3: Проверка

1. Обновите страницу вашего репозитория на GitHub
2. Вы должны увидеть все файлы проекта
3. Убедитесь что `.env` файл НЕ загружен (он должен быть в .gitignore)

## Важно! ⚠️

### Файлы которые НЕ должны попасть в Git:
- ❌ `.env` - содержит секретные ключи
- ❌ `node_modules/` - зависимости (устанавливаются через npm install)
- ❌ `database/*.db` - база данных (создается на сервере)
- ❌ `frontend/images/uploads/` - загруженные файлы

### Файлы которые ДОЛЖНЫ быть в Git:
- ✅ Весь код (backend/, frontend/)
- ✅ package.json и package-lock.json
- ✅ .gitignore
- ✅ .env.example (пример конфигурации)
- ✅ README.md
- ✅ database/schema.sql и database/init.js

## Обновление кода на GitHub

После внесения изменений:

```bash
# Проверить что изменилось
git status

# Добавить все изменения
git add .

# Создать коммит с описанием
git commit -m "Описание изменений"

# Отправить на GitHub
git push
```

## Полезные команды Git

```bash
# Посмотреть историю коммитов
git log

# Посмотреть изменения
git diff

# Отменить изменения в файле
git checkout -- filename

# Создать новую ветку
git checkout -b feature-name

# Переключиться на другую ветку
git checkout main

# Слить ветку
git merge feature-name
```

## Что делать если возникла ошибка

### Ошибка: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

### Ошибка: "failed to push some refs"
```bash
git pull origin main --rebase
git push origin main
```

### Случайно добавили .env в git
```bash
# Удалить из git но оставить локально
git rm --cached .env

# Коммит
git commit -m "Remove .env from git"

# Отправить
git push
```

## Следующий шаг

После загрузки на GitHub, переходите к деплою на хостинг:
- См. `deployment/README.md` для инструкций по Railway, Render или VPS
