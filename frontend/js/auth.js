// Утилиты для валидации
const validators = {
  email: (value) => {
    // Более строгая проверка email
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!value) return 'Email обязателен';
    if (!emailRegex.test(value)) return 'Введите корректный email';
    
    // Проверка на популярные домены
    const domain = value.split('@')[1]?.toLowerCase();
    const validDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'mail.ru', 'yandex.ru', 'icloud.com'];
    const hasValidTLD = /\.[a-z]{2,}$/i.test(domain);
    
    if (!hasValidTLD) {
      return 'Email должен содержать корректный домен (например, @gmail.com)';
    }
    
    return null;
  },

  password: (value) => {
    if (!value) return 'Пароль обязателен';
    if (value.length < 8) return 'Пароль должен содержать минимум 8 символов';
    if (value.length > 100) return 'Пароль слишком длинный (максимум 100 символов)';
    return null;
  },

  name: (value) => {
    if (!value) return 'Имя обязательно';
    if (value.trim().length < 2) return 'Имя должно содержать минимум 2 символа';
    if (value.length > 100) return 'Имя слишком длинное (максимум 100 символов)';
    return null;
  },

  confirmPassword: (value, password) => {
    if (!value) return 'Подтвердите пароль';
    if (value !== password) return 'Пароли не совпадают';
    return null;
  }
};

// Показать ошибку для поля
function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorElement = document.getElementById(`${fieldId}-error`);
  
  if (input && errorElement) {
    input.classList.add('error');
    errorElement.textContent = message;
  }
}

// Очистить ошибку для поля
function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const errorElement = document.getElementById(`${fieldId}-error`);
  
  if (input && errorElement) {
    input.classList.remove('error');
    errorElement.textContent = '';
  }
}

// Показать общее сообщение
function showMessage(message, type = 'error') {
  const container = document.getElementById('message-container');
  if (container) {
    container.textContent = message;
    container.className = `message-container ${type}`;
    container.classList.remove('hidden');
    
    // Автоматически скрыть сообщение об успехе через 5 секунд
    if (type === 'success') {
      setTimeout(() => {
        container.classList.add('hidden');
      }, 5000);
    }
  }
}

// Скрыть общее сообщение
function hideMessage() {
  const container = document.getElementById('message-container');
  if (container) {
    container.classList.add('hidden');
  }
}

// Установить состояние загрузки кнопки
function setButtonLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.classList.add('loading');
  } else {
    button.disabled = false;
    button.classList.remove('loading');
  }
}

// Обработка формы регистрации
const registerForm = document.getElementById('register-form');
if (registerForm) {
  // Валидация в реальном времени
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');

  nameInput?.addEventListener('blur', () => {
    const error = validators.name(nameInput.value);
    if (error) {
      showFieldError('name', error);
    } else {
      clearFieldError('name');
    }
  });

  emailInput?.addEventListener('blur', () => {
    const error = validators.email(emailInput.value);
    if (error) {
      showFieldError('email', error);
    } else {
      clearFieldError('email');
    }
  });

  passwordInput?.addEventListener('blur', () => {
    const error = validators.password(passwordInput.value);
    if (error) {
      showFieldError('password', error);
    } else {
      clearFieldError('password');
    }
  });

  confirmPasswordInput?.addEventListener('blur', () => {
    const error = validators.confirmPassword(confirmPasswordInput.value, passwordInput.value);
    if (error) {
      showFieldError('confirm-password', error);
    } else {
      clearFieldError('confirm-password');
    }
  });

  // Отправка формы
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Валидация всех полей
    let hasErrors = false;

    const nameError = validators.name(name);
    if (nameError) {
      showFieldError('name', nameError);
      hasErrors = true;
    } else {
      clearFieldError('name');
    }

    const emailError = validators.email(email);
    if (emailError) {
      showFieldError('email', emailError);
      hasErrors = true;
    } else {
      clearFieldError('email');
    }

    const passwordError = validators.password(password);
    if (passwordError) {
      showFieldError('password', passwordError);
      hasErrors = true;
    } else {
      clearFieldError('password');
    }

    const confirmPasswordError = validators.confirmPassword(confirmPassword, password);
    if (confirmPasswordError) {
      showFieldError('confirm-password', confirmPasswordError);
      hasErrors = true;
    } else {
      clearFieldError('confirm-password');
    }

    if (hasErrors) {
      showMessage('Пожалуйста, исправьте ошибки в форме', 'error');
      return;
    }

    // Отправка данных на сервер
    const submitButton = registerForm.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Успешная регистрация
        showMessage('Регистрация успешна! Перенаправление...', 'success');
        
        // Сохранить токен и информацию о пользователе
        if (data.token) {
          localStorage.setItem('authToken', data.token);
        }
        if (data.user) {
          localStorage.setItem('userId', data.user.id);
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('isAdmin', data.user.isAdmin ? 'true' : 'false');
          localStorage.setItem('userBanned', 'false');
        }

        // Перенаправить на главную страницу через 2 секунды
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        // Обработка ошибок от сервера
        if (data.fields) {
          // Показать ошибки для конкретных полей
          Object.keys(data.fields).forEach(field => {
            const errors = data.fields[field];
            if (errors && errors.length > 0) {
              showFieldError(field, errors[0]);
            }
          });
        }
        showMessage(data.message || 'Ошибка регистрации. Попробуйте снова.', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showMessage('Ошибка соединения с сервером. Попробуйте позже.', 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

// Обработка формы входа
const loginForm = document.getElementById('login-form');
if (loginForm) {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  // Валидация в реальном времени
  emailInput?.addEventListener('blur', () => {
    const error = validators.email(emailInput.value);
    if (error) {
      showFieldError('email', error);
    } else {
      clearFieldError('email');
    }
  });

  passwordInput?.addEventListener('blur', () => {
    if (!passwordInput.value) {
      showFieldError('password', 'Пароль обязателен');
    } else {
      clearFieldError('password');
    }
  });

  // Отправка формы
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Валидация
    let hasErrors = false;

    const emailError = validators.email(email);
    if (emailError) {
      showFieldError('email', emailError);
      hasErrors = true;
    } else {
      clearFieldError('email');
    }

    if (!password) {
      showFieldError('password', 'Пароль обязателен');
      hasErrors = true;
    } else {
      clearFieldError('password');
    }

    if (hasErrors) {
      showMessage('Пожалуйста, заполните все поля', 'error');
      return;
    }

    // Отправка данных на сервер
    const submitButton = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Успешный вход
        showMessage('Вход выполнен! Перенаправление...', 'success');
        
        // Сохранить токен и информацию о пользователе
        if (data.token) {
          localStorage.setItem('authToken', data.token);
        }
        if (data.user) {
          localStorage.setItem('userId', data.user.id);
          localStorage.setItem('userName', data.user.name);
          localStorage.setItem('isAdmin', data.user.isAdmin ? 'true' : 'false');
          localStorage.setItem('userBanned', data.user.isBanned ? 'true' : 'false');
        }

        // Перенаправить на главную страницу через 1 секунду
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        // Обработка ошибок от сервера
        if (data.fields) {
          // Показать ошибки для конкретных полей
          Object.keys(data.fields).forEach(field => {
            const errors = data.fields[field];
            if (errors && errors.length > 0) {
              showFieldError(field, errors[0]);
            }
          });
        }
        showMessage(data.message || 'Неверный email или пароль', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      showMessage('Ошибка соединения с сервером. Попробуйте позже.', 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

// Очистка ошибок при вводе
document.querySelectorAll('.auth-form input').forEach(input => {
  input.addEventListener('input', () => {
    if (input.classList.contains('error')) {
      clearFieldError(input.id);
      hideMessage();
    }
  });
});
