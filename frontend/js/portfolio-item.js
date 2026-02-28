// JavaScript для детальной страницы работы портфолио

let currentItem = null;
let currentImageIndex = 0;

// Получение ID работы из URL
function getItemIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// Загрузка работы портфолио
async function loadPortfolioItem() {
  const itemId = getItemIdFromUrl();
  const contentDiv = document.getElementById('portfolio-item-content');
  
  if (!itemId) {
    contentDiv.innerHTML = `
      <div class="error-message">
        Работа не найдена. <a href="/portfolio.html">Вернуться к списку работ</a>
      </div>
    `;
    return;
  }
  
  try {
    const response = await fetch(`/api/portfolio/${itemId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        contentDiv.innerHTML = `
          <div class="error-message">
            Работа не найдена. <a href="/portfolio.html">Вернуться к списку работ</a>
          </div>
        `;
        return;
      }
      throw new Error('Ошибка загрузки работы');
    }
    
    const item = await response.json();
    currentItem = item;
    
    // Обновление заголовка страницы
    document.title = `${escapeHtml(item.title)} - Портфолио`;
    
    // Отображение работы
    renderPortfolioItem(item);
    
  } catch (error) {
    console.error('Ошибка загрузки работы:', error);
    contentDiv.innerHTML = `
      <div class="error-message">
        Не удалось загрузить работу. Пожалуйста, попробуйте позже.
        <br><a href="/portfolio.html">Вернуться к списку работ</a>
      </div>
    `;
  }
}

// Отображение работы портфолио
function renderPortfolioItem(item) {
  const contentDiv = document.getElementById('portfolio-item-content');
  
  const hasImages = item.images && item.images.length > 0;
  
  let imagesHtml = '';
  if (hasImages) {
    const mainImage = item.images[0];
    imagesHtml = `
      <div class="portfolio-item-images">
        <img 
          id="main-image"
          src="/uploads/${escapeHtml(mainImage.filePath)}" 
          alt="${escapeHtml(mainImage.altText || item.title)}"
          class="portfolio-item-image-main"
          loading="lazy"
        >
        ${item.images.length > 1 ? `
          <div class="portfolio-item-image-gallery">
            ${item.images.map((img, index) => `
              <img 
                src="/uploads/${escapeHtml(img.filePath)}" 
                alt="${escapeHtml(img.altText || item.title)}"
                class="portfolio-item-image-thumbnail ${index === 0 ? 'active' : ''}"
                data-index="${index}"
                onclick="changeMainImage(${index})"
                loading="lazy"
              >
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  } else {
    imagesHtml = `
      <div class="portfolio-item-images">
        <div class="no-images-message">Изображения отсутствуют</div>
      </div>
    `;
  }
  
  contentDiv.innerHTML = `
    <article class="portfolio-item-detail">
      <header class="portfolio-item-header">
        <h1 class="portfolio-item-title">${escapeHtml(item.title)}</h1>
        <p class="portfolio-item-description">${escapeHtml(item.description)}</p>
      </header>
      
      ${imagesHtml}
      
      <div class="portfolio-item-body">
        <div class="portfolio-item-content">${escapeHtml(item.content)}</div>
      </div>
    </article>
  `;
}

// Смена главного изображения
function changeMainImage(index) {
  if (!currentItem || !currentItem.images || index >= currentItem.images.length) {
    return;
  }
  
  currentImageIndex = index;
  const mainImage = document.getElementById('main-image');
  const newImage = currentItem.images[index];
  
  if (mainImage && newImage) {
    mainImage.src = `/uploads/${escapeHtml(newImage.filePath)}`;
    mainImage.alt = escapeHtml(newImage.altText || currentItem.title);
    
    // Обновление активного thumbnail
    document.querySelectorAll('.portfolio-item-image-thumbnail').forEach((thumb, i) => {
      if (i === index) {
        thumb.classList.add('active');
      } else {
        thumb.classList.remove('active');
      }
    });
  }
}

// Экранирование HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Загрузка при открытии страницы
document.addEventListener('DOMContentLoaded', loadPortfolioItem);
