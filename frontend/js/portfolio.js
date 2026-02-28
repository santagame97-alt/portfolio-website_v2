// JavaScript для страницы портфолио

// Загрузка работ портфолио
async function loadPortfolioItems() {
  const portfolioGrid = document.getElementById('portfolio-grid');
  
  try {
    const response = await fetch('/api/portfolio');
    
    if (!response.ok) {
      throw new Error('Ошибка загрузки портфолио');
    }
    
    const items = await response.json();
    
    if (items.length === 0) {
      portfolioGrid.innerHTML = '<div class="loading">Работы пока не добавлены</div>';
      return;
    }
    
    portfolioGrid.innerHTML = items.map(item => {
      const imageUrl = item.images && item.images.length > 0 
        ? `/uploads/${escapeHtml(item.images[0].filePath)}`
        : '/images/placeholder.jpg';
      
      const imageAlt = item.images && item.images.length > 0 && item.images[0].altText
        ? escapeHtml(item.images[0].altText)
        : escapeHtml(item.title);
      
      return `
        <div class="portfolio-item" onclick="openPortfolioItem(${item.id})">
          <img 
            src="${imageUrl}" 
            alt="${imageAlt}"
            class="portfolio-item-image"
            loading="lazy"
          >
          <div class="portfolio-item-content">
            <h2 class="portfolio-item-title">${escapeHtml(item.title)}</h2>
            <p class="portfolio-item-description">${escapeHtml(item.description)}</p>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Ошибка загрузки портфолио:', error);
    portfolioGrid.innerHTML = `
      <div class="error-message">
        Не удалось загрузить работы. Пожалуйста, попробуйте позже.
      </div>
    `;
  }
}

// Открытие детальной страницы работы
function openPortfolioItem(id) {
  window.location.href = `/portfolio-item.html?id=${id}`;
}

// Экранирование HTML (импортируется из main.js, но дублируем для независимости)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Загрузка при открытии страницы
document.addEventListener('DOMContentLoaded', loadPortfolioItems);
