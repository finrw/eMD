var autoSlideTimer = null;

// ====== GANTI dengan URL Web App Apps Script kamu (berakhiran /exec) ======
var API_URL = 'https://script.google.com/macros/s/AKfycbxKgnQbipwPRrwyqXWbl8N2ptwdZ3pK3-ITvI57F_4SRbY0vlOnSqLHm2ufOp_UFhLKQg/exec';
var CACHE_KEY = 'emd_data_v2';

// Folder gambar di repo GitHub (relatif terhadap index.html)
// HARUS dideklarasikan sebelum render pertama di bawah
var IMG_FOLDER = 'foto/';

function showError(err) {
  document.getElementById('bannerContainer').innerHTML =
    '<div class="empty-note" style="min-width:100%;">Gagal memuat data: ' + escapeHtml(err) + '</div>';
  document.getElementById('produkGrid').innerHTML =
    '<div class="empty-note">Gagal memuat produk.</div>';
}

// Tampilkan data cache dulu (instan), lalu perbarui dari server
var renderedFromCache = false;
try {
  var cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    renderToko(JSON.parse(cached));
    renderedFromCache = true;
  }
} catch (e) {}

fetch(API_URL)
  .then(function (r) { return r.json(); })
  .then(function (res) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(res)); } catch (e) {}
    // Render ulang hanya jika belum ada cache, atau data berubah
    if (!renderedFromCache || JSON.stringify(res) !== cached) {
      if (autoSlideTimer) clearInterval(autoSlideTimer);
      renderToko(res);
    }
  })
  .catch(function (err) {
    if (!renderedFromCache) showError(err);
  });

function normalizeImageUrl(url, width) {
  if (!url) return url;
  url = url.toString().trim();
  var driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  var driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  var lh3Match = url.match(/lh3\.googleusercontent\.com\/d\/([^=?]+)/);
  var id = null;
  if (driveFileMatch) id = driveFileMatch[1];
  else if (driveOpenMatch) id = driveOpenMatch[1];
  else if (lh3Match) id = lh3Match[1];
  if (id) {
    return 'https://lh3.googleusercontent.com/d/' + id + '=w' + (width || 1200);
  }
  // Nama file saja (mis. "asus-mb.webp") -> ambil dari folder foto/ di GitHub
  if (!/^(https?:)?\/\//i.test(url) && url.indexOf('data:') !== 0) {
    if (url.indexOf(IMG_FOLDER) !== 0) url = IMG_FOLDER + url;
    return encodeURI(url);
  }
  return url;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderToko(res) {
  if (!res.success) {
    document.getElementById('bannerContainer').innerHTML =
      '<div class="empty-note" style="min-width:100%;">Error: ' + escapeHtml(res.error) + '</div>';
    return;
  }

  var bannerContainer = document.getElementById('bannerContainer');
  var bannerHTML = '';
  var validBanners = res.banners.filter(function (row) {
    return row && row[1] && row[1].toString().trim().length > 0;
  });

  if (validBanners.length === 0) {
    bannerHTML = '<div class="empty-note" style="min-width:100%;">Belum ada banner</div>';
  } else {
    validBanners.forEach(function (row) {
      var namaBanner = row[0] ? row[0].toString().trim() : '';
      var linkGambar = normalizeImageUrl(row[1], 1200);
      bannerHTML += '<div class="banner-card">';
      bannerHTML += '<img src="' + escapeHtml(linkGambar) + '" alt="' + escapeHtml(namaBanner || 'Banner') + '" loading="lazy" ' +
        'onerror="console.warn(\'Banner gagal dimuat:\', this.src); this.closest(\'.banner-card\').remove(); syncBannerDots();">';
      if (namaBanner) {
        bannerHTML += '<span class="banner-label">' + escapeHtml(namaBanner) + '</span>';
      }
      bannerHTML += '</div>';
    });
  }
  bannerContainer.innerHTML = bannerHTML;

  syncBannerDots();
  if (bannerContainer.querySelectorAll('.banner-card').length > 1) {
    initAutoSlide();
  }
  initDragToScroll();

  var produkGrid = document.getElementById('produkGrid');
  var produkHTML = '';

  if (!res.produkCards || res.produkCards.length === 0) {
    produkHTML = '<div class="empty-note">Belum ada produk</div>';
  } else {
    res.produkCards.forEach(function (card, cardIndex) {
      produkHTML += '<div class="produk-card" id="card-' + cardIndex + '">';
      produkHTML += '  <div class="brand-badge">' + escapeHtml(card.brand) + '</div>';
      
      card.items.forEach(function (item, itemIndex) {
        var activeClass = itemIndex === 0 ? ' active' : '';
        var linkGambar = item.gambar ? normalizeImageUrl(item.gambar, 400) : '';
        var isImage = linkGambar && (linkGambar.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) || linkGambar.indexOf('lh3.googleusercontent.com') !== -1);

        produkHTML += '<div class="slide-item' + activeClass + '">';
        produkHTML += '  <div class="thumb">';
        if (isImage) {
          produkHTML += '    <img src="' + escapeHtml(linkGambar) + '" alt="' + escapeHtml(item.nama) + '" loading="lazy" onerror="this.style.display=\'none\'">';
        }
        produkHTML += '  </div>';
        produkHTML += '  <h4>' + escapeHtml(item.nama || card.brand) + '</h4>';
        produkHTML += '</div>';
      });

      produkHTML += '</div>';
    });
  }

  produkGrid.innerHTML = produkHTML;
  startProductCardSlides();
}

function syncBannerDots() {
  var container = document.getElementById('bannerContainer');
  var dots = document.getElementById('bannerDots');
  var cards = container.querySelectorAll('.banner-card');
  if (cards.length > 1) {
    var dotsHTML = '';
    cards.forEach(function (_, i) {
      dotsHTML += '<div class="dot' + (i === 0 ? ' active' : '') + '"></div>';
    });
    dots.innerHTML = dotsHTML;
  } else {
    dots.innerHTML = '';
  }
}

function initAutoSlide() {
  var container = document.getElementById('bannerContainer');
  var dots = document.getElementById('bannerDots');
  function updateActiveDot() {
    var cards = container.querySelectorAll('.banner-card');
    var dotEls = dots.querySelectorAll('.dot');
    if (!cards.length) return;
    var cardWidth = cards[0].offsetWidth + 12;
    var index = Math.round(container.scrollLeft / cardWidth);
    dotEls.forEach(function (d, i) {
      d.classList.toggle('active', i === index);
    });
  }
  function startSlide() {
    stopSlide();
    autoSlideTimer = setInterval(function () {
      var card = container.querySelector('.banner-card');
      if (!card) return;
      var cardWidth = card.offsetWidth + 12;
      var maxScroll = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= maxScroll - 5) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }, 3000);
  }
  function stopSlide() {
    if (autoSlideTimer) clearInterval(autoSlideTimer);
  }
  container.addEventListener('scroll', updateActiveDot);
  startSlide();
  container.addEventListener('mouseenter', stopSlide);
  container.addEventListener('touchstart', stopSlide);
  container.addEventListener('mouseleave', startSlide);
  container.addEventListener('touchend', startSlide);
}

function initDragToScroll() {
  var container = document.getElementById('bannerContainer');
  if (!container || container.dataset.dragBound) return;
  container.dataset.dragBound = 'true';
  var isDown = false;
  var startX, scrollLeftPos;
  container.addEventListener('mousedown', function (e) {
    isDown = true;
    container.classList.add('dragging');
    startX = e.pageX - container.offsetLeft;
    scrollLeftPos = container.scrollLeft;
    if (autoSlideTimer) clearInterval(autoSlideTimer);
  });
  container.addEventListener('mouseleave', function () {
    isDown = false;
    container.classList.remove('dragging');
  });
  container.addEventListener('mouseup', function () {
    isDown = false;
    container.classList.remove('dragging');
  });
  container.addEventListener('mousemove', function (e) {
    if (!isDown) return;
    e.preventDefault();
    var x = e.pageX - container.offsetLeft;
    var walk = (x - startX) * 2;
    container.scrollLeft = scrollLeftPos - walk;
  });
}

function startProductCardSlides() {
  var cards = document.querySelectorAll('.produk-card');
  cards.forEach(function (card) {
    var slides = card.querySelectorAll('.slide-item');
    if (slides.length > 1) {
      var currentIndex = 0;
      var intervalTime = 3000 + Math.floor(Math.random() * 1000);

      setInterval(function () {
        slides[currentIndex].classList.remove('active');
        currentIndex = (currentIndex + 1) % slides.length;
        slides[currentIndex].classList.add('active');
      }, intervalTime);
    }
  });
}

var btnBackToTop = document.getElementById("backToTop");

window.onscroll = function() {
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    btnBackToTop.style.display = "flex";
  } else {
    btnBackToTop.style.display = "none";
  }
};

btnBackToTop.addEventListener("click", function() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});
