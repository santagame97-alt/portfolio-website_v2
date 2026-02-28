// Чат функциональность

// Проверка авторизации
function checkAuth() {
  const token = localStorage.getItem('authToken');
  const userBanned = localStorage.getItem('userBanned') === 'true';

  if (!token) {
    window.location.href = '/login.html';
    return false;
  }

  if (userBanned) {
    alert('Ваш доступ к чату заблокирован');
    window.location.href = '/';
    return false;
  }

  return true;
}

// Элементы DOM
const messagesContainer = document.getElementById('chat-messages');
const messagesList = document.getElementById('messages-list');
const messagesLoading = document.getElementById('messages-loading');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatError = document.getElementById('chat-error');
const connectionStatus = document.getElementById('connection-status');

// Состояние
let currentChatId = null;
let isLoading = false;

// Форматирование времени
function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const oneDay = 24 * 60 * 60 * 1000;

  // Если сегодня - показываем только время
  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  // Если вчера
  if (diff < 2 * oneDay && date.getDate() === now.getDate() - 1) {
    return 'Вчера ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  // Иначе показываем дату и время
  return date.toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Создание элемента сообщения
function createMessageElement(message) {
  const userId = parseInt(localStorage.getItem('userId'));
  const isSent = message.senderId === userId;

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
  messageDiv.dataset.messageId = message.id;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = escapeHtml(message.content);

  const meta = document.createElement('div');
  meta.className = 'message-meta';

  if (!isSent) {
    const sender = document.createElement('span');
    sender.className = 'message-sender';
    sender.textContent = message.senderName;
    meta.appendChild(sender);
  }

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = formatTime(message.createdAt);
  meta.appendChild(time);

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(meta);

  return messageDiv;
}

// Отображение сообщений
function displayMessages(messages) {
  messagesList.innerHTML = '';

  if (messages.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <h2>Начните общение</h2>
      <p>Отправьте первое сообщение администратору</p>
    `;
    messagesList.appendChild(emptyState);
  } else {
    messages.forEach(message => {
      const messageElement = createMessageElement(message);
      messagesList.appendChild(messageElement);
    });
  }

  messagesLoading.classList.add('hidden');
  scrollToBottom();
}

// Добавление нового сообщения
function addMessage(message) {
  // Удаляем пустое состояние если есть
  const emptyState = messagesList.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const messageElement = createMessageElement(message);
  messagesList.appendChild(messageElement);
  scrollToBottom();
}

// Прокрутка к последнему сообщению
function scrollToBottom(smooth = true) {
  messagesContainer.scrollTo({
    top: messagesContainer.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

// Обновление статуса соединения
function updateConnectionStatus(status) {
  const indicator = connectionStatus.querySelector('.status-indicator');
  const text = connectionStatus.querySelector('.status-text');

  indicator.className = 'status-indicator';
  
  switch (status) {
    case 'connected':
      indicator.classList.add('connected');
      text.textContent = 'Подключено';
      break;
    case 'disconnected':
      indicator.classList.add('disconnected');
      text.textContent = 'Отключено';
      break;
    case 'connecting':
      text.textContent = 'Подключение...';
      break;
    default:
      text.textContent = 'Неизвестно';
  }
}

// Показ ошибки
function showError(message) {
  chatError.textContent = message;
  chatError.classList.add('show');
  setTimeout(() => {
    chatError.classList.remove('show');
  }, 5000);
}

// Загрузка истории сообщений
async function loadMessages() {
  if (isLoading) return;
  isLoading = true;

  try {
    const token = localStorage.getItem('authToken');
    console.log('Загрузка чата, токен:', token ? 'есть' : 'нет');
    
    // Получаем или создаем чат
    const chatResponse = await fetch('/api/chats/my', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Ответ чата:', chatResponse.status);

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json();
      console.error('Ошибка получения чата:', errorData);
      throw new Error('Не удалось загрузить чат');
    }

    const chat = await chatResponse.json();
    console.log('Чат получен:', chat);
    currentChatId = chat.id;

    // Загружаем сообщения
    const messagesResponse = await fetch(`/api/chats/${currentChatId}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Ответ сообщений:', messagesResponse.status);

    if (!messagesResponse.ok) {
      throw new Error('Не удалось загрузить сообщения');
    }

    const messages = await messagesResponse.json();
    console.log('Сообщения получены:', messages.length);
    displayMessages(messages);

  } catch (error) {
    console.error('Ошибка загрузки сообщений:', error);
    showError('Не удалось загрузить историю сообщений');
    messagesLoading.classList.add('hidden');
  } finally {
    isLoading = false;
  }
}

// Отправка сообщения
async function sendMessage(content) {
  if (!content.trim()) {
    showError('Сообщение не может быть пустым');
    return;
  }

  if (!currentChatId) {
    showError('Чат не инициализирован');
    return;
  }

  try {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(`/api/chats/${currentChatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content: content.trim() })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Не удалось отправить сообщение');
    }

    const message = await response.json();
    addMessage(message);
    messageInput.value = '';
    adjustTextareaHeight();

  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
    showError(error.message);
  }
}

// Автоматическое изменение высоты textarea
function adjustTextareaHeight() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// Обработчик отправки формы
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const content = messageInput.value;
  if (!content.trim()) return;

  sendButton.disabled = true;
  await sendMessage(content);
  sendButton.disabled = false;
  messageInput.focus();
});

// Обработчик ввода в textarea
messageInput.addEventListener('input', adjustTextareaHeight);

// Обработчик Enter (отправка) и Shift+Enter (новая строка)
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация темы
  initTheme();
  setupThemeToggle();

  // Проверяем авторизацию
  if (!checkAuth()) return;

  // Обновляем статус соединения
  updateConnectionStatus('connecting');

  // Загружаем сообщения
  await loadMessages();

  // Имитируем подключение (будет заменено на WebSocket в следующей задаче)
  updateConnectionStatus('connected');

  // Фокус на поле ввода
  messageInput.focus();
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
