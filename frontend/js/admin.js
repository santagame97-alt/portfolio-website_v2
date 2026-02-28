// Админ-панель функциональность

// Проверка прав администратора
function checkAdminAccess() {
  const token = localStorage.getItem('authToken');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  if (!token || !isAdmin) {
    alert('Доступ запрещен. Требуются права администратора.');
    window.location.href = '/';
    return false;
  }

  return true;
}

// Переключение секций
function setupNavigation() {
  const navLinks = document.querySelectorAll('.admin-nav-link');
  const sections = document.querySelectorAll('.admin-section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      const sectionId = link.dataset.section;
      
      // Убираем активный класс со всех ссылок и секций
      navLinks.forEach(l => l.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      
      // Добавляем активный класс
      link.classList.add('active');
      document.getElementById(`${sectionId}-section`).classList.add('active');
      
      // Загружаем данные для секции
      loadSectionData(sectionId);
    });
  });
}

// Загрузка данных для секции
async function loadSectionData(section) {
  switch(section) {
    case 'portfolio':
      await loadPortfolioItems();
      break;
    case 'messages':
      await loadMessages();
      break;
    case 'users':
      await loadUsers();
      break;
  }
}

// Загрузка работ портфолио
async function loadPortfolioItems() {
  const container = document.getElementById('portfolio-list');
  container.innerHTML = '<div class="loading">Загрузка...</div>';

  try {
    const response = await fetch('/api/portfolio');
    if (!response.ok) throw new Error('Ошибка загрузки');

    const items = await response.json();

    if (items.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">Работы пока не добавлены</p>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="portfolio-admin-item">
        <div class="portfolio-admin-item-info">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
        </div>
        <div class="portfolio-admin-item-actions">
          <button class="btn-icon btn-edit" onclick="editPortfolioItem(${item.id})" title="Редактировать">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon btn-delete" onclick="deletePortfolioItem(${item.id})" title="Удалить">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Ошибка загрузки портфолио:', error);
    container.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Ошибка загрузки данных</p>';
  }
}

// Загрузка сообщений
async function loadMessages() {
  const container = document.getElementById('messages-list');
  container.innerHTML = '<div class="loading">Загрузка...</div>';

  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/chats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Ошибка загрузки');

    const chats = await response.json();

    if (chats.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">Сообщений пока нет</p>';
      return;
    }

    container.innerHTML = chats.map(chat => `
      <div class="message-admin-item" onclick="openChat(${chat.id})">
        <div class="message-admin-item-header">
          <span class="message-admin-item-user">
            ${escapeHtml(chat.userName)}
            ${chat.unreadCount > 0 ? `<span class="unread-badge">${chat.unreadCount}</span>` : ''}
          </span>
          <span class="message-admin-item-time">${formatTime(chat.lastMessageAt)}</span>
        </div>
        <div class="message-admin-item-preview">
          ${chat.lastMessage ? escapeHtml(chat.lastMessage.content).substring(0, 100) + '...' : 'Нет сообщений'}
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Ошибка загрузки сообщений:', error);
    container.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Ошибка загрузки данных</p>';
  }
}

// Загрузка пользователей
async function loadUsers() {
  const container = document.getElementById('users-list');
  container.innerHTML = '<div class="loading">Загрузка...</div>';

  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Ошибка загрузки');

    const users = await response.json();

    if (users.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">Пользователей пока нет</p>';
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="user-admin-item">
        <div class="user-admin-item-info">
          <h3>${escapeHtml(user.name)}</h3>
          <p>${escapeHtml(user.email)}</p>
          <span class="user-admin-item-meta">
            ${user.isAdmin ? '<span class="badge badge-admin">Администратор</span>' : ''}
            ${user.isBanned ? '<span class="badge badge-banned">Забанен</span>' : '<span class="badge badge-active">Активен</span>'}
          </span>
        </div>
        <div class="user-admin-item-actions">
          ${!user.isAdmin ? `
            <button class="btn ${user.isBanned ? 'btn-success' : 'btn-danger'}" 
                    onclick="${user.isBanned ? 'unbanUser' : 'banUser'}(${user.id})">
              ${user.isBanned ? 'Разбанить' : 'Забанить'}
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
    container.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 2rem;">Ошибка загрузки данных</p>';
  }
}

// Забанить пользователя
async function banUser(userId) {
  if (!confirm('Вы уверены, что хотите забанить этого пользователя?')) {
    return;
  }

  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/users/${userId}/ban`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Ошибка бана');

    alert('Пользователь успешно забанен');
    await loadUsers();
  } catch (error) {
    console.error('Ошибка бана пользователя:', error);
    alert('Ошибка при бане пользователя');
  }
}

// Разбанить пользователя
async function unbanUser(userId) {
  if (!confirm('Вы уверены, что хотите разбанить этого пользователя?')) {
    return;
  }

  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/users/${userId}/unban`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Ошибка разбана');

    alert('Пользователь успешно разбанен');
    await loadUsers();
  } catch (error) {
    console.error('Ошибка разбана пользователя:', error);
    alert('Ошибка при разбане пользователя');
  }
}

// Открыть чат
function openChat(chatId) {
  window.location.href = `/chat.html?chatId=${chatId}`;
}

// Редактировать работу портфолио
function editPortfolioItem(id) {
  alert(`Редактирование работы #${id} - функция в разработке`);
}

// Удалить работу портфолио
async function deletePortfolioItem(id) {
  if (!confirm('Вы уверены, что хотите удалить эту работу?')) {
    return;
  }

  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/portfolio/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка удаления');
    }

    alert('Работа успешно удалена');
    await loadPortfolioItems();
  } catch (error) {
    console.error('Ошибка удаления работы:', error);
    alert('Ошибка при удалении работы: ' + error.message);
  }
}

// Форматирование времени
function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  if (diff < 2 * oneDay && date.getDate() === now.getDate() - 1) {
    return 'Вчера ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Экранирование HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  // Проверка прав доступа
  if (!checkAdminAccess()) return;

  // Инициализация темы
  initTheme();

  // Настройка навигации
  setupNavigation();

  // Загрузка данных для первой секции
  loadPortfolioItems();

  // Обработчик кнопки добавления работы
  document.getElementById('add-portfolio-btn')?.addEventListener('click', () => {
    openAddPortfolioModal();
  });

  // Обработчик формы добавления работы
  document.getElementById('add-portfolio-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleAddPortfolio(e.target);
  });

  // Обработчик выбора изображений
  document.getElementById('portfolio-images')?.addEventListener('change', (e) => {
    handleImagePreview(e.target.files);
  });

  // Обработчик выхода
  document.getElementById('logout-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '/';
  });

  // Обработчик переключения темы
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
});

// Инициализация темы
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

// Переключение темы
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Открыть модальное окно добавления работы
function openAddPortfolioModal() {
  const modal = document.getElementById('add-portfolio-modal');
  modal.classList.add('show');
  document.getElementById('portfolio-title').focus();
}

// Закрыть модальное окно добавления работы
function closeAddPortfolioModal() {
  const modal = document.getElementById('add-portfolio-modal');
  modal.classList.remove('show');
  document.getElementById('add-portfolio-form').reset();
  document.getElementById('image-preview').innerHTML = '';
  selectedImages = [];
}

// Массив для хранения выбранных изображений
let selectedImages = [];

// Обработка превью изображений
function handleImagePreview(files) {
  const previewContainer = document.getElementById('image-preview');
  
  Array.from(files).forEach((file, index) => {
    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      alert(`Файл ${file.name} не является изображением`);
      return;
    }

    // Проверка размера файла (5 МБ)
    if (file.size > 5 * 1024 * 1024) {
      alert(`Файл ${file.name} слишком большой (макс. 5 МБ)`);
      return;
    }

    selectedImages.push(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'image-preview-item';
      previewItem.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <button type="button" class="image-preview-item-remove" onclick="removeImagePreview(${selectedImages.length - 1})">&times;</button>
      `;
      previewContainer.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
  });

  // Очистка input для возможности повторного выбора тех же файлов
  document.getElementById('portfolio-images').value = '';
}

// Удаление изображения из превью
function removeImagePreview(index) {
  selectedImages.splice(index, 1);
  
  // Перерисовка превью
  const previewContainer = document.getElementById('image-preview');
  previewContainer.innerHTML = '';
  
  selectedImages.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'image-preview-item';
      previewItem.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <button type="button" class="image-preview-item-remove" onclick="removeImagePreview(${idx})">&times;</button>
      `;
      previewContainer.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
  });
}

// Обработка добавления работы
async function handleAddPortfolio(form) {
  const formData = new FormData(form);
  const data = {
    title: formData.get('title'),
    description: formData.get('description'),
    content: formData.get('content')
  };

  try {
    const token = localStorage.getItem('authToken');
    
    // Создаем работу
    const response = await fetch('/api/portfolio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Ошибка создания работы');
    }

    const createdItem = await response.json();

    // Загружаем изображения если есть
    if (selectedImages.length > 0) {
      for (let i = 0; i < selectedImages.length; i++) {
        const imageFormData = new FormData();
        imageFormData.append('image', selectedImages[i]);
        imageFormData.append('order', i);

        await fetch(`/api/portfolio/${createdItem.id}/images`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: imageFormData
        });
      }
    }

    alert('Работа успешно добавлена');
    closeAddPortfolioModal();
    await loadPortfolioItems();
  } catch (error) {
    console.error('Ошибка добавления работы:', error);
    alert('Ошибка при добавлении работы: ' + error.message);
  }
}

// Закрытие модального окна при клике вне его
window.addEventListener('click', (e) => {
  const modal = document.getElementById('add-portfolio-modal');
  if (e.target === modal) {
    closeAddPortfolioModal();
  }
});
