// Основной JavaScript файл

// Мобильное меню
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
  });
}

// Закрытие меню при клике на ссылку
const navLinks = document.querySelectorAll('.nav-menu a');
navLinks.forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('active');
  });
});

// Управление видимостью кнопки чата
function updateChatButtonVisibility() {
  const chatButton = document.getElementById('chat-button');
  if (!chatButton) return;

  // Проверяем наличие токена и статус пользователя
  const token = localStorage.getItem('authToken');
  const userBanned = localStorage.getItem('userBanned') === 'true';

  // Показываем кнопку только для аутентифицированных и не забаненных пользователей
  if (token && !userBanned) {
    chatButton.classList.remove('hidden');
  } else {
    chatButton.classList.add('hidden');
  }
}

// Обработчик кнопки чата
const chatButton = document.getElementById('chat-button');
if (chatButton) {
  chatButton.addEventListener('click', () => {
    window.location.href = '/chat.html';
  });
}

// Обновление ссылок авторизации
function updateAuthLinks() {
  const authLinks = document.getElementById('auth-links');
  if (!authLinks) return;

  const token = localStorage.getItem('authToken');
  const userName = localStorage.getItem('userName');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  if (token) {
    // Пользователь авторизован
    authLinks.innerHTML = `
      ${isAdmin ? '<a href="/admin.html">Админ-панель</a>' : ''}
      <span>Привет, ${escapeHtml(userName || 'Пользователь')}</span>
      <a href="#" id="logout-link">Выход</a>
    `;

    // Обработчик выхода
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    }
  } else {
    // Пользователь не авторизован
    authLinks.innerHTML = `
      <a href="/login.html">Вход</a>
      <a href="/register.html">Регистрация</a>
    `;
  }
}

// Функция выхода
function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('userName');
  localStorage.removeItem('isAdmin');
  localStorage.removeItem('userBanned');
  window.location.href = '/';
}

// Экранирование HTML для предотвращения XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateChatButtonVisibility();
  updateAuthLinks();
  setupThemeToggle();
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

// Настройка обработчика переключения темы
function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}
