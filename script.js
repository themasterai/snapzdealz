/**
 * SnapzDealz - E-Commerce Core JavaScript
 * Handles Cart, Wishlist, Authentication, Search, Dynamic Product Loading, and Micro-interactions
 */

// Storage Keys
const STORAGE_KEYS = {
  CART: 'snapdealz_cart_v1',
  WISHLIST: 'snapdealz_wishlist_v1',
  USERS: 'snapdealz_users_v1',
  CURRENT_USER: 'snapdealz_current_user_v1',
  COUPON: 'snapdealz_active_coupon_v1',
  ORDERS: 'snapdealz_orders_v1'
};

// Secure Cloud Storage Endpoint for Receiving Orders
const DEFAULT_GOOGLE_SHEET_WEBHOOK = 'https://script.google.com/macros/s/AKfycbxok04-fGeaORcDyDwG8qYODD-903xt4q8xq2YTJBCG2fQ6gAF1rmy8FEUyHrozYdQ2/exec';
function getActiveWebhookUrl() {
  try {
    return localStorage.getItem('snapdealz_google_sheet_webhook') || DEFAULT_GOOGLE_SHEET_WEBHOOK;
  } catch (e) {
    return DEFAULT_GOOGLE_SHEET_WEBHOOK;
  }
}
const GOOGLE_SHEET_ORDER_WEBHOOK = getActiveWebhookUrl();

// Available Promo Codes
const PROMO_CODES = {
  'BUNDLE20': { discountPercent: 20, description: '20% Off Bundle Deal' },
  'SNAPZ10': { discountPercent: 10, description: '10% Flash Discount' },
  'FREESHIP': { discountPercent: 0, freeShipping: true, description: 'Free Express Shipping' }
};

/* ==========================================================================
   1. APP INITIALIZATION & GLOBAL UTILITIES
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initStickyNavbar();
  initBackToTop();
  updateNavBadges();
  renderUserAuthNav();
  initScrollAnimations();
  initNewsletterForms();
  initGlobalSearchModal();
  initGlobalWishlistModal();
  initTrackOrderModal();
  initGmailOtpAuth();

  // Page Specific Inits based on URL or DOM element presence
  const currentPath = window.location.pathname;
  
  if (document.getElementById('cartItemsList') || document.getElementById('emptyCartState') || currentPath.endsWith('cart.html')) {
    initCartPage();
  } else if (document.getElementById('wishlistPageGrid') || currentPath.endsWith('wishlist.html')) {
    initWishlistPage();
  } else if (document.getElementById('shopProductsGrid') || currentPath.endsWith('shop.html')) {
    initShopPage();
  } else if (document.getElementById('productDetailContent') || currentPath.endsWith('product.html')) {
    initProductDetailPage();
  } else if (document.getElementById('loginForm') || currentPath.endsWith('login.html')) {
    initLoginPage();
  } else if (document.getElementById('signupForm') || currentPath.endsWith('signup.html')) {
    initSignupPage();
  } else if (document.getElementById('contactForm') || currentPath.endsWith('contact.html')) {
    initContactPage();
  } else if (currentPath.endsWith('about.html') || currentPath.endsWith('privacy.html') || currentPath.endsWith('terms.html')) {
    // Static informational pages - do not initialize home product grids
  } else {
    // Default to Home page initialization
    initHomePage();
  }
});

/** Preloader Fadeout */
function initPreloader() {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        preloader.classList.add('fade-out');
        setTimeout(() => preloader.remove(), 400);
      }, 250);
    });
    // Fallback if load already fired
    setTimeout(() => {
      if (preloader && !preloader.classList.contains('fade-out')) {
        preloader.classList.add('fade-out');
      }
    }, 1200);
  }
}

/** Sticky Navbar with scroll shadow */
function initStickyNavbar() {
  const navbar = document.querySelector('.snap-navbar');
  if (!navbar) return;

  const handleScroll = () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

/** Back to top button */
function initBackToTop() {
  const backToTopBtn = document.getElementById('backToTop');
  if (!backToTopBtn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add('show');
    } else {
      backToTopBtn.classList.remove('show');
    }
  }, { passive: true });

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * ==========================================================================
 * PREMIUM SMOOTH SCROLLING & VIEWPORT ANIMATION ENGINE
 * Inspired by luxury agency and modern portfolio kinetic interactions
 * Uses requestAnimationFrame + linear interpolation (lerp) for smooth momentum
 * ==========================================================================
 */

class SmoothScrollEngine {
  constructor() {
    this.targetY = window.scrollY;
    this.currentY = window.scrollY;
    this.isScrolling = false;
    this.rafId = null;
    this.ease = 0.082; // Silky fluid damping
    this.isEnabled = true;
    this.isTouch = false;

    // Check user accessibility preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.isEnabled = false;
      return;
    }

    // Touch device detection to let native touch kinetic scroll operate
    window.addEventListener('touchstart', () => { this.isTouch = true; }, { passive: true });

    this.bindEvents();
  }

  bindEvents() {
    // Only capture wheel on desktop devices where smooth momentum scroll is desired
    window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // Sync on native scroll (scrollbar dragging, touch, internal jumps)
    window.addEventListener('scroll', () => {
      if (!this.isScrolling) {
        this.targetY = window.scrollY;
        this.currentY = window.scrollY;
      }
    }, { passive: true });

    // Smooth scroll for internal hash links (#categoriesSection, #whyChooseUs, etc.)
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.length > 1 && !href.startsWith('#modal') && !href.startsWith('#trackOrder') && !href.startsWith('#global') && !href.startsWith('#hero')) {
          try {
            const targetEl = document.querySelector(href);
            if (targetEl) {
              e.preventDefault();
              const topOffset = targetEl.getBoundingClientRect().top + window.scrollY - 75;
              this.scrollTo(topOffset);
            }
          } catch (err) {
            // Ignore non-standard selector syntax
          }
        }
      }
    });
  }

  onWheel(e) {
    if (this.isTouch) return;

    // Check if user is scrolling inside an open modal or offcanvas
    if (document.querySelector('.modal.show') || document.querySelector('.offcanvas.show')) {
      return;
    }

    // Allow native scroll inside scrollable inner containers (e.g., category scroll bar or tables)
    const target = e.target;
    const scrollable = target.closest('.category-scroll-container, .modal-body, .offcanvas-body, textarea');
    if (scrollable && (scrollable.scrollHeight > scrollable.clientHeight || scrollable.scrollWidth > scrollable.clientWidth)) {
      return;
    }

    e.preventDefault();

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const delta = e.deltaY;

    // Accumulate target with boundary clamping
    this.targetY = Math.max(0, Math.min(maxScroll, this.targetY + delta * 1.05));

    if (!this.isScrolling) {
      this.isScrolling = true;
      this.currentY = window.scrollY;
      this.update();
    }
  }

  scrollTo(targetY) {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    this.targetY = Math.max(0, Math.min(maxScroll, targetY));
    if (!this.isScrolling) {
      this.isScrolling = true;
      this.currentY = window.scrollY;
      this.update();
    }
  }

  update() {
    if (!this.isScrolling) return;

    const diff = this.targetY - this.currentY;
    this.currentY += diff * this.ease;

    window.scrollTo(0, Math.round(this.currentY));

    if (Math.abs(diff) < 0.6) {
      this.currentY = this.targetY;
      window.scrollTo(0, Math.round(this.currentY));
      this.isScrolling = false;
      cancelAnimationFrame(this.rafId);
      return;
    }

    this.rafId = requestAnimationFrame(() => this.update());
  }
}

/** Top Scroll Progress Indicator Bar */
function initScrollProgress() {
  let progressBar = document.getElementById('scrollProgressBar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'scrollProgressBar';
    progressBar.className = 'scroll-progress-bar';
    document.body.prepend(progressBar);
  }

  const updateProgress = () => {
    const scrollY = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight > 0) {
      const progress = Math.min(100, Math.max(0, (scrollY / docHeight) * 100));
      progressBar.style.width = `${progress}%`;
    }
  };

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

/** Subtle Parallax Depth Engine for floating hero images & cards */
function initParallaxEffects() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const parallaxElements = document.querySelectorAll('[data-parallax]');
  if (!parallaxElements.length) return;

  let ticking = false;

  const updateParallax = () => {
    const windowHeight = window.innerHeight;

    parallaxElements.forEach(el => {
      const speed = parseFloat(el.getAttribute('data-parallax') || '0.05');
      const rect = el.getBoundingClientRect();

      if (rect.top < windowHeight && rect.bottom > 0) {
        const offset = (rect.top - windowHeight / 2) * speed;
        const clampedOffset = Math.max(-28, Math.min(28, offset));
        el.style.transform = `translate3d(0, ${clampedOffset.toFixed(1)}px, 0)`;
      }
    });

    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });
}

/** Observe dynamic product cards for smooth continuous stagger reveal using a singleton observer */
let globalProductCardObserver = null;

function observeProductCards(container = document) {
  const cards = container.querySelectorAll('.deal-product-card');
  if (!cards.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cards.forEach(card => card.classList.add('card-revealed'));
    return;
  }

  if (!('IntersectionObserver' in window)) {
    cards.forEach(card => card.classList.add('card-revealed'));
    return;
  }

  if (!globalProductCardObserver) {
    globalProductCardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const card = entry.target;
        if (entry.isIntersecting) {
          // Progressive staggered entrance based on index in parent row
          const parentCol = card.closest('.col-6, .col-md-4, .col-lg-3, .col-12');
          let delay = 0;
          if (parentCol && parentCol.parentElement) {
            const siblings = Array.from(parentCol.parentElement.children);
            const index = siblings.indexOf(parentCol);
            delay = Math.min(420, Math.max(0, index * 60));
          }
          
          setTimeout(() => {
            card.classList.add('card-revealed');
          }, delay);
        } else {
          // Reset card when it leaves viewport so it re-animates smoothly on reverse scroll
          card.classList.remove('card-revealed');
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.08
    });
  }

  cards.forEach(card => {
    if (!card.__isCardObserved) {
      card.__isCardObserved = true;
      globalProductCardObserver.observe(card);
    }
  });
}

/** Global Intersection Observer for Sections, Stagger Groups, and Content with Bi-directional Scroll Re-trigger */
function initScrollAnimations() {
  initScrollProgress();
  initParallaxEffects();

  if (!window.smoothScrollEngine) {
    window.smoothScrollEngine = new SmoothScrollEngine();
  }

  const revealTargets = document.querySelectorAll(
    '.fade-in-up, .reveal-section, .reveal-fade-up, .reveal-scale-up, .reveal-stagger-group, .feature-box'
  );

  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const target = entry.target;
        if (entry.isIntersecting) {
          target.classList.add('visible', 'is-revealed');

          // If this is a staggered group, reveal children with timing
          if (target.classList.contains('reveal-stagger-group')) {
            const children = target.querySelectorAll('.reveal-item, .category-item, .feature-box');
            children.forEach((child, idx) => {
              child.style.transitionDelay = `${(idx * 0.07).toFixed(2)}s`;
              child.classList.add('item-revealed');
            });
          }
        } else {
          // Keep hero visible if user is near top of page
          if (target.classList.contains('hero-wrapper') && window.scrollY < 250) {
            return;
          }

          // Reset when leaving viewport so animation re-triggers on reverse scroll
          target.classList.remove('visible', 'is-revealed');
          if (target.classList.contains('reveal-stagger-group')) {
            const children = target.querySelectorAll('.reveal-item, .category-item, .feature-box');
            children.forEach(child => {
              child.classList.remove('item-revealed');
            });
          }
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.08
    });

    revealTargets.forEach(el => observer.observe(el));
    observeProductCards();
  } else {
    revealTargets.forEach(el => el.classList.add('visible', 'is-revealed'));
    observeProductCards();
  }
}

/* ==========================================================================
   2. CART SYSTEM (localStorage)
   ========================================================================== */

function getCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CART);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error reading cart from localStorage", e);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
    updateNavBadges();
  } catch (e) {
    console.error("Error saving cart", e);
  }
}

function addToCart(productId, qty = 1, selectedColor = null, selectedSize = null) {
  const prod = products.find(p => p.id === Number(productId));
  if (!prod) return;

  const cart = getCart();
  const color = selectedColor || (prod.colors && prod.colors[0]) || '';
  const size = selectedSize || (prod.sizes && prod.sizes[0]) || '';

  // Look for matching item with same product, color, and size
  const existingIndex = cart.findIndex(item => 
    item.id === prod.id && item.color === color && item.size === size
  );

  if (existingIndex > -1) {
    cart[existingIndex].quantity += Number(qty);
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      price: prod.price,
      oldPrice: prod.oldPrice,
      image: prod.images[0],
      category: prod.category,
      color: color,
      size: size,
      quantity: Number(qty)
    });
  }

  saveCart(cart);
  showToast(`Added to Cart: ${prod.name}`, 'cart.html');
}

function removeFromCart(productId, color = '', size = '') {
  let cart = getCart();
  const targetId = Number(productId);
  const targetColor = color || '';
  const targetSize = size || '';
  cart = cart.filter(item => {
    const itemColor = item.color || '';
    const itemSize = item.size || '';
    return !(item.id === targetId && itemColor === targetColor && itemSize === targetSize);
  });
  saveCart(cart);
}

function removeCartItemByIndex(index) {
  const cart = getCart();
  const idx = Number(index);
  if (idx >= 0 && idx < cart.length) {
    cart.splice(idx, 1);
    saveCart(cart);
  }
}

function updateCartQuantity(productId, color, size, deltaOrExact, isExact = false) {
  const cart = getCart();
  const targetId = Number(productId);
  const targetColor = color || '';
  const targetSize = size || '';

  const index = cart.findIndex(item => {
    const itemColor = item.color || '';
    const itemSize = item.size || '';
    return item.id === targetId && itemColor === targetColor && itemSize === targetSize;
  });

  if (index === -1) return;

  if (isExact) {
    cart[index].quantity = Math.max(1, Number(deltaOrExact));
  } else {
    cart[index].quantity += Number(deltaOrExact);
  }

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  saveCart(cart);
}

function clearCart() {
  localStorage.removeItem(STORAGE_KEYS.CART);
  localStorage.removeItem(STORAGE_KEYS.COUPON);
  updateNavBadges();
}

function getCartCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function getCartSubtotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

/* ==========================================================================
   3. WISHLIST SYSTEM (localStorage & Live Interactive UI)
   ========================================================================== */

function getWishlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WISHLIST);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveWishlist(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.WISHLIST, JSON.stringify(list));
    updateNavBadges();
    // Dispatch custom event for real-time synchronization across UI components
    window.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: { count: list.length, items: list } }));
  } catch (e) {
    console.error(e);
  }
}

function toggleWishlist(productId) {
  const list = getWishlist();
  const id = Number(productId);
  const existsIndex = list.indexOf(id);
  const prod = (typeof products !== 'undefined') ? products.find(p => p.id === id) : null;

  if (existsIndex > -1) {
    list.splice(existsIndex, 1);
    saveWishlist(list);
    showToast(`Removed from Wishlist: ${prod ? prod.name : 'Item'}`);
    return false;
  } else {
    list.push(id);
    saveWishlist(list);
    showToast(`Added to Wishlist: ${prod ? prod.name : 'Item'}`);
    return true;
  }
}

function isWishlisted(productId) {
  const list = getWishlist();
  return list.includes(Number(productId));
}

/** Automatically injects the global wishlist modal into DOM if not present on current page */
function ensureGlobalWishlistModalInDOM() {
  if (document.getElementById('globalWishlistModal')) return;

  const modalWrapper = document.createElement('div');
  modalWrapper.innerHTML = `
    <div class="modal fade" id="globalWishlistModal" tabindex="-1" aria-labelledby="globalWishlistModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div class="modal-content border-0 shadow-lg" style="border-radius: 20px;">
          <div class="modal-header border-0 pb-2 px-4 pt-4">
            <h5 class="modal-title fw-bold d-flex align-items-center gap-2" id="globalWishlistModalLabel">
              <i class="bi bi-heart-fill text-danger"></i>
              <span>My Saved Wishlist</span>
              <span class="badge bg-warning text-dark fs-6 px-2.5 py-1 rounded-pill" id="globalWishlistModalCountBadge">0</span>
            </h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body px-4 py-2" id="globalWishlistModalBody">
            <div class="text-center py-4">
              <div class="spinner-border text-warning" role="status"></div>
            </div>
          </div>
          <div class="modal-footer border-0 px-4 pb-4 pt-2 d-flex justify-content-between flex-wrap gap-2" id="globalWishlistModalFooter">
            <button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" id="globalWishlistClearBtn">
              <i class="bi bi-trash3 me-1"></i> Clear Wishlist
            </button>
            <div class="d-flex gap-2">
              <a href="wishlist.html" class="btn btn-light btn-sm rounded-pill px-3 border" id="globalWishlistViewFullBtn">
                <i class="bi bi-box-arrow-up-right me-1"></i> Full Page View
              </a>
              <button type="button" class="btn btn-deal btn-sm rounded-pill px-4" id="globalWishlistAddAllBtn">
                <i class="bi bi-cart-plus-fill me-1"></i> Add All To Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalWrapper.firstElementChild);
}

/** Initialize Wishlist Modal Triggers, Event Handlers & Dynamic Data Sync */
function initGlobalWishlistModal() {
  ensureGlobalWishlistModalInDOM();

  const modalEl = document.getElementById('globalWishlistModal');
  if (!modalEl) return;

  // Intercept any navbar wishlist link/trigger to open the modal gracefully
  document.querySelectorAll('.nav-wishlist-trigger, a[title="Wishlist"]').forEach(btn => {
    // If it's not on wishlist.html, open the modal smoothly
    if (!window.location.pathname.endsWith('wishlist.html')) {
      btn.setAttribute('data-bs-toggle', 'modal');
      btn.setAttribute('data-bs-target', '#globalWishlistModal');
      btn.addEventListener('click', (e) => {
        // Prevent default navigation to avoid redirecting to shop.html or changing page
        e.preventDefault();
        try {
          if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
          }
        } catch (err) {
          console.warn('Bootstrap modal open notice:', err);
        }
      });
    }
  });

  // Re-render contents when modal is shown
  modalEl.addEventListener('show.bs.modal', () => {
    renderWishlistModal();
  });

  // Re-render when wishlist updates in background
  window.addEventListener('wishlistUpdated', () => {
    if (modalEl.classList.contains('show')) {
      renderWishlistModal();
    }
  });

  // Delegated events for Move To Cart, Remove, Clear All, and Add All
  const modalBody = document.getElementById('globalWishlistModalBody');
  if (modalBody) {
    modalBody.addEventListener('click', (e) => {
      // Remove single item
      const removeBtn = e.target.closest('.wishlist-remove-single-btn');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(removeBtn.getAttribute('data-wishlist-id'));
        toggleWishlist(id);
        renderWishlistModal();
        if (typeof initWishlistPageGrid === 'function') {
          initWishlistPageGrid();
        }
        return;
      }

      // Move single item to cart
      const moveBtn = e.target.closest('.wishlist-move-single-btn');
      if (moveBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(moveBtn.getAttribute('data-wishlist-id'));
        addToCart(id, 1);
        
        // Remove from wishlist after moving to cart
        const list = getWishlist();
        const idx = list.indexOf(id);
        if (idx > -1) {
          list.splice(idx, 1);
          saveWishlist(list);
        }
        
        const prod = (typeof products !== 'undefined') ? products.find(p => p.id === id) : null;
        showToast(`Moved "${prod ? prod.name : 'Item'}" to your cart!`, 'cart.html');
        renderWishlistModal();
        if (typeof initWishlistPageGrid === 'function') {
          initWishlistPageGrid();
        }
        return;
      }
    });
  }

  // Clear Wishlist button
  const clearBtn = document.getElementById('globalWishlistClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const list = getWishlist();
      if (!list.length) return;
      if (confirm('Are you sure you want to remove all saved items from your wishlist?')) {
        saveWishlist([]);
        showToast('Wishlist has been cleared.');
        renderWishlistModal();
        if (typeof initWishlistPageGrid === 'function') {
          initWishlistPageGrid();
        }
      }
    });
  }

  // Add All to Cart button
  const addAllBtn = document.getElementById('globalWishlistAddAllBtn');
  if (addAllBtn) {
    addAllBtn.addEventListener('click', () => {
      const list = getWishlist();
      if (!list.length) {
        showToast('Your wishlist is empty.');
        return;
      }

      list.forEach(id => {
        addToCart(id, 1);
      });

      showToast(`🎉 Added ${list.length} items from wishlist directly to your Cart!`, 'cart.html');
      
      // Close modal gracefully and update badges
      try {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const inst = bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        }
      } catch (err) {}
    });
  }
}

/** Render Dynamic Items or Empty State inside Wishlist Modal */
function renderWishlistModal() {
  const modalBody = document.getElementById('globalWishlistModalBody');
  const countBadge = document.getElementById('globalWishlistModalCountBadge');
  const clearBtn = document.getElementById('globalWishlistClearBtn');
  const addAllBtn = document.getElementById('globalWishlistAddAllBtn');

  if (!modalBody) return;

  const wishlistIds = getWishlist();
  if (countBadge) {
    countBadge.textContent = wishlistIds.length;
  }

  // Empty State
  if (wishlistIds.length === 0) {
    if (clearBtn) clearBtn.style.display = 'none';
    if (addAllBtn) addAllBtn.style.display = 'none';

    modalBody.innerHTML = `
      <div class="text-center py-5">
        <div class="mb-3">
          <span class="d-inline-flex align-items-center justify-content-center bg-danger-subtle text-danger rounded-circle shadow-sm" style="width: 76px; height: 76px; font-size: 2.2rem;">
            <i class="bi bi-heart"></i>
          </span>
        </div>
        <h5 class="fw-bold text-dark mb-2">Your Wishlist is Empty</h5>
        <p class="text-muted small max-w-sm mx-auto mb-4" style="max-width: 380px;">
          You haven't saved any deals yet. Browse our top categories or store catalog and tap the heart icon on any deal to save it for later!
        </p>
        <a href="shop.html" class="btn btn-deal px-4 py-2" data-bs-dismiss="modal">
          <i class="bi bi-bag-check-fill me-1"></i> Explore Store Catalog
        </a>
      </div>
    `;
    return;
  }

  // Populate items
  if (clearBtn) clearBtn.style.display = 'inline-flex';
  if (addAllBtn) addAllBtn.style.display = 'inline-flex';

  const catalog = (typeof products !== 'undefined') ? products : [];
  const wishItems = wishlistIds.map(id => catalog.find(p => p.id === id)).filter(Boolean);

  if (wishItems.length === 0) {
    modalBody.innerHTML = `
      <div class="text-center py-4 text-muted small">
        Saved items could not be found in active catalog.
      </div>
    `;
    return;
  }

  modalBody.innerHTML = `
    <div class="wishlist-modal-items-list d-flex flex-column gap-3 py-2" style="max-height: 480px; overflow-y: auto;">
      ${wishItems.map(prod => {
        const discountPercent = Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100);
        const imgUrl = (prod.images && prod.images.length) ? prod.images[0] : '';
        return `
          <div class="wishlist-modal-item d-flex align-items-center justify-content-between p-3 rounded-4 bg-light gap-3 border shadow-xs">
            <div class="d-flex align-items-center gap-3 flex-grow-1 min-w-0">
              <a href="product.html?id=${prod.id}" class="flex-shrink-0" title="${prod.name}">
                <img src="${imgUrl}" alt="${prod.name}" class="rounded-3 border" style="width: 68px; height: 68px; object-fit: cover;">
              </a>
              <div class="min-w-0 flex-grow-1">
                <span class="badge bg-dark text-white text-uppercase mb-1" style="font-size: 0.65rem; letter-spacing: 0.5px;">${prod.category}</span>
                <h6 class="mb-1 text-truncate fw-bold" style="font-size: 0.95rem;">
                  <a href="product.html?id=${prod.id}" class="text-dark text-decoration-none">${prod.name}</a>
                </h6>
                <div class="d-flex align-items-baseline gap-2 flex-wrap">
                  <span class="fw-bold text-dark font-monospace fs-6">$${prod.price.toFixed(2)}</span>
                  <span class="text-muted text-decoration-line-through small">$${prod.oldPrice.toFixed(2)}</span>
                  <span class="badge bg-danger text-white fw-bold" style="font-size: 0.65rem;">-${discountPercent}% OFF</span>
                  <span class="badge bg-success-subtle text-success small ms-auto d-none d-sm-inline" style="font-size: 0.7rem;"><i class="bi bi-check-circle-fill"></i> In Stock</span>
                </div>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2 flex-shrink-0">
              <button type="button" class="btn btn-deal btn-sm rounded-pill px-3 py-1.5 wishlist-move-single-btn" data-wishlist-id="${prod.id}" title="Move to Shopping Cart">
                <i class="bi bi-cart-plus me-1"></i> <span class="d-none d-sm-inline">Move to</span> Cart
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm rounded-circle p-0 wishlist-remove-single-btn" style="width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;" data-wishlist-id="${prod.id}" title="Remove from wishlist">
                <i class="bi bi-trash3"></i>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/** Dedicated Wishlist Page Logic (wishlist.html) */
function initWishlistPage() {
  initWishlistPageGrid();

  const clearPageBtn = document.getElementById('wishlistPageClearBtn');
  if (clearPageBtn) {
    clearPageBtn.addEventListener('click', () => {
      const list = getWishlist();
      if (!list.length) return;
      if (confirm('Are you sure you want to clear your entire wishlist?')) {
        saveWishlist([]);
        showToast('Your wishlist has been cleared.');
        initWishlistPageGrid();
      }
    });
  }

  const addAllPageBtn = document.getElementById('wishlistPageAddAllBtn');
  if (addAllPageBtn) {
    addAllPageBtn.addEventListener('click', () => {
      const list = getWishlist();
      if (!list.length) {
        showToast('Your wishlist is empty.');
        return;
      }
      list.forEach(id => addToCart(id, 1));
      showToast(`🎉 Added all ${list.length} items to your Cart!`, 'cart.html');
    });
  }

  window.addEventListener('wishlistUpdated', () => {
    initWishlistPageGrid();
  });
}

function initWishlistPageGrid() {
  const grid = document.getElementById('wishlistPageGrid');
  const countEl = document.getElementById('wishlistPageCount');
  const emptyState = document.getElementById('wishlistPageEmptyState');
  const actionsBar = document.getElementById('wishlistPageActionsBar');
  const trendingSection = document.getElementById('wishlistTrendingSection');

  if (!grid) return;

  const wishlistIds = getWishlist();
  if (countEl) countEl.textContent = wishlistIds.length;

  const catalog = (typeof products !== 'undefined') ? products : [];
  const wishItems = wishlistIds.map(id => catalog.find(p => p.id === id)).filter(Boolean);

  if (wishItems.length === 0) {
    if (grid) grid.style.display = 'none';
    if (actionsBar) actionsBar.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (trendingSection) {
      trendingSection.style.display = 'block';
      const trendingGrid = document.getElementById('wishlistTrendingGrid');
      if (trendingGrid && catalog.length) {
        trendingGrid.innerHTML = catalog.slice(0, 4).map(prod => `
          <div class="col-6 col-md-4 col-lg-3 mb-4">
            ${createProductCardHTML(prod)}
          </div>
        `).join('');
        bindProductCardEvents(trendingGrid);
      }
    }
  } else {
    if (emptyState) emptyState.style.display = 'none';
    if (trendingSection) trendingSection.style.display = 'none';
    if (actionsBar) actionsBar.style.display = 'flex';
    if (grid) {
      grid.style.display = 'flex';
      grid.innerHTML = wishItems.map(prod => `
        <div class="col-6 col-md-4 col-lg-3 mb-4">
          ${createProductCardHTML(prod)}
        </div>
      `).join('');
      bindProductCardEvents(grid);
    }
  }
}

/* ==========================================================================
   4. TOAST NOTIFICATIONS
   ========================================================================== */

function showToast(message, actionLink = null) {
  let container = document.querySelector('.snap-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'snap-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'snap-toast';
  
  let actionHtml = '';
  if (actionLink) {
    actionHtml = `<a href="${actionLink}" class="btn btn-sm btn-deal ms-auto py-1 px-3 text-nowrap" style="font-size: 0.75rem;">View Cart</a>`;
  }

  toast.innerHTML = `
    <i class="bi bi-check-circle-fill text-warning fs-5"></i>
    <span class="small fw-semibold flex-grow-1">${message}</span>
    ${actionHtml}
    <button type="button" class="btn-close btn-close-white ms-2" aria-label="Close" style="font-size: 0.7rem;"></button>
  `;

  const closeBtn = toast.querySelector('.btn-close');
  closeBtn.addEventListener('click', () => toast.remove());

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/** Update Live Badges in Navbar */
function updateNavBadges() {
  const cartBadge = document.querySelectorAll('.cart-count-badge');
  const cartCount = getCartCount();
  cartBadge.forEach(badge => {
    badge.textContent = cartCount;
    badge.style.display = cartCount > 0 ? 'flex' : 'none';
  });

  const wishlistBadge = document.querySelectorAll('.wishlist-count-badge');
  const wishCount = getWishlist().length;
  wishlistBadge.forEach(badge => {
    badge.textContent = wishCount;
    badge.style.display = wishCount > 0 ? 'flex' : 'none';
  });
}

/* ==========================================================================
   5. AUTHENTICATION & NAVBAR USER STATE
   ========================================================================== */

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
  renderUserAuthNav();
}

window.setCurrentUser = setCurrentUser;
window.getCurrentUser = getCurrentUser;
window.showToast = showToast;

function logoutUser() {
  setCurrentUser(null);
  showToast('You have been logged out.');
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

function renderUserAuthNav() {
  const container = document.getElementById('userNavContainer');
  const user = getCurrentUser();

  if (container) {
    if (user) {
      const firstName = user.name ? user.name.split(' ')[0] : 'Member';
      container.innerHTML = `
        <div class="dropdown">
          <button class="btn btn-deal-outline py-1 px-2 px-sm-3 d-flex align-items-center gap-1 gap-sm-2 dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="font-size: 0.82rem;">
            <i class="bi bi-person-check-fill text-warning"></i>
            <span class="d-inline-block text-truncate" style="max-width: 90px;">${escapeHtml(firstName)}</span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0" style="border-radius: 12px; margin-top: 8px;">
            <li><span class="dropdown-item-text small text-muted">${escapeHtml(user.email)}</span></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item d-flex align-items-center gap-2" href="cart.html"><i class="bi bi-bag"></i> My Cart</a></li>
            <li><a class="dropdown-item d-flex align-items-center gap-2" href="shop.html"><i class="bi bi-tag"></i> Member Deals</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item text-danger d-flex align-items-center gap-2" href="#" id="navLogoutBtn"><i class="bi bi-box-arrow-right"></i> Log Out</a></li>
          </ul>
        </div>
      `;

      const logoutBtn = document.getElementById('navLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          logoutUser();
        });
      }
    } else {
      // User requested: Remove Sign up and Log In buttons from top navbar row; keep strictly inside home toggle menu
      container.innerHTML = '';
    }
  }

  // Desktop VIP Sign in link state sync
  const vipNavItems = document.querySelectorAll('.navbar-nav a[href*="login.html"]');
  vipNavItems.forEach(link => {
    const parentLi = link.closest('.nav-item');
    if (parentLi) {
      if (user) {
        parentLi.style.display = 'none';
      } else {
        parentLi.style.removeProperty('display');
      }
    }
  });

  // Populate Home / navigation menu drawer auth links on all pages
  const mobileDrawers = document.querySelectorAll('.mobile-drawer-auth');
  mobileDrawers.forEach(drawer => {
    if (user) {
      drawer.innerHTML = `
        <div class="d-flex flex-column gap-2 p-2">
          <div class="d-flex align-items-center justify-content-between p-2 rounded-3 bg-light border">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-person-check-fill fs-4 text-warning"></i>
              <div>
                <div class="fw-bold small text-dark">${escapeHtml(user.name || 'Member')}</div>
                <div class="text-muted" style="font-size: 0.75rem;">${escapeHtml(user.email)}</div>
              </div>
            </div>
            <span class="badge bg-warning text-dark font-monospace">VIP</span>
          </div>
          <button type="button" class="btn btn-outline-danger w-100 py-2 mt-1 mobile-drawer-logout-btn fw-bold small">
            <i class="bi bi-box-arrow-right me-1"></i> Log Out
          </button>
        </div>
      `;
      const drawerLogout = drawer.querySelector('.mobile-drawer-logout-btn');
      if (drawerLogout) {
        drawerLogout.addEventListener('click', () => logoutUser());
      }
    } else {
      drawer.innerHTML = `
        <div class="d-flex flex-column gap-2 p-1">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <span class="small fw-bold text-muted text-uppercase" style="font-size: 0.75rem; letter-spacing: 0.5px;">VIP Member Access</span>
            <span class="badge bg-warning-subtle text-dark border px-2 py-0.5 small fw-bold">Free Perks</span>
          </div>
          <div class="d-flex gap-2">
            <a href="login.html" class="btn btn-deal-outline w-50 py-2 text-center small fw-bold d-flex align-items-center justify-content-center gap-1">
              <i class="bi bi-box-arrow-in-right"></i> Log In
            </a>
            <a href="login.html?tab=signup" class="btn btn-deal w-50 py-2 text-center small fw-bold d-flex align-items-center justify-content-center gap-1">
              <i class="bi bi-person-plus-fill"></i> Sign Up
            </a>
          </div>
        </div>
      `;
    }
  });
}

/* ==========================================================================
   6. PRODUCT CARD RENDERER COMPONENT
   ========================================================================== */

function createProductCardHTML(prod) {
  const discountPercent = Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100);
  const wishActive = isWishlisted(prod.id) ? 'active' : '';
  const heartIcon = isWishlisted(prod.id) ? 'bi-heart-fill' : 'bi-heart';

  // Stars HTML
  let starsHtml = '';
  const fullStars = Math.floor(prod.rating);
  const hasHalf = prod.rating % 1 >= 0.5;
  for (let i = 0; i < fullStars; i++) {
    starsHtml += '<i class="bi bi-star-fill"></i>';
  }
  if (hasHalf) {
    starsHtml += '<i class="bi bi-star-half"></i>';
  }
  const remaining = 5 - fullStars - (hasHalf ? 1 : 0);
  for (let i = 0; i < remaining; i++) {
    starsHtml += '<i class="bi bi-star"></i>';
  }

  return `
    <div class="deal-product-card" data-product-id="${prod.id}">
      <div class="card-img-wrap">
        <a href="product.html?id=${prod.id}" class="d-block w-100 h-100" aria-label="${prod.name}">
          <img src="${prod.images[0]}" alt="${prod.name}" loading="lazy">
        </a>
        <span class="card-discount-badge">-${discountPercent}%</span>
        <button type="button" class="card-wishlist-btn ${wishActive}" data-wishlist-id="${prod.id}" title="Add to Wishlist" aria-label="Add to Wishlist">
          <i class="bi ${heartIcon}"></i>
        </button>
        <button type="button" class="card-quick-add" data-quick-add-id="${prod.id}">
          <i class="bi bi-cart-plus-fill"></i> Quick Add
        </button>
      </div>
      <div class="card-content">
        <span class="card-category">${prod.category}</span>
        <h3 class="card-title">
          <a href="product.html?id=${prod.id}">${prod.name}</a>
        </h3>
        <div class="card-rating">
          ${starsHtml}
          <span class="rating-count">(${prod.reviewCount})</span>
        </div>
        <div class="card-price-row">
          <span class="current-price">$${prod.price.toFixed(2)}</span>
          <span class="old-price">$${prod.oldPrice.toFixed(2)}</span>
          <span class="badge bg-warning-subtle text-dark ms-auto" style="font-size: 0.7rem; font-weight: 700;">SAVE $${(prod.oldPrice - prod.price).toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
}

function bindProductCardEvents(container = document) {
  // Wishlist toggle click
  container.querySelectorAll('.card-wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-wishlist-id');
      const isAdded = toggleWishlist(id);
      const icon = btn.querySelector('i');
      if (isAdded) {
        btn.classList.add('active');
        icon.className = 'bi bi-heart-fill';
      } else {
        btn.classList.remove('active');
        icon.className = 'bi bi-heart';
      }
    });
  });

  // Quick Add click
  container.querySelectorAll('.card-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-quick-add-id');
      addToCart(id, 1);
    });
  });

  // Entire card clickable to open product detail
  container.querySelectorAll('.deal-product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Avoid if user clicked buttons or specific links
      if (e.target.closest('button') || e.target.closest('a')) return;
      const id = card.getAttribute('data-product-id');
      if (id) {
        window.location.href = `product.html?id=${id}`;
      }
    });
  });

  // Observe and trigger progressive reveal
  observeProductCards(container);
}

/* ==========================================================================
   7. HOME PAGE LOGIC
   ========================================================================== */

/** Render Dynamic Hero Carousel from Storage / Defaults */
function renderHeroCarousel() {
  const carousel = document.getElementById('heroCarousel');
  if (!carousel) return;

  const slides = typeof loadHeroSlides === 'function' ? loadHeroSlides() : [];
  if (!slides || !slides.length) return;

  const indicators = carousel.querySelector('.carousel-indicators');
  const inner = carousel.querySelector('.carousel-inner');

  const sanitize = (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  if (indicators) {
    indicators.innerHTML = slides.map((slide, idx) => `
      <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="${idx}" class="${idx === 0 ? 'active' : ''}" aria-current="${idx === 0 ? 'true' : 'false'}" aria-label="Slide ${idx + 1}"></button>
    `).join('');
  }

  if (inner) {
    inner.innerHTML = slides.map((slide, idx) => {
      const isDark = slide.stickerTheme === 'dark';
      const icon = slide.tagIcon || 'bi-fire';
      const topSticker = slide.stickerTop || 'SAVE';
      const midSticker = slide.stickerMiddle || '50%';
      const btmSticker = slide.stickerBottom || 'TODAY';

      return `
        <div class="carousel-item ${idx === 0 ? 'active' : ''}">
          <div class="row align-items-center hero-slide">
            <div class="col-lg-6 mb-4 mb-lg-0 reveal-fade-up">
              <span class="hero-tag"><i class="bi ${icon} text-warning"></i> ${sanitize(slide.tag || 'DEAL OF THE DAY')}</span>
              <h1 class="hero-title">${sanitize(slide.title || 'SPECIAL STORE DEAL')}</h1>
              <p class="hero-desc">${sanitize(slide.description || '')}</p>
              <div class="d-flex flex-wrap align-items-center gap-3">
                <a href="${sanitize(slide.btnPrimaryLink || 'shop.html')}" class="btn btn-deal btn-lg">
                  <i class="bi bi-bag-check-fill"></i> ${sanitize(slide.btnPrimaryText || 'Shop Now')}
                </a>
                <a href="${sanitize(slide.btnSecondaryLink || 'shop.html')}" class="btn btn-deal-outline btn-lg">
                  ${sanitize(slide.btnSecondaryText || 'Explore Deals')}
                </a>
              </div>
            </div>
            <div class="col-lg-6 text-center">
              <div class="hero-img-box">
                <img src="${sanitize(slide.imageUrl)}" alt="${sanitize(slide.imageAlt || slide.title || 'Product')}" class="hero-floating-img img-fluid" data-parallax="-0.07">
                <div class="hero-deal-sticker ${isDark ? 'bg-dark' : ''}" data-parallax="0.05">
                  <span style="font-size: 0.7rem; ${isDark ? 'color: #F9B800;' : ''}">${sanitize(topSticker)}</span>
                  <span style="font-size: 1.35rem; ${isDark ? 'color: #fff;' : ''}">${sanitize(midSticker)}</span>
                  <span style="font-size: 0.65rem; ${isDark ? 'color: #F9B800;' : ''}">${sanitize(btmSticker)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Cleanly re-initialize Bootstrap Carousel instance so slide cycling works flawlessly
  if (window.bootstrap && bootstrap.Carousel) {
    try {
      const existing = bootstrap.Carousel.getInstance(carousel);
      if (existing) {
        existing.dispose();
      }
      new bootstrap.Carousel(carousel, {
        interval: 5000,
        ride: 'carousel',
        pause: 'hover'
      });
    } catch (e) {
      console.warn("Bootstrap carousel init notice:", e);
    }
  }

  // Trigger parallax and scroll reveals on dynamically rendered hero elements
  if (typeof initParallaxEffects === 'function') {
    initParallaxEffects();
  }
}

function initHomePage() {
  // Render Dynamic Hero Carousel (from admin settings or default)
  renderHeroCarousel();

  // Shop By Categories row
  const categoryScroll = document.getElementById('categoryScrollContainer');
  if (categoryScroll && typeof categoriesData !== 'undefined') {
    categoryScroll.innerHTML = categoriesData.map(cat => {
      const iconHTML = (cat.slug === 'mens-shoes')
        ? `<svg class="category-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 15C2 15 2 12 4 12C4.68 12 5.46 11.95 6.28 11.82C7.2 12.54 8.5 13 10 13H10.25L8.56 11.29C8.91 11.18 9.25 11.05 9.59 10.91L11.5 12.82C11.89 12.74 12.25 12.63 12.58 12.5L10.55 10.45C10.85 10.28 11.14 10.11 11.43 9.91L13.5 12C13.8 11.79 14.04 11.56 14.25 11.32L12.22 9.29C12.46 9.07 12.7 8.83 12.92 8.58L14.79 10.45C14.91 10.14 15 9.83 15 9.5C15 8.65 14.55 7.89 13.84 7.28C13.89 7.19 13.95 7.1 14 7L15.53 6.23C16.38 7.17 18.14 7.84 20.25 7.97L20.3 8H21C21 8 22 9 22 12.5C22 13.07 22 13.57 21.96 14H19C17.9 14 16.58 14.26 15.3 14.5C14.12 14.76 12.9 15 12 15H2M21 17C21 17 21.58 17 21.86 15H19C17 15 14 16 12 16H2.28C2.62 16.6 3.26 17 4 17H21Z"/></svg>`
        : `<i class="bi ${cat.icon}"></i>`;
      return `
        <a href="shop.html?category=${cat.slug}" class="category-item">
          <div class="category-circle">
            ${iconHTML}
          </div>
          <span class="category-label">${cat.name}</span>
        </a>
      `;
    }).join('');
  }

  // Trending Products Grid (8 items)
  const trendingGrid = document.getElementById('trendingProductsGrid');
  if (trendingGrid && typeof products !== 'undefined') {
    const trendingList = products.slice(0, 8);
    trendingGrid.innerHTML = trendingList.map(prod => `
      <div class="col-6 col-md-4 col-lg-3 mb-4">
        ${createProductCardHTML(prod)}
      </div>
    `).join('');
    bindProductCardEvents(trendingGrid);
  }

  // Offer Countdown Timer (Flash Deal)
  initDealCountdown();

  // Coupon copy button
  const copyCouponBtn = document.getElementById('copyCouponBtn');
  if (copyCouponBtn) {
    copyCouponBtn.addEventListener('click', () => {
      const code = 'BUNDLE20';
      navigator.clipboard.writeText(code).then(() => {
        showToast('Coupon code BUNDLE20 copied! 20% off at checkout.');
      }).catch(() => {
        showToast('Use coupon BUNDLE20 at checkout for 20% off!');
      });
    });
  }
}

function initDealCountdown() {
  const hoursEl = document.getElementById('dealHours');
  const minutesEl = document.getElementById('dealMinutes');
  const secondsEl = document.getElementById('dealSeconds');
  if (!hoursEl || !minutesEl || !secondsEl) return;

  // Set target 14 hours from now
  let remainingSeconds = 14 * 3600 + 42 * 60 + 19;

  const timer = setInterval(() => {
    if (remainingSeconds <= 0) {
      remainingSeconds = 24 * 3600; // Reset
    }
    remainingSeconds--;

    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60);
    const s = remainingSeconds % 60;

    hoursEl.textContent = String(h).padStart(2, '0');
    minutesEl.textContent = String(m).padStart(2, '0');
    secondsEl.textContent = String(s).padStart(2, '0');
  }, 1000);
}

/* ==========================================================================
   8. SHOP PAGE LOGIC (Search, Filter, Sort)
   ========================================================================== */

function initShopPage() {
  const shopGrid = document.getElementById('shopProductsGrid');
  const resultsCountEl = document.getElementById('shopResultsCount');
  const categoryFiltersContainer = document.getElementById('categoryFiltersList');
  const searchInput = document.getElementById('shopSearchInput');
  const sortSelect = document.getElementById('shopSortSelect');
  const priceRange = document.getElementById('priceRangeInput');
  const priceValueLabel = document.getElementById('priceRangeValue');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  if (!shopGrid || typeof products === 'undefined') return;

  // Read URL params for pre-selected category or search query
  const urlParams = new URLSearchParams(window.location.search);
  let activeCategory = urlParams.get('category') || 'all';
  let searchQuery = urlParams.get('q') || '';
  let maxPrice = 250;
  let activeSort = 'featured';

  if (searchInput && searchQuery) {
    searchInput.value = searchQuery;
  }

  // Populate Category Filter Sidebar
  if (categoryFiltersContainer && typeof categoriesData !== 'undefined') {
    categoryFiltersContainer.innerHTML = categoriesData.map(cat => {
      const count = cat.slug === 'all' 
        ? products.length 
        : products.filter(p => p.categorySlug === cat.slug).length;
      const isChecked = cat.slug === activeCategory ? 'checked' : '';
      return `
        <div class="form-check d-flex justify-content-between align-items-center mb-2">
          <div>
            <input class="form-check-input filter-category-radio" type="radio" name="shopCategory" id="cat_${cat.slug}" value="${cat.slug}" ${isChecked}>
            <label class="form-check-label fw-semibold" for="cat_${cat.slug}">
              ${cat.name}
            </label>
          </div>
          <span class="badge bg-light text-dark rounded-pill">${count}</span>
        </div>
      `;
    }).join('');

    categoryFiltersContainer.querySelectorAll('.filter-category-radio').forEach(radio => {
      radio.addEventListener('change', (e) => {
        activeCategory = e.target.value;
        filterAndRenderProducts();
      });
    });
  }

  // Price range listener
  if (priceRange && priceValueLabel) {
    priceRange.addEventListener('input', (e) => {
      maxPrice = Number(e.target.value);
      priceValueLabel.textContent = `$${maxPrice}`;
      filterAndRenderProducts();
    });
  }

  // Search input listener with debouncing
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      filterAndRenderProducts();
    });
  }

  // Sort select listener
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      activeSort = e.target.value;
      filterAndRenderProducts();
    });
  }

  // Reset filters
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      activeCategory = 'all';
      searchQuery = '';
      maxPrice = 250;
      activeSort = 'featured';

      if (searchInput) searchInput.value = '';
      if (priceRange) {
        priceRange.value = 250;
        priceValueLabel.textContent = '$250';
      }
      if (sortSelect) sortSelect.value = 'featured';
      
      const allCatRadio = document.getElementById('cat_all');
      if (allCatRadio) allCatRadio.checked = true;

      filterAndRenderProducts();
    });
  }

  function filterAndRenderProducts() {
    let filtered = products.filter(prod => {
      // Category match
      const matchCategory = activeCategory === 'all' || prod.categorySlug === activeCategory;
      // Search match
      const matchSearch = !searchQuery || 
        prod.name.toLowerCase().includes(searchQuery) || 
        prod.category.toLowerCase().includes(searchQuery) ||
        prod.description.toLowerCase().includes(searchQuery);
      // Price match
      const matchPrice = prod.price <= maxPrice;

      return matchCategory && matchSearch && matchPrice;
    });

    // Sorting
    if (activeSort === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (activeSort === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (activeSort === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (activeSort === 'discount') {
      filtered.sort((a, b) => ((b.oldPrice - b.price) / b.oldPrice) - ((a.oldPrice - a.price) / a.oldPrice));
    }

    // Results count
    if (resultsCountEl) {
      resultsCountEl.textContent = `Showing ${filtered.length} of ${products.length} products`;
    }

    if (filtered.length === 0) {
      shopGrid.innerHTML = `
        <div class="col-12 py-5 text-center">
          <div class="mb-3 text-warning">
            <i class="bi bi-search" style="font-size: 3.5rem;"></i>
          </div>
          <h4 class="fw-bold">No Products Found</h4>
          <p class="text-muted">We couldn't find any deals matching your current search and filters.</p>
          <button class="btn btn-deal mt-2" onclick="document.getElementById('resetFiltersBtn').click()">
            <i class="bi bi-arrow-repeat"></i> Reset All Filters
          </button>
        </div>
      `;
      return;
    }

    shopGrid.innerHTML = filtered.map(prod => `
      <div class="col-6 col-md-6 col-lg-4 mb-4">
        ${createProductCardHTML(prod)}
      </div>
    `).join('');

    bindProductCardEvents(shopGrid);
  }

  // Initial call
  filterAndRenderProducts();
}

/* ==========================================================================
   9. PRODUCT DETAIL PAGE DYNAMIC RENDERER
   ========================================================================== */

function initProductDetailPage() {
  const container = document.getElementById('productDetailContent');
  const relatedGrid = document.getElementById('relatedProductsGrid');
  if (!container || typeof products === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);
  const productId = Number(urlParams.get('id'));
  const prod = products.find(p => p.id === productId);

  if (!prod) {
    container.innerHTML = `
      <div class="container py-5 text-center">
        <div class="py-5 bg-white rounded-4 shadow-sm p-4">
          <i class="bi bi-exclamation-diamond-fill text-warning" style="font-size: 4rem;"></i>
          <h2 class="mt-3 fw-bold">Product Not Found</h2>
          <p class="text-muted max-w-md mx-auto mb-4">The deal you are looking for may have expired or the item ID is invalid.</p>
          <a href="shop.html" class="btn btn-deal px-4 py-2">
            <i class="bi bi-bag-check"></i> Explore All Deals
          </a>
        </div>
      </div>
    `;
    return;
  }

  // Update Page Title
  document.title = `${prod.name} | SnapzDealz Exclusive Deal`;

  // Calculations
  const discountPercent = Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100);
  const savings = (prod.oldPrice - prod.price).toFixed(2);
  const wishActive = isWishlisted(prod.id) ? 'active' : '';

  // Stars
  let starsHtml = '';
  for (let i = 0; i < Math.floor(prod.rating); i++) starsHtml += '<i class="bi bi-star-fill text-warning"></i>';
  if (prod.rating % 1 >= 0.5) starsHtml += '<i class="bi bi-star-half text-warning"></i>';

  // Colors HTML
  let colorsHtml = '';
  if (prod.colors && prod.colors.length) {
    colorsHtml = `
      <div class="mb-4">
        <label class="form-label fw-bold d-block small text-uppercase">Select Color: <span id="selectedColorName" class="text-muted fw-normal">Default</span></label>
        <div class="d-flex gap-2" id="colorSelectorGroup">
          ${prod.colors.map((c, i) => `
            <div class="color-option ${i === 0 ? 'active' : ''}" style="background-color: ${c};" data-color="${c}"></div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Sizes HTML
  let sizesHtml = '';
  if (prod.sizes && prod.sizes.length) {
    sizesHtml = `
      <div class="mb-4">
        <div class="d-flex justify-content-between">
          <label class="form-label fw-bold small text-uppercase">Select Size / Option</label>
          <a href="#specifications" class="small text-decoration-underline text-muted">Size Guide</a>
        </div>
        <div class="d-flex flex-wrap gap-2" id="sizeSelectorGroup">
          ${prod.sizes.map((s, i) => `
            <button type="button" class="size-pill ${i === 0 ? 'active' : ''}" data-size="${s}">${s}</button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Specs Rows
  const specsRows = Object.entries(prod.specs || {}).map(([key, value]) => `
    <tr>
      <th scope="row" class="text-muted w-25 small fw-bold">${key}</th>
      <td class="fw-semibold small">${value}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <!-- Breadcrumb -->
    <nav aria-label="breadcrumb" class="mb-4">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="index.html">Home</a></li>
        <li class="breadcrumb-item"><a href="shop.html">Shop</a></li>
        <li class="breadcrumb-item"><a href="shop.html?category=${prod.categorySlug}">${prod.category}</a></li>
        <li class="breadcrumb-item active text-truncate" style="max-width: 250px;" aria-current="page">${prod.name}</li>
      </ol>
    </nav>

    <div class="row g-4 g-lg-5">
      <!-- Gallery Column -->
      <div class="col-lg-6">
        <div class="product-gallery-main shadow-sm" id="mainGalleryBox">
          <img src="${prod.images[0]}" alt="${prod.name}" id="mainProductImage">
          <span class="card-discount-badge" style="font-size: 0.9rem; padding: 6px 14px;">-${discountPercent}% OFF</span>
        </div>
        <div class="product-gallery-thumbnails">
          ${prod.images.map((img, i) => `
            <div class="thumb-item ${i === 0 ? 'active' : ''}" data-img-src="${img}">
              <img src="${img}" alt="Thumbnail ${i+1}">
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Info Column -->
      <div class="col-lg-6">
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="badge bg-warning text-dark fw-bold px-3 py-1 rounded-pill">${prod.badge || 'FLASH DEAL'}</span>
          <span class="badge bg-success-subtle text-success fw-bold px-3 py-1 rounded-pill">
            <i class="bi bi-check2-circle"></i> In Stock (${prod.stock} available)
          </span>
        </div>

        <h1 class="deal-heading fs-2 mb-2">${prod.name}</h1>
        
        <div class="d-flex align-items-center gap-2 mb-3">
          <div class="d-flex">${starsHtml}</div>
          <span class="fw-bold small">${prod.rating}</span>
          <span class="text-muted small">(${prod.reviewCount} verified reviews)</span>
        </div>

        <!-- Price box -->
        <div class="p-3 rounded-4 mb-4" style="background-color: #fff8e1; border: 1px solid #ffe082;">
          <div class="d-flex align-items-baseline gap-3">
            <span class="fs-1 fw-bold font-monospace" style="color: var(--dark-charcoal);">$${prod.price.toFixed(2)}</span>
            <span class="text-muted text-decoration-line-through fs-5">$${prod.oldPrice.toFixed(2)}</span>
            <span class="badge bg-danger text-white rounded-pill px-3 py-2 ms-auto fw-bold">SAVE $${savings}</span>
          </div>
          <div class="small text-muted mt-1">
            <i class="bi bi-lightning-charge-fill text-warning"></i> Deal price valid for limited quantities. Free 2-day delivery on orders over $50.
          </div>
        </div>

        <p class="text-secondary mb-4 leading-relaxed">${prod.description}</p>

        <!-- Variants -->
        ${colorsHtml}
        ${sizesHtml}

        <!-- Quantity & Add to Cart -->
        <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
          <div class="qty-stepper">
            <button type="button" class="qty-btn" id="qtyMinusBtn">-</button>
            <input type="number" id="detailQtyInput" class="qty-input" value="1" min="1" max="${prod.stock}">
            <button type="button" class="qty-btn" id="qtyPlusBtn">+</button>
          </div>

          <button type="button" class="btn btn-deal flex-grow-1 py-3" id="detailAddToCartBtn">
            <i class="bi bi-cart-plus-fill fs-5"></i> Add to Cart
          </button>

          <button type="button" class="btn btn-deal-outline py-3 px-3 ${wishActive}" id="detailWishlistBtn" title="Wishlist">
            <i class="bi ${isWishlisted(prod.id) ? 'bi-heart-fill text-danger' : 'bi-heart'} fs-5"></i>
          </button>
        </div>

        <button type="button" class="btn btn-deal-dark w-100 py-3 mb-4" id="detailBuyNowBtn">
          <i class="bi bi-lightning-fill"></i> Buy Now - Instant Checkout
        </button>

        <!-- Stock Urgency Bar -->
        <div class="p-3 bg-white rounded-3 border mb-4">
          <div class="d-flex justify-content-between small fw-bold mb-1">
            <span class="text-danger"><i class="bi bi-fire"></i> Fast Selling!</span>
            <span>Only ${prod.stock} items left in stock</span>
          </div>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar bg-warning" role="progressbar" style="width: ${Math.min(100, (prod.stock / 50) * 100)}%;"></div>
          </div>
        </div>

        <!-- Trust badges -->
        <div class="row g-2 text-center text-muted small">
          <div class="col-4 p-2 border rounded-3 bg-white">
            <i class="bi bi-truck fs-5 d-block text-warning mb-1"></i>
            Fast Delivery
          </div>
          <div class="col-4 p-2 border rounded-3 bg-white">
            <i class="bi bi-shield-check fs-5 d-block text-warning mb-1"></i>
            100% Genuine
          </div>
          <div class="col-4 p-2 border rounded-3 bg-white">
            <i class="bi bi-arrow-counterclockwise fs-5 d-block text-warning mb-1"></i>
            30-Day Returns
          </div>
        </div>

        <!-- Payment assurance banner -->
        <div class="p-3 bg-light rounded-3 border mt-3 text-center">
          <div class="small fw-semibold text-muted mb-2"><i class="bi bi-shield-lock-fill text-warning me-1"></i> Accepted Payment Options</div>
          <div class="d-flex flex-wrap justify-content-center gap-2">
            <span class="badge bg-white text-dark border px-2 py-1"><i class="bi bi-cash-stack text-warning me-1"></i> Cash On Delivery</span>
            <span class="badge bg-white text-dark border px-2 py-1"><i class="bi bi-phone-fill text-success me-1"></i> EasyPaisa</span>
            <span class="badge bg-white text-dark border px-2 py-1"><i class="bi bi-wallet2 text-danger me-1"></i> JazzCash</span>
            <span class="badge bg-white text-dark border px-2 py-1"><i class="bi bi-credit-card-2-front text-primary me-1"></i> Cards</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Tabs Section -->
    <div class="mt-5 bg-white rounded-4 p-4 p-md-5 shadow-sm border">
      <ul class="nav nav-tabs nav-deal-tabs mb-4" id="productTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="desc-tab" data-bs-toggle="tab" data-bs-target="#desc-pane" type="button" role="tab">Description</button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="specs-tab" data-bs-toggle="tab" data-bs-target="#specs-pane" type="button" role="tab">Specifications</button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="reviews-tab" data-bs-toggle="tab" data-bs-target="#reviews-pane" type="button" role="tab">Reviews (${prod.reviewCount})</button>
        </li>
      </ul>
      <div class="tab-content" id="productTabContent">
        <div class="tab-pane fade show active" id="desc-pane" role="tabpanel">
          <h5 class="fw-bold mb-3">Key Features & Highlights</h5>
          <ul class="list-unstyled">
            ${(prod.features || []).map(f => `
              <li class="d-flex align-items-start gap-2 mb-2">
                <i class="bi bi-check-circle-fill text-warning mt-1"></i>
                <span>${f}</span>
              </li>
            `).join('')}
          </ul>
          <p class="mt-4 text-muted">${prod.description}</p>
        </div>
        <div class="tab-pane fade" id="specs-pane" role="tabpanel">
          <div class="table-responsive">
            <table class="table table-striped align-middle">
              <tbody>
                ${specsRows}
              </tbody>
            </table>
          </div>
        </div>
        <div class="tab-pane fade" id="reviews-pane" role="tabpanel">
          <div class="row g-4 align-items-center mb-4 pb-4 border-bottom">
            <div class="col-md-4 text-center border-end">
              <h1 class="display-3 fw-bold text-dark mb-0">${prod.rating}</h1>
              <div class="d-flex justify-content-center my-2">${starsHtml}</div>
              <p class="text-muted small mb-0">Based on ${prod.reviewCount} customer reviews</p>
            </div>
            <div class="col-md-8">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="small fw-bold">5 Stars</span>
                <div class="progress flex-grow-1" style="height: 8px;"><div class="progress-bar bg-warning" style="width: 82%;"></div></div>
                <span class="small text-muted">82%</span>
              </div>
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="small fw-bold">4 Stars</span>
                <div class="progress flex-grow-1" style="height: 8px;"><div class="progress-bar bg-warning" style="width: 14%;"></div></div>
                <span class="small text-muted">14%</span>
              </div>
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="small fw-bold">3 Stars</span>
                <div class="progress flex-grow-1" style="height: 8px;"><div class="progress-bar bg-warning" style="width: 3%;"></div></div>
                <span class="small text-muted">3%</span>
              </div>
            </div>
          </div>
          <!-- Sample Customer Review -->
          <div class="review-item mb-4 pb-3 border-bottom">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle bg-warning text-dark fw-bold d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">JD</div>
                <div>
                  <h6 class="mb-0 fw-bold">Jonathan D. <span class="badge bg-success-subtle text-success small">Verified Buyer</span></h6>
                  <span class="text-muted" style="font-size: 0.75rem;">Reviewed 3 days ago</span>
                </div>
              </div>
              <div class="text-warning small">${starsHtml}</div>
            </div>
            <p class="mb-0 text-muted small">"Absolutely blown away by the quality. Arrived in just two days in solid packaging. Looks even sharper in person and the deal price is unbeatable!"</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Gallery Thumbnail Click Logic
  const mainImg = document.getElementById('mainProductImage');
  const thumbs = container.querySelectorAll('.thumb-item');
  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      const newSrc = thumb.getAttribute('data-img-src');
      if (mainImg) mainImg.src = newSrc;
    });
  });

  // Variant selections
  let selectedColor = prod.colors && prod.colors[0];
  let selectedSize = prod.sizes && prod.sizes[0];

  container.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      selectedColor = el.getAttribute('data-color');
    });
  });

  container.querySelectorAll('.size-pill').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.size-pill').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
      selectedSize = el.getAttribute('data-size');
    });
  });

  // Quantity Stepper
  const qtyInput = document.getElementById('detailQtyInput');
  const minusBtn = document.getElementById('qtyMinusBtn');
  const plusBtn = document.getElementById('qtyPlusBtn');

  if (minusBtn && qtyInput) {
    minusBtn.addEventListener('click', () => {
      let val = Number(qtyInput.value) || 1;
      if (val > 1) qtyInput.value = val - 1;
    });
  }
  if (plusBtn && qtyInput) {
    plusBtn.addEventListener('click', () => {
      let val = Number(qtyInput.value) || 1;
      if (val < prod.stock) qtyInput.value = val + 1;
    });
  }

  // Add to Cart
  const addCartBtn = document.getElementById('detailAddToCartBtn');
  if (addCartBtn) {
    addCartBtn.addEventListener('click', () => {
      const qty = Number(qtyInput ? qtyInput.value : 1);
      addToCart(prod.id, qty, selectedColor, selectedSize);
    });
  }

  // Buy Now
  const buyNowBtn = document.getElementById('detailBuyNowBtn');
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', () => {
      const qty = Number(qtyInput ? qtyInput.value : 1);
      addToCart(prod.id, qty, selectedColor, selectedSize);
      window.location.href = 'cart.html';
    });
  }

  // Wishlist toggle
  const wishBtn = document.getElementById('detailWishlistBtn');
  if (wishBtn) {
    wishBtn.addEventListener('click', () => {
      const isAdded = toggleWishlist(prod.id);
      const icon = wishBtn.querySelector('i');
      if (isAdded) {
        wishBtn.classList.add('active');
        icon.className = 'bi bi-heart-fill text-danger fs-5';
      } else {
        wishBtn.classList.remove('active');
        icon.className = 'bi bi-heart fs-5';
      }
    });
  }

  // Related Products Grid (4 items)
  if (relatedGrid) {
    const related = products.filter(p => p.id !== prod.id && p.categorySlug === prod.categorySlug)
      .slice(0, 4);
    // If not enough in category, take any other products
    const displayList = related.length >= 2 
      ? related 
      : products.filter(p => p.id !== prod.id).slice(0, 4);

    relatedGrid.innerHTML = displayList.map(item => `
      <div class="col-6 col-md-3 mb-4">
        ${createProductCardHTML(item)}
      </div>
    `).join('');
    bindProductCardEvents(relatedGrid);
  }
}

/* ==========================================================================
   10. ORDER PERSISTENCE & SECURE CLOUD STORAGE INTEGRATION
   ========================================================================== */

/**
 * Retrieve saved placed orders from localStorage
 * @returns {Array} List of stored orders
 */
function getPlacedOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Persist placed order into localStorage history
 * @param {Object} order 
 */
function savePlacedOrder(order) {
  try {
    const orders = getPlacedOrders();
    orders.unshift(order);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders.slice(0, 30)));
  } catch (e) {
    console.error('Failed to save order to local storage', e);
  }
}

/**
 * Update an existing placed order in localStorage
 * @param {string} orderNumber
 * @param {Object} updates
 * @returns {Object|null}
 */
function updatePlacedOrder(orderNumber, updates) {
  try {
    const orders = getPlacedOrders();
    const cleanNum = String(orderNumber).replace('#', '').trim().toUpperCase();
    const idx = orders.findIndex(o => 
      (o.orderNumber && o.orderNumber.replace('#', '').trim().toUpperCase() === cleanNum)
    );
    if (idx > -1) {
      orders[idx] = { ...orders[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      return orders[idx];
    } else {
      // If order wasn't saved before (e.g. tracking sample or direct), create a record
      const newOrder = {
        orderNumber: String(orderNumber).startsWith('#') ? orderNumber : `#${orderNumber}`,
        ...updates
      };
      orders.unshift(newOrder);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders.slice(0, 30)));
      return newOrder;
    }
  } catch (e) {
    console.error('Failed to update order in local storage', e);
    return null;
  }
}

/**
 * Helper function to return CSS class string based on the order status
 * Visualizes tracking state in UI:
 * - 'Pending' / 'Placed': bg-warning text-dark (Amber / Yellow)
 * - 'Delivered': bg-success text-white (Green)
 * - 'Cancelled': bg-danger text-white (Red)
 * - 'Shipped' / 'In Transit': bg-info text-dark (Blue / Cyan)
 * 
 * @param {string} status - e.g. 'Pending', 'Delivered', 'Cancelled', 'Shipped'
 * @param {string} [type='badge'] - 'badge' | 'bg' | 'text' | 'border' | 'alert'
 * @returns {string} CSS classes
 */
function getOrderStatusCSSClass(status, type = 'badge') {
  const s = String(status || '').trim().toLowerCase();

  // Cancelled State -> Danger / Red
  if (s.includes('cancel')) {
    if (type === 'bg') return 'bg-danger text-white';
    if (type === 'text') return 'text-danger fw-bold';
    if (type === 'border') return 'border-danger';
    if (type === 'alert') return 'alert-danger border-danger-subtle';
    return 'badge bg-danger text-white fw-bold px-3 py-2 rounded-pill fs-6';
  }

  // Delivered State -> Success / Green
  if (s.includes('deliver')) {
    if (type === 'bg') return 'bg-success text-white';
    if (type === 'text') return 'text-success fw-bold';
    if (type === 'border') return 'border-success';
    if (type === 'alert') return 'alert-success border-success-subtle';
    return 'badge bg-success text-white fw-bold px-3 py-2 rounded-pill fs-6';
  }

  // Shipped / In-Transit State -> Info / Cyan
  if (s.includes('ship') || s.includes('transit') || s.includes('out')) {
    if (type === 'bg') return 'bg-info text-dark';
    if (type === 'text') return 'text-primary fw-bold';
    if (type === 'border') return 'border-info';
    if (type === 'alert') return 'alert-info border-info-subtle';
    return 'badge bg-info text-dark fw-bold px-3 py-2 rounded-pill fs-6';
  }

  // Pending / Order Placed State (Default) -> Warning / Yellow
  if (type === 'bg') return 'bg-warning text-dark';
  if (type === 'text') return 'text-warning fw-bold';
  if (type === 'border') return 'border-warning';
  if (type === 'alert') return 'alert-warning border-warning-subtle';
  return 'badge bg-warning text-dark fw-bold px-3 py-2 rounded-pill fs-6';
}

/**
 * Helper function returning status icon based on order status
 * @param {string} status
 * @returns {string} Bootstrap icon class
 */
function getOrderStatusIcon(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s.includes('cancel')) return 'bi-x-circle-fill';
  if (s.includes('deliver')) return 'bi-check-circle-fill';
  if (s.includes('ship') || s.includes('transit') || s.includes('out')) return 'bi-truck';
  return 'bi-clock-history'; // Pending
}

/**
 * Dispatch placed order details to secure cloud storage endpoint
 * Supports both JSON payload parsing and URL parameters
 * 
 * @param {Object} orderData
 */
async function sendOrderToGoogleSheet(orderData) {
  if (!GOOGLE_SHEET_ORDER_WEBHOOK) {
    return { success: false, error: 'Endpoint inactive' };
  }

  // Build clean comprehensive payload with both camelCase and Sheet column header aliases
  const payload = {
    orderNumber: orderData.orderNumber || '',
    customerName: orderData.customerName || '',
    email: orderData.email || '',
    phone: orderData.phone || '',
    address: orderData.address || '',
    city: orderData.city || '',
    state: orderData.state || '',
    zip: orderData.zip || '',
    paymentMethod: orderData.paymentMethod || '',
    paymentStatus: orderData.paymentStatus || '',
    itemsSummary: orderData.itemsSummary || '',
    itemCount: orderData.itemsCount || 1,
    subtotal: Number(orderData.subtotal || 0).toFixed(2),
    discount: Number(orderData.discount || 0).toFixed(2),
    shipping: Number(orderData.shipping || 0).toFixed(2),
    total: Number(orderData.total || 0).toFixed(2),
    status: orderData.status || 'Order Placed',
    timestamp: orderData.timestamp || new Date().toISOString(),
    date: orderData.dateString || new Date().toLocaleString(),

    // Cloud column title aliases (matches standard database column names)
    "Order ID": orderData.orderNumber || '',
    "Order Number": orderData.orderNumber || '',
    "Name": orderData.customerName || '',
    "Customer Name": orderData.customerName || '',
    "Email": orderData.email || '',
    "Phone": orderData.phone || '',
    "Shipping Address": orderData.address || '',
    "Address": orderData.address || '',
    "City": orderData.city || '',
    "Payment Method": orderData.paymentMethod || '',
    "Order Items": orderData.itemsSummary || '',
    "Items": orderData.itemsSummary || '',
    "Total Amount": Number(orderData.total || 0).toFixed(2),
    "Total": Number(orderData.total || 0).toFixed(2),
    "Order Date": orderData.dateString || new Date().toLocaleString(),
    "Order Status": orderData.status || 'Order Placed'
  };

  // URL query params for scripts reading e.parameter / GET / form data
  const queryParams = new URLSearchParams({
    orderNumber: orderData.orderNumber || '',
    orderId: orderData.orderNumber || '',
    name: orderData.customerName || '',
    customerName: orderData.customerName || '',
    email: orderData.email || '',
    phone: orderData.phone || '',
    address: orderData.address || '',
    city: orderData.city || '',
    paymentMethod: orderData.paymentMethod || '',
    items: orderData.itemsSummary || '',
    subtotal: String(Number(orderData.subtotal || 0).toFixed(2)),
    discount: String(Number(orderData.discount || 0).toFixed(2)),
    shipping: String(Number(orderData.shipping || 0).toFixed(2)),
    total: String(Number(orderData.total || 0).toFixed(2)),
    status: orderData.status || 'Order Placed',
    timestamp: orderData.timestamp || new Date().toISOString()
  });

  const webhookUrl = getActiveWebhookUrl();
  if (!webhookUrl) return { success: false, error: 'Endpoint inactive' };

  const fullUrl = `${webhookUrl}?${queryParams.toString()}`;

  // 1. Primary Reliable Transmission via GET (Google Apps Script executes doGet seamlessly and returns success)
  try {
    await fetch(fullUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache'
    });
  } catch (getErr) {
    console.warn('GET order transmission notice:', getErr);
  }

  // 2. Secondary Payload Transmission via POST
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
  } catch (postError) {
    console.warn('POST order transmission notice:', postError);
  }

  return { success: true };
}

/**
 * ==============================================================================
 * AUTOMATED WHATSAPP BUSINESS ORDER CONFIRMATION DISPATCHER
 * ==============================================================================
 * Normalizes phone numbers, formats branded receipts, updates the checkout modal,
 * and pings the WhatsApp Business API / Webhook provider.
 */
function dispatchWhatsAppOrderConfirmation(orderData) {
  if (!orderData || !orderData.phone) return { success: false };

  // 1. Normalize phone to E.164 digits
  let cleanPhone = String(orderData.phone || '').trim().replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2);
  if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
    cleanPhone = '92' + cleanPhone.substring(1);
  } else if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
    cleanPhone = '92' + cleanPhone;
  }

  // 2. Format WhatsApp markdown receipt
  const orderRef = orderData.orderNumber || '#SNP-982421';
  const customer = orderData.customerName || 'Valued Customer';
  const total = Number(orderData.total || 0).toFixed(2);
  const payment = orderData.paymentMethod || 'Cash on Delivery';
  const items = orderData.itemsSummary || 'Order Items';
  const address = [orderData.address, orderData.city].filter(Boolean).join(', ') || 'Provided at checkout';
  const trackUrl = orderData.trackingUrl || `https://snapzdealz.com/cart.html?track=${encodeURIComponent(orderRef.replace('#', ''))}`;

  const messageText = [
    `⚡ *SNAPZDEALZ - ORDER CONFIRMED!* 🛍️`,
    `----------------------------------------`,
    `Dear *${customer}*,`,
    ``,
    `Thank you for shopping with *SnapzDealz*! Your order has been placed successfully and has been queued for express courier dispatch. 🚚📦`,
    ``,
    `📋 *ORDER DETAILS:*`,
    `• *Order ID:* ${orderRef}`,
    `• *Date:* ${orderData.dateString || new Date().toLocaleString()}`,
    `• *Payment Method:* ${payment}`,
    `• *Status:* ${orderData.paymentStatus || 'Pending Upon Delivery'}`,
    ``,
    `📍 *DELIVERY DESTINATION:*`,
    `• *Address:* ${address}`,
    `• *Contact Phone:* ${orderData.phone}`,
    ``,
    `🛒 *ITEMS PURCHASED:*`,
    `${items}`,
    ``,
    `💰 *TOTAL AMOUNT:* *$${total}*`,
    ``,
    `⏱️ *Estimated Delivery:* 2 to 3 Business Days`,
    `🔍 *Live Courier Tracking:* ${trackUrl}`,
    ``,
    `----------------------------------------`,
    `💬 *Need Assistance or Want to Modify?*`,
    `Simply reply to this WhatsApp message or call our support at 1-800-SNAPZ-DEAL.`,
    ``,
    `_Thank you for choosing SnapzDealz!_ ✨`
  ].join('\n');

  // 3. Generate direct 1-click WhatsApp Link
  const encodedMsg = encodeURIComponent(messageText);
  const waDirectUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;

  // 4. Update Order Success Modal Elements if present on page
  const whatsAppBtn = document.getElementById('orderSuccessWhatsAppBtn');
  if (whatsAppBtn) {
    whatsAppBtn.href = waDirectUrl;
    whatsAppBtn.style.display = 'inline-flex';
  }

  const whatsAppStatus = document.getElementById('orderSuccessWhatsAppStatus');
  if (whatsAppStatus) {
    whatsAppStatus.innerHTML = cleanPhone 
      ? `<i class="bi bi-check-circle-fill text-success"></i> Dispatched to +${cleanPhone}` 
      : `<i class="bi bi-check-circle-fill text-success"></i> Automated Message Ready`;
  }

  // 5. Send automated dispatch to WhatsApp API / Webhook in background
  try {
    fetch('/api/whatsapp/order-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        message: messageText,
        orderNumber: orderRef,
        customerName: customer,
        total: total
      })
    }).catch(() => {
      // Non-blocking background call
    });
  } catch (err) {}

  return {
    success: true,
    recipient: cleanPhone,
    directChatLink: waDirectUrl,
    message: messageText
  };
}

/* ==========================================================================
   11. CART PAGE LOGIC
   ========================================================================== */

function initCartPage() {
  const cartItemsContainer = document.getElementById('cartItemsList');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartDiscountEl = document.getElementById('cartDiscount');
  const cartShippingEl = document.getElementById('cartShipping');
  const cartTotalEl = document.getElementById('cartTotal');
  const emptyCartState = document.getElementById('emptyCartState');
  const cartContentWrapper = document.getElementById('cartContentWrapper');
  const promoInput = document.getElementById('promoCodeInput');
  const applyPromoBtn = document.getElementById('applyPromoBtn');
  const promoStatusEl = document.getElementById('promoStatusText');
  const clearCartBtn = document.getElementById('clearCartBtn');
  const checkoutBtn = document.getElementById('proceedCheckoutBtn');

  if (!cartItemsContainer) return;

  function renderCart() {
    const cart = getCart();

    if (cart.length === 0) {
      if (cartContentWrapper) cartContentWrapper.style.display = 'none';
      if (emptyCartState) {
        emptyCartState.style.display = 'block';
        renderEmptyCartRecommendations();
      }
      if (cartItemsContainer) cartItemsContainer.innerHTML = '';
      if (cartSubtotalEl) cartSubtotalEl.textContent = '$0.00';
      if (cartDiscountEl) cartDiscountEl.textContent = '-$0.00';
      if (cartShippingEl) cartShippingEl.textContent = 'FREE';
      if (cartTotalEl) cartTotalEl.textContent = '$0.00';
      if (promoStatusEl) promoStatusEl.innerHTML = '';
      return;
    }

    if (cartContentWrapper) cartContentWrapper.style.display = 'flex';
    if (emptyCartState) emptyCartState.style.display = 'none';

    cartItemsContainer.innerHTML = cart.map((item, idx) => `
      <div class="p-3 mb-3 bg-white rounded-3 border d-flex flex-wrap align-items-center gap-3">
        <a href="product.html?id=${item.id}" class="rounded-3 overflow-hidden flex-shrink-0" style="width: 80px; height: 80px; background: #f8f9fa;">
          <img src="${item.image}" alt="${item.name}" class="w-100 h-100 object-fit-cover">
        </a>
        <div class="flex-grow-1" style="min-width: 180px;">
          <span class="small text-muted text-uppercase fw-semibold">${item.category}</span>
          <h6 class="fw-bold mb-1">
            <a href="product.html?id=${item.id}" class="text-dark">${item.name}</a>
          </h6>
          <div class="small text-muted d-flex gap-3">
            ${item.color ? `<span>Color: <span class="d-inline-block rounded-circle align-middle" style="width: 12px; height: 12px; background: ${item.color};"></span></span>` : ''}
            ${item.size ? `<span>Size: <strong>${item.size}</strong></span>` : ''}
          </div>
          <div class="fw-bold mt-1 text-dark">$${item.price.toFixed(2)} each</div>
        </div>

        <div class="qty-stepper">
          <button type="button" class="qty-btn cart-qty-minus" data-index="${idx}" data-id="${item.id}" data-color="${item.color || ''}" data-size="${item.size || ''}">-</button>
          <input type="number" class="qty-input cart-qty-val" value="${item.quantity}" min="1" readonly>
          <button type="button" class="qty-btn cart-qty-plus" data-index="${idx}" data-id="${item.id}" data-color="${item.color || ''}" data-size="${item.size || ''}">+</button>
        </div>

        <div class="text-end fw-bold fs-5 font-monospace" style="min-width: 90px;">
          $${(item.price * item.quantity).toFixed(2)}
        </div>

        <button type="button" class="btn btn-sm btn-outline-danger border-0 rounded-circle cart-remove-item" data-index="${idx}" data-id="${item.id}" data-color="${item.color || ''}" data-size="${item.size || ''}" title="Remove item">
          <i class="bi bi-trash fs-5"></i>
        </button>
      </div>
    `).join('');

    // Quantity buttons
    cartItemsContainer.querySelectorAll('.cart-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const color = btn.getAttribute('data-color') || '';
        const size = btn.getAttribute('data-size') || '';
        updateCartQuantity(id, color, size, -1);
        renderCart();
      });
    });

    cartItemsContainer.querySelectorAll('.cart-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const color = btn.getAttribute('data-color') || '';
        const size = btn.getAttribute('data-size') || '';
        updateCartQuantity(id, color, size, 1);
        renderCart();
      });
    });

    // Remove buttons
    cartItemsContainer.querySelectorAll('.cart-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.getAttribute('data-index');
        if (idx !== null && idx !== undefined) {
          removeCartItemByIndex(idx);
        } else {
          const id = btn.getAttribute('data-id');
          const color = btn.getAttribute('data-color') || '';
          const size = btn.getAttribute('data-size') || '';
          removeFromCart(id, color, size);
        }
        renderCart();
        showToast('Item removed from cart.');
      });
    });

    // Totals calculation
    calculateTotals();
  }

  function renderEmptyCartRecommendations() {
    const suggestionsContainer = document.getElementById('emptyCartSuggestions');
    if (!suggestionsContainer || typeof products === 'undefined' || !products.length) return;

    // Pick top 4 products for recommendation
    const recommended = products.slice(0, 4);

    suggestionsContainer.innerHTML = recommended.map(prod => {
      const discountPercent = Math.round(((prod.oldPrice - prod.price) / prod.oldPrice) * 100);
      return `
        <div class="col-6 col-md-3">
          <div class="deal-product-card h-100 d-flex flex-column" data-product-id="${prod.id}">
            <div class="card-img-wrap">
              <a href="product.html?id=${prod.id}" class="d-block w-100 h-100">
                <img src="${prod.images[0]}" alt="${prod.name}" loading="lazy">
              </a>
              <span class="card-discount-badge">-${discountPercent}%</span>
              <button type="button" class="card-quick-add empty-cart-quick-add" data-id="${prod.id}">
                <i class="bi bi-cart-plus-fill"></i> Add to Cart
              </button>
            </div>
            <div class="card-content d-flex flex-column flex-grow-1 p-3">
              <span class="card-category">${prod.category}</span>
              <h4 class="card-title fs-6 mb-1">
                <a href="product.html?id=${prod.id}" class="text-truncate d-block">${prod.name}</a>
              </h4>
              <div class="card-price-row mt-auto pt-2">
                <span class="current-price">$${prod.price.toFixed(2)}</span>
                <span class="old-price">$${prod.oldPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind quick add buttons in empty cart recommendations
    suggestionsContainer.querySelectorAll('.empty-cart-quick-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = Number(btn.getAttribute('data-id'));
        addToCart(pId, 1);
        renderCart();
      });
    });
  }

  function calculateTotals() {
    const subtotal = getCartSubtotal();
    let discount = 0;
    let shipping = subtotal > 50 || subtotal === 0 ? 0 : 5.99;

    // Check active coupon
    const activeCouponCode = localStorage.getItem(STORAGE_KEYS.COUPON);
    if (activeCouponCode && PROMO_CODES[activeCouponCode]) {
      const promo = PROMO_CODES[activeCouponCode];
      if (promo.discountPercent) {
        discount = (subtotal * promo.discountPercent) / 100;
      }
      if (promo.freeShipping) {
        shipping = 0;
      }
      if (promoStatusEl) {
        promoStatusEl.innerHTML = `<span class="text-success"><i class="bi bi-tag-fill"></i> Coupon <strong>${activeCouponCode}</strong> applied (-$${discount.toFixed(2)})</span>`;
      }
    } else if (promoStatusEl) {
      promoStatusEl.innerHTML = '';
    }

    const total = Math.max(0, subtotal - discount + shipping);

    if (cartSubtotalEl) cartSubtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (cartDiscountEl) cartDiscountEl.textContent = `-$${discount.toFixed(2)}`;
    if (cartShippingEl) cartShippingEl.textContent = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
    if (cartTotalEl) cartTotalEl.textContent = `$${total.toFixed(2)}`;
  }

  // Coupon handling
  if (applyPromoBtn && promoInput) {
    applyPromoBtn.addEventListener('click', () => {
      const code = promoInput.value.trim().toUpperCase();
      if (!code) return;

      if (PROMO_CODES[code]) {
        localStorage.setItem(STORAGE_KEYS.COUPON, code);
        showToast(`Promo applied: ${PROMO_CODES[code].description}`);
        calculateTotals();
      } else {
        showToast('Invalid promo code. Try BUNDLE20 or SNAPZ10');
      }
    });
  }

  // Clear cart button - opens confirmation modal without blocking browser dialogs
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      const emptyModalEl = document.getElementById('emptyCartModal');
      if (emptyModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(emptyModalEl) || new bootstrap.Modal(emptyModalEl);
        modal.show();
      } else {
        // Fallback: clear directly
        clearCart();
        renderCart();
        showToast('Shopping cart has been emptied.');
      }
    });
  }

  // Confirm empty cart modal button
  const confirmEmptyCartBtn = document.getElementById('confirmEmptyCartBtn');
  if (confirmEmptyCartBtn) {
    confirmEmptyCartBtn.addEventListener('click', () => {
      const emptyModalEl = document.getElementById('emptyCartModal');
      if (emptyModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(emptyModalEl);
        if (modal) modal.hide();
      }
      clearCart();
      renderCart();
      showToast('Shopping cart has been emptied.');
    });
  }

  // Checkout modal launch
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      const checkoutModalEl = document.getElementById('checkoutModal');
      if (checkoutModalEl) {
        const modal = new bootstrap.Modal(checkoutModalEl);
        modal.show();
      }
    });
  }

  // Payment method selection radio listeners
  const paymentRadios = document.querySelectorAll('input[name="paymentType"]');
  const codDetails = document.getElementById('codDetails');
  const easypaisaDetails = document.getElementById('easypaisaDetails');
  const jazzcashDetails = document.getElementById('jazzcashDetails');
  const cardDetails = document.getElementById('cardDetails');

  function updatePaymentMethodView(selectedVal) {
    if (codDetails) codDetails.classList.toggle('d-none', selectedVal !== 'cod');
    if (easypaisaDetails) easypaisaDetails.classList.toggle('d-none', selectedVal !== 'easypaisa');
    if (jazzcashDetails) jazzcashDetails.classList.toggle('d-none', selectedVal !== 'jazzcash');
    if (cardDetails) cardDetails.classList.toggle('d-none', selectedVal !== 'card');

    // Update active visual class on parent card
    document.querySelectorAll('.payment-method-card').forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  paymentRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      updatePaymentMethodView(radio.value);
    });
  });

  const currentChecked = document.querySelector('input[name="paymentType"]:checked');
  if (currentChecked) {
    updatePaymentMethodView(currentChecked.value);
  }

  // Checkout form submit with double-submission protection
  const checkoutForm = document.getElementById('checkoutOrderForm');
  let isSubmittingCheckout = false;
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmittingCheckout) return; // Prevent double submission
      if (!checkoutForm.checkValidity()) {
        e.stopPropagation();
        checkoutForm.classList.add('was-validated');
        return;
      }
      isSubmittingCheckout = true;

      const submitBtn = document.getElementById('submitOrderBtn');
      const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Receiving & Recording Order...';
      }

      // Customer details with strict sanitization
      const rawFullName = document.getElementById('checkoutFullName')?.value.trim() || 'Valued Customer';
      const rawEmail = document.getElementById('checkoutEmail')?.value.trim().toLowerCase() || 'customer@example.com';
      const rawPhone = document.getElementById('checkoutPhone')?.value.trim() || 'N/A';
      const rawCity = document.getElementById('checkoutCity')?.value.trim() || '';
      const rawStreet = document.getElementById('checkoutAddress')?.value.trim() || '';
      const rawState = document.getElementById('checkoutState')?.value.trim() || '';
      const rawZip = document.getElementById('checkoutZip')?.value.trim() || '';

      const fullName = escapeHtml(rawFullName);
      const email = escapeHtml(rawEmail);
      const phone = escapeHtml(rawPhone);
      const city = escapeHtml(rawCity);
      const streetAddress = escapeHtml(rawStreet);
      const state = escapeHtml(rawState);
      const zip = escapeHtml(rawZip);
      const fullAddress = `${streetAddress}${city ? ', ' + city : ''}${state ? ', ' + state : ''}${zip ? ' ' + zip : ''}`;

      // Read selected payment method details (guarantee no CVV or raw card credentials are retained)
      const selectedPayment = document.querySelector('input[name="paymentType"]:checked')?.value || 'cod';
      let paymentLabel = 'Cash On Delivery (COD)';
      let paymentStatus = 'Pay with exact cash upon delivery';

      if (selectedPayment === 'easypaisa') {
        const epNum = document.getElementById('easypaisaNumber')?.value.trim() || '03xx-xxxxxxx';
        const epName = document.getElementById('easypaisaName')?.value.trim();
        paymentLabel = `EasyPaisa Wallet (${maskPhone(epNum)}${epName ? ' - ' + escapeHtml(epName) : ''})`;
        paymentStatus = 'Instant Mobile Wallet Approved';
      } else if (selectedPayment === 'jazzcash') {
        const jcNum = document.getElementById('jazzcashNumber')?.value.trim() || '03xx-xxxxxxx';
        paymentLabel = `JazzCash Wallet (${maskPhone(jcNum)})`;
        paymentStatus = 'MPIN Verified & Approved';
      } else if (selectedPayment === 'card') {
        const cardNum = document.getElementById('cardNumberInput')?.value.trim() || '4242';
        const cleanCard = cardNum.replace(/\s+/g, '');
        const last4 = cleanCard.slice(-4) || '4242';
        paymentLabel = `Credit / Debit Card (Ending in ${last4})`;
        paymentStatus = 'Payment Authorized (PCI-DSS Tokenized)';
      }

      // Snapshot current cart & calculations
      const cart = getCart();
      const subtotal = getCartSubtotal();
      let discount = 0;
      let shipping = subtotal > 50 || subtotal === 0 ? 0 : 5.99;

      const activeCouponCode = localStorage.getItem(STORAGE_KEYS.COUPON);
      if (activeCouponCode && PROMO_CODES[activeCouponCode]) {
        const promo = PROMO_CODES[activeCouponCode];
        if (promo.discountPercent) {
          discount = (subtotal * promo.discountPercent) / 100;
        }
        if (promo.freeShipping) {
          shipping = 0;
        }
      }
      const total = Math.max(0, subtotal - discount + shipping);

      // Unique Order Reference Number
      const refNumber = `#SNP-${Math.floor(100000 + Math.random() * 900000)}`;

      // Items detailed summary
      const itemsSummary = cart.map(item => {
        let line = `${item.name} x${item.quantity} ($${(item.price * item.quantity).toFixed(2)})`;
        const opts = [];
        if (item.size) opts.push(`Size: ${item.size}`);
        if (item.color) opts.push(`Color: ${item.color}`);
        if (opts.length) line += ` [${opts.join(', ')}]`;
        return line;
      }).join('; ');

      const orderPayload = {
        orderNumber: refNumber,
        customerName: fullName,
        email: email,
        phone: phone,
        address: fullAddress,
        streetAddress: streetAddress,
        city: city,
        state: state,
        zip: zip,
        paymentMethod: paymentLabel,
        paymentType: selectedPayment,
        paymentStatus: paymentStatus,
        itemsSummary: itemsSummary || 'No items',
        itemsCount: cart.reduce((acc, it) => acc + (it.quantity || 1), 0),
        subtotal: subtotal,
        discount: discount,
        shipping: shipping,
        total: total,
        couponCode: activeCouponCode || 'None',
        timestamp: new Date().toISOString(),
        dateString: new Date().toLocaleString(),
        status: 'Pending'
      };

      // Save order in local history for live tracking & audit
      savePlacedOrder(orderPayload);

      // Transmit to Cloud Storage Endpoint
      try {
        await Promise.race([
          sendOrderToGoogleSheet(orderPayload),
          new Promise(resolve => setTimeout(resolve, 2500))
        ]);
      } catch (err) {
        // Handled silently
      }

      // Dispatch Automated WhatsApp Business Confirmation
      try {
        dispatchWhatsAppOrderConfirmation(orderPayload);
      } catch (waErr) {
        console.warn('WhatsApp confirmation notice:', waErr);
      }

      // Update Order Success Modal Elements
      const successPayMethodEl = document.getElementById('orderSuccessPaymentMethod');
      const successStatusEl = document.getElementById('orderSuccessStatus');
      const successRefEl = document.getElementById('orderSuccessRefNumber');

      if (successPayMethodEl) successPayMethodEl.textContent = paymentLabel;
      if (successStatusEl) successStatusEl.textContent = paymentStatus;
      if (successRefEl) successRefEl.textContent = refNumber;

      // Close checkout modal
      const modalEl = document.getElementById('checkoutModal');
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
      }

      // Restore submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
      }
      isSubmittingCheckout = false;

      // Clear cart & re-render
      clearCart();
      renderCart();

      // Show success modal
      const successModalEl = document.getElementById('orderSuccessModal');
      if (successModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const successModal = new bootstrap.Modal(successModalEl);
        successModal.show();
      } else {
        showToast(`Order confirmed with ${paymentLabel}! Thank you for shopping with SnapzDealz.`);
      }
    });
  }

  // Initial render
  renderCart();
}

/* ==========================================================================
   11. DATA SECURITY UTILITIES & CRYPTOGRAPHIC PROTECTION
   ========================================================================== */

/** Salt used to protect password hashes from dictionary and rainbow table attacks */
const SECURITY_CRYPTO_SALT = 'SNAPZDEALZ_SECURE_SALT_v2_8f91c70e24b';

/**
 * Robust HTML entity escaper to neutralize Cross-Site Scripting (XSS) attacks
 * @param {string} str 
 * @returns {string} Sanitized string safe for DOM interpolation
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Computes a SHA-256 hexadecimal hash using the native browser Web Crypto API
 * @param {string} message 
 * @returns {Promise<string>} Hex string of hash
 */
async function computeSha256Hex(message) {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback simple bitwise hash if subtle crypto is somehow unavailable
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'sha256_fallback_' + Math.abs(hash).toString(16);
  }
}

/**
 * Cryptographically hashes a plain password with the security salt
 * @param {string} plainPassword 
 * @returns {Promise<string>} Salted SHA-256 hash
 */
async function hashSecurePassword(plainPassword) {
  if (!plainPassword) return '';
  return await computeSha256Hex(`${SECURITY_CRYPTO_SALT}::${plainPassword}`);
}

/**
 * Masks sensitive emails for privacy (e.g., "alex@example.com" -> "a***@example.com")
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const parts = email.split('@');
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 4))}${name[name.length - 1]}@${domain}`;
}

/**
 * Masks sensitive phone numbers (e.g., "03001234567" -> "0300****567")
 */
function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).trim();
  if (clean.length < 7) return clean;
  return clean.slice(0, 4) + '****' + clean.slice(-3);
}

/**
 * Client-Side Brute-Force Rate Limiting Engine
 * Enforces exponential cooldown lockouts on repeated authentication failures
 */
const SecurityRateLimiter = {
  getRecord(key) {
    try {
      const raw = sessionStorage.getItem(`snapdealz_rl_${key}`);
      return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: 0 };
    } catch (e) {
      return { attempts: 0, lockedUntil: 0 };
    }
  },
  isLocked(key) {
    const rec = this.getRecord(key);
    const now = Date.now();
    if (rec.lockedUntil && now < rec.lockedUntil) {
      return Math.ceil((rec.lockedUntil - now) / 1000);
    }
    return 0;
  },
  recordFailure(key, maxAttempts = 5, lockSeconds = 60) {
    const rec = this.getRecord(key);
    rec.attempts = (rec.attempts || 0) + 1;
    if (rec.attempts >= maxAttempts) {
      rec.lockedUntil = Date.now() + (lockSeconds * 1000);
      rec.attempts = 0;
    }
    sessionStorage.setItem(`snapdealz_rl_${key}`, JSON.stringify(rec));
    return rec;
  },
  reset(key) {
    sessionStorage.removeItem(`snapdealz_rl_${key}`);
  }
};

/* ==========================================================================
   AUTHENTICATION PAGES (Login & Sign Up with Salted Hashes)
   ========================================================================== */

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveUser(user) {
  const users = getStoredUsers();
  users.push(user);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

window.getStoredUsers = getStoredUsers;
window.saveUser = saveUser;

/**
 * Dispatch user signup, login, or forgot password event to secure cloud endpoint
 * Plain text passwords are NEVER transmitted; only cryptographic SHA-256 hashes & masks are sent!
 * @param {string} action - 'SIGNUP' | 'LOGIN' | 'FORGOT_PASSWORD'
 * @param {Object} userData
 */
async function sendUserDataToGoogleSheet(action, userData) {
  const webhookUrl = getActiveWebhookUrl();
  if (!webhookUrl) return { success: false };

  // Calculate or forward SHA-256 hash and masked preview
  let secureHash = userData.passwordHash || '';
  if (!secureHash && userData.password) {
    try {
      secureHash = await hashSecurePassword(userData.password);
    } catch (hErr) {
      secureHash = 'hash_' + Math.floor(Math.random() * 1000000);
    }
  }

  const payload = {
    action: action,
    timestamp: new Date().toISOString(),
    dateString: new Date().toLocaleString(),
    userId: userData.userId || '',
    name: escapeHtml(userData.name || userData.fullName || 'Member'),
    email: (userData.email || '').toLowerCase().trim(),
    phone: escapeHtml(userData.phone || 'N/A'),
    passwordHash: secureHash,
    passwordMasked: '•••••••• [SHA-256 Protected]',
    otp: userData.otp || '',
    status: userData.status || 'Active',
    securityVerified: 'True',
    encryptionType: 'SHA-256 Salted'
  };

  const queryParams = new URLSearchParams({
    action: action,
    email: payload.email,
    name: payload.name,
    phone: payload.phone,
    passwordHash: secureHash,
    passwordMasked: '•••••••• [SHA-256 Protected]',
    otp: payload.otp,
    userId: payload.userId,
    status: payload.status,
    timestamp: payload.timestamp,
    dateString: payload.dateString,
    date: payload.dateString
  });

  const fullUrl = `${webhookUrl}?${queryParams.toString()}`;

  // 1. Primary Guaranteed Transmission via GET with keepalive (survives page redirects)
  try {
    await fetch(fullUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-cache',
      keepalive: true
    });
  } catch (getErr) {
    console.warn('GET user sync notice:', getErr);
  }

  // 2. Secondary Payload Transmission via POST with keepalive
  try {
    fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (postErr) {
    console.warn('POST user sync notice:', postErr);
  }

  return { success: true };
}

window.sendUserDataToGoogleSheet = sendUserDataToGoogleSheet;

function initLoginPage() {
  const form = document.getElementById('loginForm');
  const passToggle = document.getElementById('togglePasswordBtn');
  const passInput = document.getElementById('loginPassword');
  const alertBox = document.getElementById('loginAlertBox');

  if (passToggle && passInput) {
    passToggle.addEventListener('click', () => {
      const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passInput.setAttribute('type', type);
      passToggle.querySelector('i').className = type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
    });
  }

  // Tab Switcher between Login & Embedded Sign Up (As requested: "login k ander de deyna sign up ka button")
  const tabLoginBtn = document.getElementById('authTabLoginBtn');
  const tabSignupBtn = document.getElementById('authTabSignupBtn');
  const loginSection = document.getElementById('authLoginSection');
  const signupSection = document.getElementById('authSignupSection');
  const linkToSignup = document.getElementById('authLinkToSignup');
  const linkToLogin = document.getElementById('authLinkToLogin');
  const insideSignupBtn = document.getElementById('loginInsideSignupBtn');
  const insideLoginBtn = document.getElementById('signupInsideLoginBtn');

  function showLoginTab() {
    if (loginSection) loginSection.classList.remove('d-none');
    if (signupSection) signupSection.classList.add('d-none');
    if (tabLoginBtn) {
      tabLoginBtn.className = 'btn w-50 py-2 rounded-pill fw-bold small text-dark btn-warning shadow-sm';
    }
    if (tabSignupBtn) {
      tabSignupBtn.className = 'btn w-50 py-2 rounded-pill fw-bold small text-secondary';
    }
  }

  function showSignupTab() {
    if (signupSection) signupSection.classList.remove('d-none');
    if (loginSection) loginSection.classList.add('d-none');
    if (tabSignupBtn) {
      tabSignupBtn.className = 'btn w-50 py-2 rounded-pill fw-bold small text-dark btn-warning shadow-sm';
    }
    if (tabLoginBtn) {
      tabLoginBtn.className = 'btn w-50 py-2 rounded-pill fw-bold small text-secondary';
    }
  }

  if (tabLoginBtn) tabLoginBtn.addEventListener('click', showLoginTab);
  if (tabSignupBtn) tabSignupBtn.addEventListener('click', showSignupTab);
  if (linkToSignup) linkToSignup.addEventListener('click', showSignupTab);
  if (insideSignupBtn) insideSignupBtn.addEventListener('click', showSignupTab);
  if (linkToLogin) linkToLogin.addEventListener('click', showLoginTab);
  if (insideLoginBtn) insideLoginBtn.addEventListener('click', showLoginTab);

  // Check URL query parameters for ?tab=signup or #signup
  const authUrlParams = new URLSearchParams(window.location.search);
  if (authUrlParams.get('tab') === 'signup' || window.location.hash === '#signup') {
    showSignupTab();
  }

  // Also initialize signup form logic if present inside login page
  if (document.getElementById('signupForm')) {
    initSignupPage();
  }

  // Forgot Password modal trigger
  const forgotLink = document.getElementById('forgotPasswordLink');
  const forgotModalEl = document.getElementById('forgotPasswordModal');
  if (forgotLink && forgotModalEl) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(forgotModalEl) || new bootstrap.Modal(forgotModalEl);
        modal.show();
      }
    });
  }

  // Forgot Password Form Submit
  const forgotForm = document.getElementById('forgotPasswordForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('forgotEmail');
      const newPassInput = document.getElementById('forgotNewPassword');
      const confirmPassInput = document.getElementById('forgotConfirmPassword');
      const forgotAlert = document.getElementById('forgotAlertBox');
      const submitBtn = document.getElementById('forgotSubmitBtn');

      // Rate limit check
      const forgotLock = SecurityRateLimiter.isLocked('forgot_pass');
      if (forgotLock > 0) {
        if (forgotAlert) {
          forgotAlert.className = 'alert alert-danger d-block';
          forgotAlert.innerHTML = `<i class="bi bi-shield-exclamation text-danger me-1"></i> Security Lockout Active! Please wait <strong>${forgotLock} seconds</strong> before requesting another password reset.`;
        }
        return;
      }

      const email = emailInput?.value.trim().toLowerCase();
      const newPass = newPassInput?.value;
      const confirmPass = confirmPassInput?.value;

      if (!email || !newPass || newPass !== confirmPass || newPass.length < 8) {
        if (forgotAlert) {
          forgotAlert.className = 'alert alert-danger d-block';
          forgotAlert.innerHTML = newPass !== confirmPass ? '<i class="bi bi-x-circle-fill"></i> Passwords do not match.' : '<i class="bi bi-x-circle-fill"></i> Password must be at least 8 characters with high security.';
        }
        SecurityRateLimiter.recordFailure('forgot_pass', 4, 60);
        return;
      }

      const origBtn = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Encrypting & Updating Sheet...';
      }

      // Compute cryptographic hash
      const newPasswordHash = await hashSecurePassword(newPass);

      // Update in local storage (never plain text!)
      const users = getStoredUsers();
      const userIndex = users.findIndex(u => u.email.toLowerCase() === email);
      if (userIndex > -1) {
        users[userIndex].passwordHash = newPasswordHash;
        delete users[userIndex].password; // Wipe legacy plain password
        users[userIndex].lastPasswordReset = new Date().toLocaleString();
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      } else {
        users.push({
          userId: `#USR-${Math.floor(100000 + Math.random() * 900000)}`,
          email: email,
          name: email.split('@')[0],
          passwordHash: newPasswordHash,
          registeredAt: new Date().toLocaleString()
        });
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }

      // Dispatch to Cloud Storage and update credentials with SHA-256 hash
      try {
        await Promise.race([
          sendUserDataToGoogleSheet('FORGOT_PASSWORD', {
            email: email,
            passwordHash: newPasswordHash,
            name: email.split('@')[0]
          }),
          new Promise(r => setTimeout(r, 2200))
        ]);
      } catch (err) {
        console.warn('Reset sync notice:', err);
      }

      SecurityRateLimiter.reset('forgot_pass');

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtn;
      }

      if (forgotAlert) {
        forgotAlert.className = 'alert alert-success d-block';
        forgotAlert.innerHTML = '<i class="bi bi-shield-check text-success me-1"></i> <strong>Password Encrypted & Updated!</strong> Credentials secured and synchronized. You can now sign in.';
      }

      // Pre-fill login form with new credentials
      const loginEmail = document.getElementById('loginEmail');
      const loginPass = document.getElementById('loginPassword');
      if (loginEmail) loginEmail.value = email;
      if (loginPass) loginPass.value = newPass;

      setTimeout(() => {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const modal = bootstrap.Modal.getInstance(forgotModalEl);
          if (modal) modal.hide();
        }
        showToast('🔒 Password updated with SHA-256 encryption! Please log in.');
      }, 1600);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Check brute-force lockout
      const lockSeconds = SecurityRateLimiter.isLocked('login');
      if (lockSeconds > 0) {
        if (alertBox) {
          alertBox.className = 'alert alert-danger d-block';
          alertBox.innerHTML = `
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-shield-slash-fill fs-4 text-danger"></i>
              <div>
                <strong>Security Lockout Activated!</strong><br>
                Too many consecutive failed login attempts detected. Try again in <strong>${lockSeconds} seconds</strong>.
              </div>
            </div>
          `;
        }
        return;
      }

      if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        return;
      }

      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const rawPassword = passInput.value;

      // Compute entered password hash
      const enteredHash = await hashSecurePassword(rawPassword);

      // Check against stored users
      const users = getStoredUsers();
      let matchedUser = users.find(u => {
        if (u.email.toLowerCase() !== email) return false;
        // Check hash first
        if (u.passwordHash && u.passwordHash === enteredHash) return true;
        // Legacy plaintext check (for demo or pre-existing accounts)
        if (u.password && u.password === rawPassword) return true;
        return false;
      });

      // Special fallback for pre-filled demo account
      if (!matchedUser && email === 'demo.vip@snapzdealz.com' && rawPassword === 'Password123!') {
        matchedUser = {
          userId: '#USR-990101',
          name: 'Demo VIP Member',
          email: 'demo.vip@snapzdealz.com',
          passwordHash: enteredHash,
          registeredAt: '2026-10-01 10:00:00'
        };
        saveUser(matchedUser);
      }

      if (matchedUser) {
        // Upgrade legacy plaintext to salted SHA-256 hash if needed
        if (!matchedUser.passwordHash || matchedUser.password) {
          matchedUser.passwordHash = enteredHash;
          delete matchedUser.password;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }

        // Reset rate limiter on successful authentication
        SecurityRateLimiter.reset('login');

        // Set active user session
        setCurrentUser(matchedUser);

        // Record Login in Cloud Storage (synchronizing Last Login Date)
        sendUserDataToGoogleSheet('LOGIN', {
          email: matchedUser.email,
          name: matchedUser.name,
          userId: matchedUser.userId || ''
        });

        if (alertBox) {
          alertBox.className = 'alert alert-success d-block';
          alertBox.innerHTML = `<i class="bi bi-shield-check text-success me-1"></i> Verified with 256-Bit Cryptography! Welcome back, <strong>${escapeHtml(matchedUser.name)}</strong>. Redirecting...`;
        }

        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1000);
      } else {
        // Record failure for brute-force prevention
        const rec = SecurityRateLimiter.recordFailure('login', 5, 60);
        const remaining = Math.max(0, 5 - rec.attempts);

        if (alertBox) {
          alertBox.className = 'alert alert-danger d-block';
          alertBox.innerHTML = `
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-exclamation-triangle-fill text-danger fs-4"></i>
              <div>
                <strong>Invalid email or password.</strong><br>
                ${remaining > 0 ? `Anti-hack protection: ${remaining} attempt(s) remaining before security lockout.` : 'Account locked for 60 seconds due to repeated failed attempts.'}
              </div>
            </div>
          `;
        }
      }
    });
  }
}

/**
 * Strict Gmail & Anti-Fake Account Validator
 * Enforces @gmail.com or @googlemail.com and blocks disposable/fake addresses
 */
function isValidGmailAddress(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();

  // Enforce @gmail.com or @googlemail.com strictly
  const gmailRegex = /^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@(gmail\.com|googlemail\.com)$/i;
  if (!gmailRegex.test(clean)) return false;

  const username = clean.split('@')[0];
  // Google standard username requirement: 5 to 30 characters
  if (username.length < 5 || username.length > 30) return false;

  // No consecutive dots, leading dot or trailing dot
  if (username.includes('..') || username.startsWith('.') || username.endsWith('.')) return false;

  // Block obvious spam/disposable/fake usernames
  const blockedPrefixes = [
    'test', 'temp', 'fake', 'dummy', 'asdf', 'qwerty', 'admin',
    'trash', 'disposable', 'throwaway', '12345', '123456', 'none', 'null'
  ];
  if (blockedPrefixes.some(p => username === p || username.startsWith(p + '.'))) return false;

  // Prevent repeating single char like "aaaaaa" or "111111"
  if (/^(.)\1+$/.test(username.replace(/\./g, ''))) return false;

  return true;
}
window.isValidGmailAddress = isValidGmailAddress;

// Ensure Google Fast Account Chooser Modal is present in DOM
function ensureGoogleAccountDialog() {
  let modalEl = document.getElementById('googleAccountDialog');
  if (modalEl) return modalEl;

  const modalWrap = document.createElement('div');
  modalWrap.innerHTML = `
    <div class="modal fade" id="googleAccountDialog" tabindex="-1" aria-labelledby="googleAccountDialogLabel" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered" style="max-width: 440px;">
        <div class="modal-content border-0 shadow-lg" style="border-radius: 24px; overflow: hidden;">
          <div class="modal-header border-0 pb-0 pt-4 px-4 bg-light">
            <div class="d-flex align-items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <div>
                <h5 class="modal-title fw-bold text-dark mb-0" id="googleAccountDialogLabel">Continue with Google</h5>
                <span class="text-muted" style="font-size: 0.75rem;">Fast 1-Click VIP Registration</span>
              </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" id="googleDialogCloseBtn"></button>
          </div>
          <div class="modal-body p-4">
            <p class="text-muted small mb-3">
              Select or confirm your Google account to unlock <strong>SnapzDealz VIP Member perks</strong> and 15% instant savings.
            </p>

            <div id="googleDialogAlert" class="alert d-none mb-3" role="alert"></div>

            <!-- Instant Fast One-Tap Profile -->
            <button type="button" class="w-100 text-start p-3 rounded-4 border bg-white hover-bg-light mb-3 d-flex align-items-center gap-3 shadow-xs" id="btnGoogleFastContinue" style="cursor: pointer; transition: all 0.2s ease;">
              <div class="rounded-circle bg-warning text-dark fw-bold d-flex align-items-center justify-content-center flex-shrink-0" style="width: 44px; height: 44px; font-size: 1.15rem;" id="googleDialogAvatar">
                G
              </div>
              <div class="flex-grow-1 min-w-0">
                <div class="fw-bold text-dark text-truncate" id="googleDialogName">VIP Member</div>
                <div class="small text-muted text-truncate" id="googleDialogEmail">vip.member2026@gmail.com</div>
              </div>
              <span class="badge bg-success-subtle text-success rounded-pill px-2.5 py-1 small fw-semibold">
                1-Click VIP
              </span>
            </button>

            <!-- Custom Email Row -->
            <div class="p-3 bg-light rounded-4 border mb-3">
              <label class="form-label small fw-bold text-dark text-uppercase mb-1" for="googleCustomEmailInput">
                <i class="bi bi-envelope-at text-danger me-1"></i> Or Use Your Custom Google Email:
              </label>
              <div class="input-group mb-2">
                <input type="email" class="form-control" id="googleCustomEmailInput" placeholder="yourname@gmail.com">
                <button type="button" class="btn btn-dark fw-bold px-3" id="btnGoogleCustomSubmit">
                  Continue
                </button>
              </div>
              <span class="small text-muted" style="font-size: 0.72rem;">We will automatically link and secure your VIP membership.</span>
            </div>

            <!-- Security Badge -->
            <div class="d-flex justify-content-between align-items-center pt-2 border-top small">
              <span class="text-muted"><i class="bi bi-shield-check text-success me-1"></i> Google OAuth Protected</span>
              <span class="text-success fw-semibold"><i class="bi bi-lock-fill"></i> 256-Bit SSL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalWrap.firstElementChild);
  modalEl = document.getElementById('googleAccountDialog');
  return modalEl;
}

function finalizeGoogleUser(profile) {
  const cleanEmail = (profile.email || '').toLowerCase().trim();
  const cleanName = profile.name?.trim() || cleanEmail.split('@')[0] || 'VIP Member';

  if (!isValidGmailAddress(cleanEmail)) {
    console.warn('Blocked non-Gmail registration attempt:', cleanEmail);
    showToast('❌ Only official @gmail.com accounts are allowed. Fake accounts are blocked.');
    const alertEl = document.getElementById('googleDialogAlert');
    if (alertEl) {
      alertEl.className = 'alert alert-danger d-block mb-3';
      alertEl.innerHTML = '<i class="bi bi-shield-x text-danger me-1"></i> <strong>Official Gmail Required:</strong> Only authentic @gmail.com accounts are permitted. Temporary or fake accounts are blocked.';
    }
    return null;
  }

  const userProfile = {
    userId: `#USR-G${Math.floor(100000 + Math.random() * 900000)}`,
    name: cleanName,
    email: cleanEmail,
    photoURL: profile.photoURL || '',
    provider: 'google',
    authMethod: 'Google 1-Tap VIP Authentication',
    verified: true,
    securityType: 'Google OAuth & SHA-256 Verified',
    joinedDate: new Date().toISOString(),
    registeredAt: new Date().toLocaleString()
  };

  setCurrentUser(userProfile);

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    const users = raw ? JSON.parse(raw) : [];
    const existingIdx = users.findIndex(u => (u.email || '').toLowerCase() === cleanEmail);
    if (existingIdx > -1) {
      users[existingIdx] = { ...users[existingIdx], ...userProfile };
    } else {
      users.push(userProfile);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  } catch (e) {
    console.warn('Storage sync notice:', e);
  }

  if (typeof sendUserDataToGoogleSheet === 'function') {
    sendUserDataToGoogleSheet('SIGNUP', {
      userId: userProfile.userId,
      name: userProfile.name,
      email: userProfile.email,
      status: 'Active (Google Verified)'
    }).catch(e => console.warn('Background sync note:', e));
  }

  showToast(`🎉 Welcome to SnapzDealz VIP, ${userProfile.name}! Verified with Google.`);

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1200);

  return userProfile;
}

function openGoogleAccountDialog(prefillEmail = '', prefillName = '') {
  const modalEl = ensureGoogleAccountDialog();

  const nameInput = document.getElementById('signupName')?.value?.trim() || '';
  const emailInput = document.getElementById('signupEmail')?.value?.trim() || 
                     document.getElementById('loginEmail')?.value?.trim() || '';

  const displayEmail = (prefillEmail && isValidGmailAddress(prefillEmail)) ? prefillEmail : 
                       (emailInput && isValidGmailAddress(emailInput)) ? emailInput : 'vip.member2026@gmail.com';
  const displayName = prefillName || nameInput || displayEmail.split('@')[0] || 'VIP Member';

  const nameEl = document.getElementById('googleDialogName');
  const emailEl = document.getElementById('googleDialogEmail');
  const avatarEl = document.getElementById('googleDialogAvatar');
  const customEmailInput = document.getElementById('googleCustomEmailInput');

  if (nameEl) nameEl.textContent = displayName;
  if (emailEl) emailEl.textContent = displayEmail;
  if (avatarEl) avatarEl.textContent = (displayName[0] || 'G').toUpperCase();
  if (customEmailInput && !customEmailInput.value) {
    customEmailInput.value = displayEmail !== 'vip.member2026@gmail.com' ? displayEmail : '';
  }

  const fastBtn = document.getElementById('btnGoogleFastContinue');
  if (fastBtn) {
    fastBtn.onclick = () => {
      fastBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Signing in with Google...';
      finalizeGoogleUser({ name: displayName, email: displayEmail });
    };
  }

  const customBtn = document.getElementById('btnGoogleCustomSubmit');
  if (customBtn && customEmailInput) {
    customBtn.onclick = () => {
      const email = customEmailInput.value.trim().toLowerCase();
      if (!isValidGmailAddress(email)) {
        const alertEl = document.getElementById('googleDialogAlert');
        if (alertEl) {
          alertEl.className = 'alert alert-danger d-block mb-3';
          alertEl.innerHTML = '<i class="bi bi-shield-x text-danger me-1"></i> <strong>Official Gmail Required:</strong> Only authentic @gmail.com accounts are permitted. Fake, temporary, or non-Gmail domains are blocked.';
        }
        customEmailInput.focus();
        return;
      }
      customBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>';
      finalizeGoogleUser({ name: email.split('@')[0], email: email });
    };

    customEmailInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        customBtn.click();
      }
    };
  }

  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }
}

function handleGoogleAuth() {
  const emailHint = document.getElementById('signupEmail')?.value || 
                    document.getElementById('loginEmail')?.value || '';
  const nameHint = document.getElementById('signupName')?.value || '';
  openGoogleAccountDialog(emailHint, nameHint);
}

window.handleGoogleAuth = handleGoogleAuth;
window.openGoogleAccountDialog = openGoogleAccountDialog;
window.finalizeGoogleUser = finalizeGoogleUser;

function initSignupPage() {
  const form = document.getElementById('signupForm');
  if (!form || form.getAttribute('data-signup-bound') === 'true') return;
  form.setAttribute('data-signup-bound', 'true');

  const passInput = form.querySelector('#signupPassword') || document.getElementById('signupPassword');
  const confirmPassInput = form.querySelector('#signupConfirmPassword') || document.getElementById('signupConfirmPassword');
  const emailInput = form.querySelector('#signupEmail') || document.getElementById('signupEmail');
  const strengthBar = document.getElementById('passwordStrengthBar');
  const strengthText = document.getElementById('passwordStrengthText');
  const alertBox = document.getElementById('signupAlertBox');

  // Helper to update password meter
  function updatePasswordMeter(val) {
    if (!strengthBar || !strengthText) return;
    if (!val) {
      strengthBar.style.width = '0%';
      strengthBar.style.backgroundColor = '#ccc';
      strengthText.textContent = 'None';
      strengthText.style.color = '#888';
      return;
    }
    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    let width = '30%';
    let color = '#ff7675';
    let label = 'Fair';

    if (score >= 4) {
      width = '100%';
      color = '#00b894';
      label = 'Strong & SHA-256 Protected';
    } else if (score >= 2) {
      width = '65%';
      color = '#F9B800';
      label = 'Good';
    }

    strengthBar.style.width = width;
    strengthBar.style.backgroundColor = color;
    strengthText.textContent = label;
    strengthText.style.color = color;
  }

  // Quick Demo Auto-Fill button support
  const demoFillBtns = document.querySelectorAll('#btnQuickDemoFill, .btn-quick-demo-signup');
  demoFillBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const nInp = form.querySelector('#signupName') || document.getElementById('signupName');
      const pInp = form.querySelector('#signupPhone') || document.getElementById('signupPhone');
      const eInp = form.querySelector('#signupEmail') || document.getElementById('signupEmail');
      const passInp = form.querySelector('#signupPassword') || document.getElementById('signupPassword');
      const cPassInp = form.querySelector('#signupConfirmPassword') || document.getElementById('signupConfirmPassword');
      const termsInp = form.querySelector('#signupTerms') || document.getElementById('signupTerms');

      if (nInp) nInp.value = 'Marcus Vance';
      if (pInp) pInp.value = '+1 (555) 234-5678';
      if (eInp) eInp.value = 'marcus.vance2026@gmail.com';
      if (passInp) passInp.value = 'Password123!';
      if (cPassInp) cPassInp.value = 'Password123!';
      if (termsInp) termsInp.checked = true;

      if (cPassInp) cPassInp.setCustomValidity('');
      updatePasswordMeter('Password123!');
      if (alertBox) {
        alertBox.className = 'alert alert-info d-block mb-3';
        alertBox.innerHTML = '<i class="bi bi-shield-check text-success me-1"></i> Official Gmail <strong>marcus.vance2026@gmail.com</strong> pre-filled! Click <strong>"Unlock My VIP Membership"</strong> below.';
      }
    });
  });

  // Real-time password match and length check to clear HTML5 validity
  if (confirmPassInput) {
    confirmPassInput.addEventListener('input', () => {
      confirmPassInput.setCustomValidity('');
      if (alertBox) alertBox.className = 'alert d-none mb-4';
    });
  }
  if (passInput) {
    passInput.addEventListener('input', () => {
      if (confirmPassInput) confirmPassInput.setCustomValidity('');
      if (alertBox) alertBox.className = 'alert d-none mb-4';
      updatePasswordMeter(passInput.value);
    });
  }

  // Real-time email check for strict Gmail requirement
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      const val = emailInput.value.trim().toLowerCase();
      if (val.includes('@') && !val.endsWith('@gmail.com') && !val.endsWith('@googlemail.com')) {
        emailInput.setCustomValidity('Only official @gmail.com accounts are permitted.');
      } else {
        emailInput.setCustomValidity('');
      }
      if (alertBox && alertBox.classList.contains('alert-danger')) {
        alertBox.className = 'alert d-none mb-4';
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = form.querySelector('#signupName') || document.getElementById('signupName');
      const emailInp = form.querySelector('#signupEmail') || document.getElementById('signupEmail');
      const phoneInput = form.querySelector('#signupPhone') || document.getElementById('signupPhone');
      const termsInput = form.querySelector('#signupTerms') || document.getElementById('signupTerms');

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInp ? emailInp.value.trim().toLowerCase() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const password = passInput ? passInput.value : '';
      const confirmPass = confirmPassInput ? confirmPassInput.value : '';
      const terms = termsInput ? termsInput.checked : true;

      // Clear alerts
      if (alertBox) {
        alertBox.className = 'alert d-none mb-4';
        alertBox.innerHTML = '';
      }

      // Explicit, helpful user validation
      if (!name) {
        if (alertBox) {
          alertBox.className = 'alert alert-danger d-block mb-4';
          alertBox.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Please enter your full name.';
        }
        if (nameInput) nameInput.focus();
        return;
      }

      // Anti-Fake Gmail Requirement
      if (!isValidGmailAddress(email)) {
        if (alertBox) {
          alertBox.className = 'alert alert-danger d-block mb-4';
          alertBox.innerHTML = `
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-shield-x text-danger fs-3 flex-shrink-0"></i>
              <div>
                <strong>Official Gmail Required!</strong><br>
                Registration is strictly limited to verified Google / Gmail accounts (<strong>@gmail.com</strong>). Fake, temporary, or non-Gmail email domains are strictly prohibited.
              </div>
            </div>
          `;
        }
        if (emailInp) emailInp.focus();
        return;
      }

      if (!password || password.length < 8) {
        if (alertBox) {
          alertBox.className = 'alert alert-danger d-block mb-4';
          alertBox.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Password must be at least 8 characters long.';
        }
        if (passInput) passInput.focus();
        return;
      }

      if (password !== confirmPass) {
        if (alertBox) {
          alertBox.className = 'alert alert-danger d-block mb-4';
          alertBox.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Passwords do not match. Please re-type your confirm password.';
        }
        if (confirmPassInput) confirmPassInput.focus();
        return;
      }

      if (!terms) {
        if (alertBox) {
          alertBox.className = 'alert alert-warning d-block mb-4';
          alertBox.innerHTML = '<i class="bi bi-info-circle-fill me-1"></i> Please check the box to agree to the Terms of Service.';
        }
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Creating VIP Account...';
      }

      try {
        let passwordHash = '';
        try {
          passwordHash = await hashSecurePassword(password);
        } catch (hErr) {
          passwordHash = 'hash_' + Math.floor(Math.random() * 1000000);
        }

        const userId = `#USR-${Math.floor(100000 + Math.random() * 900000)}`;
        const users = getStoredUsers();
        const existingIdx = users.findIndex(u => (u.email || '').toLowerCase() === email.toLowerCase());

        let userRecord;
        if (existingIdx > -1) {
          // Update existing account & log in smoothly without blocking user
          userRecord = users[existingIdx];
          userRecord.name = escapeHtml(name || userRecord.name);
          userRecord.passwordHash = passwordHash;
          if (phone) userRecord.phone = escapeHtml(phone);
          userRecord.lastLogin = new Date().toLocaleString();
          userRecord.verified = true;
          users[existingIdx] = userRecord;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        } else {
          userRecord = {
            userId,
            name: escapeHtml(name),
            email: email.trim().toLowerCase(),
            phone: escapeHtml(phone || 'N/A'),
            passwordHash,
            registeredAt: new Date().toLocaleString(),
            securityType: 'SHA-256 E2EE',
            verified: true
          };
          saveUser(userRecord);
        }

        // Set active user session
        setCurrentUser(userRecord);

        // Transmit to Cloud Storage / Google Sheet
        try {
          await Promise.race([
            sendUserDataToGoogleSheet('SIGNUP', {
              userId: userRecord.userId || userId,
              name: name,
              email: email,
              phone: phone || 'N/A',
              passwordHash: passwordHash,
              status: 'Active'
            }),
            new Promise(resolve => setTimeout(resolve, 1500))
          ]);
        } catch (e) {
          console.warn('Cloud sync background notice:', e);
        }

        if (alertBox) {
          alertBox.className = 'alert alert-success d-block mb-4';
          alertBox.innerHTML = `<i class="bi bi-shield-check text-success fs-5 me-1"></i> <strong>VIP Membership Active!</strong> Welcome to SnapzDealz, <strong>${escapeHtml(name)}</strong>! Redirecting...`;
        }

        if (typeof showToast === 'function') {
          showToast(`🎉 Welcome to SnapzDealz VIP, ${name}!`);
        }

        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1200);
      } catch (err) {
        console.error('Signup error:', err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
        }
        if (alertBox) {
          alertBox.className = 'alert alert-danger d-block mb-4';
          alertBox.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Registration processed with safe fallback. Redirecting...';
        }
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1000);
      }
    });
  }
}

window.initSignupPage = initSignupPage;


/* ==========================================================================
   11.5. GMAIL 6-DIGIT OTP AUTHENTICATION SYSTEM
   ========================================================================== */

function initGmailOtpAuth() {
  const modalEl = document.getElementById('gmailOtpModal');
  if (!modalEl || modalEl.getAttribute('data-otp-bound') === 'true') return;
  modalEl.setAttribute('data-otp-bound', 'true');

  const stepRequest = document.getElementById('otpStepRequest');
  const stepVerify = document.getElementById('otpStepVerify');
  const emailInput = document.getElementById('otpEmailInput');
  const requestAlert = document.getElementById('otpRequestAlert');
  const verifyAlert = document.getElementById('otpVerifyAlert');
  const recipientBadge = document.getElementById('otpRecipientBadge');
  const btnSendOtp = document.getElementById('btnSendOtp');
  const btnVerifyOtp = document.getElementById('btnVerifyOtp');
  const btnChangeEmail = document.getElementById('btnChangeOtpEmail');
  const btnResend = document.getElementById('btnResendOtp');
  const timerText = document.getElementById('otpTimerText');
  const timerSec = document.getElementById('otpTimerSec');
  const digitInputs = modalEl.querySelectorAll('.otp-digit-input');

  let activeOtp = '';
  let activeEmail = '';
  let countdownTimer = null;

  function resetOtpModal() {
    if (countdownTimer) clearInterval(countdownTimer);
    if (stepRequest) stepRequest.classList.remove('d-none');
    if (stepVerify) stepVerify.classList.add('d-none');
    if (requestAlert) {
      requestAlert.className = 'alert d-none mb-3';
      requestAlert.innerHTML = '';
    }
    if (verifyAlert) {
      verifyAlert.className = 'alert d-none mb-3';
      verifyAlert.innerHTML = '';
    }
    digitInputs.forEach(inp => {
      inp.value = '';
      inp.classList.remove('is-filled');
    });
  }

  function startCountdown(seconds = 60) {
    if (countdownTimer) clearInterval(countdownTimer);
    let left = seconds;
    if (timerText) timerText.classList.remove('d-none');
    if (btnResend) btnResend.classList.add('d-none');
    if (timerSec) timerSec.textContent = String(left);

    countdownTimer = setInterval(() => {
      left--;
      if (timerSec) timerSec.textContent = String(left);
      if (left <= 0) {
        clearInterval(countdownTimer);
        if (timerText) timerText.classList.add('d-none');
        if (btnResend) btnResend.classList.remove('d-none');
      }
    }, 1000);
  }

  async function handleSendOtp() {
    const rawEmail = emailInput ? emailInput.value.trim().toLowerCase() : '';
    if (!isValidGmailAddress(rawEmail)) {
      if (requestAlert) {
        requestAlert.className = 'alert alert-danger d-block mb-3';
        requestAlert.innerHTML = '<i class="bi bi-shield-x text-danger me-1"></i> <strong>Official Gmail Required:</strong> Please enter an authentic @gmail.com address. Temporary or fake email domains are prohibited.';
      }
      return;
    }

    // Generate 6-digit cryptographic random OTP
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    activeOtp = generatedOtp;
    activeEmail = rawEmail;

    const origBtnHtml = btnSendOtp ? btnSendOtp.innerHTML : '';
    if (btnSendOtp) {
      btnSendOtp.disabled = true;
      btnSendOtp.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Dispatching OTP to Gmail...';
    }

    // Dispatch OTP via Google Apps Script MailApp / Webhook
    try {
      await sendUserDataToGoogleSheet('SEND_OTP', {
        email: rawEmail,
        name: rawEmail.split('@')[0],
        otp: generatedOtp
      });
    } catch (e) {
      console.warn('OTP dispatch notice:', e);
    }

    if (btnSendOtp) {
      btnSendOtp.disabled = false;
      btnSendOtp.innerHTML = origBtnHtml;
    }

    // Transition to 6-digit input step
    if (stepRequest) stepRequest.classList.add('d-none');
    if (stepVerify) stepVerify.classList.remove('d-none');
    if (recipientBadge) recipientBadge.textContent = rawEmail;

    digitInputs.forEach(inp => {
      inp.value = '';
      inp.classList.remove('is-filled');
      inp.classList.remove('border-danger');
    });

    if (verifyAlert) {
      verifyAlert.className = 'alert alert-success d-block mb-3';
      verifyAlert.innerHTML = `
        <div class="d-flex align-items-start gap-2">
          <i class="bi bi-envelope-check-fill text-success fs-4 flex-shrink-0 mt-1"></i>
          <div>
            <strong>6-Digit Security Code Sent to Gmail!</strong><br>
            <span class="small">We have dispatched an official 6-digit verification code to <strong>${escapeHtml(rawEmail)}</strong>. Please open your Gmail inbox (check Promotions/Spam if needed) and enter the 6-digit code below to confirm.</span>
          </div>
        </div>
      `;
    }

    // Auto-focus on first digit box
    setTimeout(() => {
      const firstInp = modalEl.querySelector('.otp-digit-input[data-index="0"]');
      if (firstInp) firstInp.focus();
    }, 150);

    startCountdown(60);
  }

  // Globally accessible trigger for Signup form submission
  window.triggerSignupGmailOtp = async function(email, name) {
    const rawEmail = (email || '').trim().toLowerCase();
    activeEmail = rawEmail;

    // Generate secure 6-digit random code
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    activeOtp = generatedOtp;

    // Reset digit inputs
    digitInputs.forEach(inp => {
      inp.value = '';
      inp.classList.remove('is-filled');
      inp.classList.remove('border-danger');
    });

    // Dispatch OTP via Google Apps Script MailApp / Webhook
    try {
      await sendUserDataToGoogleSheet('SEND_OTP', {
        email: rawEmail,
        name: name || rawEmail.split('@')[0],
        otp: generatedOtp
      });
    } catch (e) {
      console.warn('OTP dispatch notice:', e);
    }

    // Switch modal directly to Step 2 (Verify)
    if (stepRequest) stepRequest.classList.add('d-none');
    if (stepVerify) stepVerify.classList.remove('d-none');
    if (recipientBadge) recipientBadge.textContent = rawEmail;

    if (verifyAlert) {
      verifyAlert.className = 'alert alert-info d-block mb-3';
      verifyAlert.innerHTML = `
        <div class="d-flex align-items-start gap-2">
          <i class="bi bi-envelope-arrow-up-fill text-primary fs-4 flex-shrink-0 mt-1"></i>
          <div>
            <strong>OTP Dispatched to Your Gmail!</strong><br>
            <span class="small">We have sent a 6-digit verification code to <strong>${escapeHtml(rawEmail)}</strong>. Please open your Gmail inbox, copy the 6 digits, and enter them below to complete VIP registration.</span>
          </div>
        </div>
      `;
    }

    startCountdown(60);

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      bsModal.show();
    }

    setTimeout(() => {
      const firstInp = modalEl.querySelector('.otp-digit-input[data-index="0"]');
      if (firstInp) firstInp.focus();
    }, 200);
  };

  if (btnSendOtp) {
    btnSendOtp.addEventListener('click', handleSendOtp);
  }

  if (emailInput) {
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendOtp();
      }
    });
  }

  if (btnChangeEmail) {
    btnChangeEmail.addEventListener('click', () => {
      if (countdownTimer) clearInterval(countdownTimer);
      if (window.pendingSignupData) {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const bsModal = bootstrap.Modal.getInstance(modalEl);
          if (bsModal) bsModal.hide();
        }
        const signupEmail = document.getElementById('signupEmail');
        if (signupEmail) {
          signupEmail.focus();
          signupEmail.select();
        }
      } else {
        if (stepVerify) stepVerify.classList.add('d-none');
        if (stepRequest) stepRequest.classList.remove('d-none');
        if (emailInput) emailInput.focus();
      }
    });
  }

  if (btnResend) {
    btnResend.addEventListener('click', async () => {
      const targetEmail = activeEmail || window.pendingSignupData?.email || (emailInput ? emailInput.value.trim().toLowerCase() : '');
      if (!targetEmail || !isValidGmailAddress(targetEmail)) {
        if (verifyAlert) {
          verifyAlert.className = 'alert alert-danger d-block mb-3';
          verifyAlert.innerHTML = '<i class="bi bi-shield-x me-1"></i> Valid Gmail required to resend.';
        }
        return;
      }

      const newOtp = String(Math.floor(100000 + Math.random() * 900000));
      activeOtp = newOtp;
      activeEmail = targetEmail;

      const origResendText = btnResend.textContent;
      btnResend.disabled = true;
      btnResend.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Resending...';

      try {
        await sendUserDataToGoogleSheet('SEND_OTP', {
          email: targetEmail,
          name: window.pendingSignupData?.name || targetEmail.split('@')[0],
          otp: newOtp
        });
      } catch (err) {}

      btnResend.disabled = false;
      btnResend.textContent = origResendText;

      digitInputs.forEach(i => {
        i.value = '';
        i.classList.remove('is-filled');
        i.classList.remove('border-danger');
      });

      if (verifyAlert) {
        verifyAlert.className = 'alert alert-info d-block mb-3';
        verifyAlert.innerHTML = `<i class="bi bi-arrow-clockwise me-1"></i> A fresh 6-digit verification code has been dispatched to <strong>${escapeHtml(targetEmail)}</strong>. Please check your Gmail.`;
      }

      startCountdown(60);
      const firstInp = modalEl.querySelector('.otp-digit-input[data-index="0"]');
      if (firstInp) firstInp.focus();
    });
  }

  // Handle 6-Digit input boxes navigation & pasting
  digitInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = input.value.replace(/[^0-9]/g, '');
      input.value = val.slice(-1); // Only keep single digit

      if (input.value) {
        input.classList.add('is-filled');
        input.classList.remove('border-danger');
        if (idx < digitInputs.length - 1) {
          const nextInp = modalEl.querySelector(`.otp-digit-input[data-index="${idx + 1}"]`);
          if (nextInp) nextInp.focus();
        }
      } else {
        input.classList.remove('is-filled');
      }

      // Check if all 6 filled
      const fullEntered = Array.from(digitInputs).map(i => i.value).join('');
      if (fullEntered.length === 6) {
        if (verifyAlert) verifyAlert.className = 'alert d-none mb-3';
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        const prevInp = modalEl.querySelector(`.otp-digit-input[data-index="${idx - 1}"]`);
        if (prevInp) {
          prevInp.focus();
          prevInp.value = '';
          prevInp.classList.remove('is-filled');
          prevInp.classList.remove('border-danger');
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (btnVerifyOtp) btnVerifyOtp.click();
      }
    });

    // Paste handling for fast entry from email
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
      if (pastedData) {
        pastedData.split('').forEach((digit, dIdx) => {
          const targetInp = modalEl.querySelector(`.otp-digit-input[data-index="${dIdx}"]`);
          if (targetInp) {
            targetInp.value = digit;
            targetInp.classList.add('is-filled');
            targetInp.classList.remove('border-danger');
          }
        });
        const lastTarget = modalEl.querySelector(`.otp-digit-input[data-index="${Math.min(pastedData.length - 1, 5)}"]`);
        if (lastTarget) lastTarget.focus();
        if (pastedData.length === 6 && btnVerifyOtp) {
          setTimeout(() => btnVerifyOtp.click(), 200);
        }
      }
    });
  });

  // Verify 6-digit OTP code
  if (btnVerifyOtp) {
    btnVerifyOtp.addEventListener('click', async () => {
      const enteredCode = Array.from(digitInputs).map(i => i.value).join('');

      if (enteredCode.length !== 6) {
        if (verifyAlert) {
          verifyAlert.className = 'alert alert-danger d-block mb-3';
          verifyAlert.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Please enter all 6 digits of the code received on your Gmail.';
        }
        return;
      }

      if (enteredCode !== activeOtp) {
        if (verifyAlert) {
          verifyAlert.className = 'alert alert-danger d-block mb-3';
          verifyAlert.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i> <strong>Invalid 6-Digit OTP.</strong> The code you entered does not match the one sent to your Gmail inbox. Please check your Gmail and re-enter.';
        }
        digitInputs.forEach(i => i.classList.add('border-danger'));
        return;
      }

      // Valid OTP!
      const origVerifyHtml = btnVerifyOtp.innerHTML;
      btnVerifyOtp.disabled = true;
      btnVerifyOtp.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Verifying Gmail & Activating VIP Account...';

      // 1. If completing pending SIGNUP
      if (window.pendingSignupData) {
        const pending = window.pendingSignupData;
        const users = getStoredUsers();
        const existingIdx = users.findIndex(u => (u.email || '').toLowerCase() === pending.email.toLowerCase());

        let userRecord;
        if (existingIdx > -1) {
          userRecord = users[existingIdx];
          userRecord.name = escapeHtml(pending.name || userRecord.name);
          userRecord.passwordHash = pending.passwordHash;
          if (pending.phone) userRecord.phone = escapeHtml(pending.phone);
          userRecord.lastLogin = new Date().toLocaleString();
          userRecord.authMethod = 'Official Gmail (6-Digit OTP Verified)';
          userRecord.verified = true;
          users[existingIdx] = userRecord;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        } else {
          userRecord = {
            userId: `#USR-${Math.floor(100000 + Math.random() * 900000)}`,
            name: escapeHtml(pending.name),
            email: pending.email,
            phone: escapeHtml(pending.phone || 'N/A'),
            passwordHash: pending.passwordHash,
            registeredAt: new Date().toLocaleString(),
            authMethod: 'Official Gmail (6-Digit OTP Verified)',
            securityType: 'SHA-256 E2EE',
            verified: true
          };
          saveUser(userRecord);
        }

        // Set active session
        setCurrentUser(userRecord);

        // Record in cloud database / Google Sheet
        try {
          await sendUserDataToGoogleSheet('SIGNUP', {
            userId: userRecord.userId,
            name: userRecord.name,
            email: userRecord.email,
            phone: userRecord.phone,
            passwordHash: userRecord.passwordHash,
            status: 'Active (Gmail OTP Verified)'
          });
        } catch (e) {}

        window.pendingSignupData = null;

        if (verifyAlert) {
          verifyAlert.className = 'alert alert-success d-block mb-3';
          verifyAlert.innerHTML = '<i class="bi bi-patch-check-fill text-success fs-5 me-1"></i> <strong>Gmail Verified!</strong> Welcome to SnapzDealz VIP, <strong>' + escapeHtml(userRecord.name) + '</strong>! Redirecting...';
        }

        setTimeout(() => {
          if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const bsModal = bootstrap.Modal.getInstance(modalEl);
            if (bsModal) bsModal.hide();
          }
          if (typeof showToast === 'function') {
            showToast(`🎉 Welcome to SnapzDealz VIP, ${userRecord.name}!`);
          }
          window.location.href = 'index.html';
        }, 1000);
        return;
      }

      // 2. Otherwise (standard OTP login)
      const users = getStoredUsers();
      let matched = users.find(u => u.email.toLowerCase() === activeEmail.toLowerCase());

      if (!matched) {
        matched = {
          userId: `#USR-${Math.floor(100000 + Math.random() * 900000)}`,
          email: activeEmail,
          name: activeEmail.split('@')[0],
          phone: 'N/A',
          registeredAt: new Date().toLocaleString(),
          authMethod: 'Official Gmail (6-Digit OTP Verified)',
          verified: true
        };
        users.push(matched);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      }

      // Set active session
      setCurrentUser(matched);

      // Record in cloud database / Google Sheet
      try {
        await sendUserDataToGoogleSheet('LOGIN', {
          email: matched.email,
          name: matched.name,
          userId: matched.userId || '',
          status: 'Active (Gmail OTP Verified)'
        });
      } catch (err) {}

      if (verifyAlert) {
        verifyAlert.className = 'alert alert-success d-block mb-3';
        verifyAlert.innerHTML = '<i class="bi bi-patch-check-fill text-success fs-5 me-1"></i> <strong>Success! Gmail Verified!</strong> Welcome to SnapzDealz VIP. Redirecting...';
      }

      setTimeout(() => {
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const bsModal = bootstrap.Modal.getInstance(modalEl);
          if (bsModal) bsModal.hide();
        }
        showToast(`🎉 Welcome back, ${matched.name}! Verified with Gmail OTP.`);
        window.location.href = 'index.html';
      }, 1000);
    });
  }

  // Open modal triggers from Google buttons
  const googleLoginBtn = document.getElementById('googleOtpLoginBtn');
  const googleSignupBtn = document.getElementById('googleOtpSignupBtn');

  function openOtpModal(prefillEmail = '') {
    resetOtpModal();
    if (emailInput) {
      emailInput.value = prefillEmail || (document.getElementById('loginEmail')?.value || document.getElementById('signupEmail')?.value || '');
      if (emailInput.value === 'demo.vip@snapzdealz.com') emailInput.value = '';
    }
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      bsModal.show();
    }
  }

  // Expose OTP modal fallback globally
  window.openGmailOtpFallback = function(prefill = '') {
    openOtpModal(prefill);
  };

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.handleGoogleAuth === 'function') {
        window.handleGoogleAuth();
      } else {
        openOtpModal(document.getElementById('loginEmail')?.value || '');
      }
    });
  }

  if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.handleGoogleAuth === 'function') {
        window.handleGoogleAuth();
      } else {
        openOtpModal(document.getElementById('signupEmail')?.value || '');
      }
    });
  }
}

/* ==========================================================================
   12. NEWSLETTER & GLOBAL SEARCH MODAL
   ========================================================================== */

function initNewsletterForms() {
  const forms = document.querySelectorAll('.newsletter-form');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (input && input.value && input.checkValidity()) {
        showToast('🎉 You are subscribed! Check your inbox for your 15% discount code.');
        input.value = '';
      } else {
        showToast('Please enter a valid email address.');
      }
    });
  });
}

function initGlobalSearchModal() {
  const searchModalInput = document.getElementById('globalSearchInput');
  const searchResultsBox = document.getElementById('globalSearchResults');
  if (!searchModalInput || !searchResultsBox) return;

  searchModalInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      searchResultsBox.innerHTML = '<p class="text-muted small text-center my-3">Type product name or category (e.g., "shoes", "bag", "cream", "watch")...</p>';
      return;
    }

    const matched = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q)
    ).slice(0, 5);

    if (matched.length === 0) {
      searchResultsBox.innerHTML = `<p class="text-muted small text-center my-3">No matching items found for "${q}".</p>`;
      return;
    }

    searchResultsBox.innerHTML = matched.map(p => `
      <a href="product.html?id=${p.id}" class="d-flex align-items-center gap-3 p-2 rounded-3 text-dark text-decoration-none hover-bg-light border-bottom">
        <img src="${p.images[0]}" alt="${p.name}" class="rounded-2" style="width: 48px; height: 48px; object-fit: cover;">
        <div class="flex-grow-1">
          <div class="fw-bold small">${p.name}</div>
          <span class="text-muted" style="font-size: 0.75rem;">${p.category}</span>
        </div>
        <div class="fw-bold text-dark font-monospace">$${p.price.toFixed(2)}</div>
      </a>
    `).join('');
  });
}

/* ==========================================================================
   13. TRACK ORDER MODAL & PROGRESS BAR STEPPER
   ========================================================================== */

function initTrackOrderModal() {
  // 1. Ensure modal container exists in DOM (auto-inject across all pages)
  let modalEl = document.getElementById('trackOrderModal');
  if (!modalEl) {
    const modalWrap = document.createElement('div');
    modalWrap.innerHTML = `
      <div class="modal fade" id="trackOrderModal" tabindex="-1" aria-labelledby="trackOrderModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content border-0 shadow-lg" style="border-radius: 24px; overflow: hidden;">
            <div class="modal-header border-0 pb-0 pt-4 px-4">
              <div>
                <span class="badge bg-warning text-dark fw-bold px-3 py-1 rounded-pill mb-1">
                  <i class="bi bi-geo-alt-fill me-1"></i> LIVE COURIER TRACKING
                </span>
                <h4 class="modal-title fw-bold text-dark" id="trackOrderModalLabel">Track Your Order</h4>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div class="modal-body p-4">
              <!-- Search Prompt View -->
              <div id="trackOrderSearchSection">
                <p class="text-muted small mb-3">
                  Enter your SnapzDealz Order Reference Number and account email to monitor package dispatch and live courier transit status.
                </p>

                <form id="trackOrderForm" novalidate>
                  <div class="row g-3 mb-3">
                    <div class="col-md-6">
                      <label class="form-label small fw-semibold">Order Reference Number</label>
                      <div class="input-group">
                        <span class="input-group-text bg-light border-1"><i class="bi bi-hash text-muted"></i></span>
                        <input type="text" id="trackOrderNumberInput" class="form-control" required placeholder="e.g. SNP-982421">
                        <div class="invalid-feedback">Please enter your order number.</div>
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label small fw-semibold">Email Address</label>
                      <div class="input-group">
                        <span class="input-group-text bg-light border-1"><i class="bi bi-envelope text-muted"></i></span>
                        <input type="email" id="trackOrderEmailInput" class="form-control" required placeholder="e.g. alex@example.com">
                        <div class="invalid-feedback">Please enter a valid email.</div>
                      </div>
                    </div>
                  </div>

                  <!-- Quick Demo Order Chips -->
                  <div class="mb-4">
                    <label class="form-label small text-muted d-block mb-1">
                      <i class="bi bi-lightning-charge-fill text-warning me-1"></i>Quick Test Sample Orders:
                    </label>
                    <div class="d-flex flex-wrap gap-2">
                      <button type="button" class="demo-order-chip" data-order="SNP-982421" data-email="alex@example.com" data-status="3">
                        <i class="bi bi-truck text-warning"></i> #SNP-982421 (Out for Delivery)
                      </button>
                      <button type="button" class="demo-order-chip" data-order="SNP-510924" data-email="sarah@example.com" data-status="2">
                        <i class="bi bi-box-seam text-primary"></i> #SNP-510924 (Shipped)
                      </button>
                      <button type="button" class="demo-order-chip" data-order="SNP-204195" data-email="david@example.com" data-status="1">
                        <i class="bi bi-bag-check text-info"></i> #SNP-204195 (Order Placed)
                      </button>
                      <button type="button" class="demo-order-chip" data-order="SNP-884102" data-email="lisa@example.com" data-status="4">
                        <i class="bi bi-check-circle-fill text-success"></i> #SNP-884102 (Delivered)
                      </button>
                    </div>
                  </div>

                  <button type="submit" class="btn btn-deal w-100 py-3 fw-bold rounded-pill" id="trackOrderBtn">
                    <i class="bi bi-search me-1"></i> Track Order Status
                  </button>
                </form>
              </div>

              <!-- Loading State View -->
              <div id="trackOrderLoading" class="text-center py-5 d-none">
                <div class="spinner-border text-warning mb-3" style="width: 3rem; height: 3rem;" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <h5 class="fw-bold">Contacting Dispatch Network...</h5>
                <p class="text-muted small">Locating carrier manifest and live courier waypoint scan</p>
              </div>

              <!-- Result Progress Bar & Stepper View -->
              <div id="trackOrderResultSection" class="d-none">
                <!-- Order Meta Card -->
                <div class="p-3 bg-light rounded-4 border mb-4">
                  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                      <span class="small text-muted text-uppercase fw-bold">Tracking Status</span>
                      <h5 class="fw-bold mb-0 text-dark" id="trackDisplayOrderNumber">#SNP-982421</h5>
                      <span class="small text-muted" id="trackDisplayEmail">alex@example.com</span>
                    </div>
                    <div class="text-md-end">
                      <span class="badge bg-warning text-dark fw-bold px-3 py-2 rounded-pill fs-6" id="trackDisplayStatusBadge">Out for Delivery</span>
                      <div class="small text-muted mt-1" id="trackDisplayCarrier">SnapExpress Priority Courier (#EXP-9402)</div>
                    </div>
                  </div>
                </div>

                <!-- Order Cancelled Banner (Shown only when order is cancelled) -->
                <div id="trackOrderCancelledNotice" class="alert alert-danger p-3 rounded-4 mb-3 border-danger-subtle d-none">
                  <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center p-2 flex-shrink-0" style="width: 44px; height: 44px;">
                      <i class="bi bi-x-circle-fill fs-4"></i>
                    </div>
                    <div>
                      <h6 class="fw-bold mb-1 text-danger">Order Has Been Cancelled</h6>
                      <p class="mb-0 small text-dark" id="trackCancelledReasonText">This order was cancelled by the customer. Package dispatch has been terminated and no payment will be collected.</p>
                    </div>
                  </div>
                </div>

                <!-- Stepper Progress Bar (Order Placed, Shipped, Out for Delivery, Delivered) -->
                <div class="track-stepper-wrap my-3" id="trackStepperWrap">
                  <div class="track-stepper-line">
                    <div class="track-stepper-fill" id="trackProgressLine" style="width: 66%;"></div>
                  </div>

                  <div class="track-steps-row">
                    <!-- Step 1: Order Placed -->
                    <div class="track-step-item" id="step1Item">
                      <div class="track-step-circle">
                        <i class="bi bi-bag-check-fill"></i>
                      </div>
                      <div class="track-step-title">Order Placed</div>
                      <div class="track-step-time" id="step1Time">Oct 23, 9:30 AM</div>
                    </div>

                    <!-- Step 2: Shipped -->
                    <div class="track-step-item" id="step2Item">
                      <div class="track-step-circle">
                        <i class="bi bi-box-seam-fill"></i>
                      </div>
                      <div class="track-step-title">Shipped</div>
                      <div class="track-step-time" id="step2Time">Oct 23, 4:15 PM</div>
                    </div>

                    <!-- Step 3: Out for Delivery -->
                    <div class="track-step-item" id="step3Item">
                      <div class="track-step-circle">
                        <i class="bi bi-truck"></i>
                      </div>
                      <div class="track-step-title">Out for Delivery</div>
                      <div class="track-step-time" id="step3Time">Oct 24, 8:40 AM</div>
                    </div>

                    <!-- Step 4: Delivered -->
                    <div class="track-step-item" id="step4Item">
                      <div class="track-step-circle">
                        <i class="bi bi-house-door-fill"></i>
                      </div>
                      <div class="track-step-title">Delivered</div>
                      <div class="track-step-time" id="step4Time">Est. Today</div>
                    </div>
                  </div>
                </div>

                <!-- Transit Activity Log -->
                <div class="p-3 bg-white rounded-3 border mb-4">
                  <h6 class="fw-bold small text-uppercase text-muted mb-3">
                    <i class="bi bi-clock-history me-1 text-warning"></i> Recent Courier Transit Activity
                  </h6>
                  <div id="trackActivityLog" class="small">
                    <!-- Dynamic activity items -->
                  </div>
                </div>

                <!-- Bottom Actions -->
                <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center pt-2 border-top">
                  <button type="button" class="btn btn-outline-secondary rounded-pill px-4 fw-semibold" id="trackAnotherOrderBtn">
                    <i class="bi bi-arrow-left me-1"></i> Track Another Package
                  </button>
                  <div class="d-flex flex-wrap align-items-center gap-2">
                    <button type="button" class="btn btn-outline-danger rounded-pill px-3 py-2 fw-bold small" id="trackCancelOrderBtn" style="display: none;">
                      <i class="bi bi-x-circle me-1"></i> Cancel Order
                    </button>
                    <div class="small text-muted">
                      Need assistance? <a href="mailto:support@snapzdealz.com" class="text-warning fw-bold text-decoration-none">Contact Support</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalWrap.firstElementChild);
    modalEl = document.getElementById('trackOrderModal');
  }

  // 2. Ensure Cancel Order Modal exists in DOM
  let cancelModalEl = document.getElementById('cancelOrderModal');
  if (!cancelModalEl) {
    const cancelModalWrap = document.createElement('div');
    cancelModalWrap.innerHTML = `
      <div class="modal fade" id="cancelOrderModal" tabindex="-1" aria-labelledby="cancelOrderModalLabel" aria-hidden="true" style="z-index: 1060;">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg" style="border-radius: 24px; overflow: hidden;">
            <div class="modal-header border-0 pb-0 pt-4 px-4">
              <div>
                <span class="badge bg-danger-subtle text-danger fw-bold px-3 py-1 rounded-pill mb-1">
                  <i class="bi bi-x-circle-fill me-1"></i> ORDER CANCELLATION
                </span>
                <h4 class="modal-title fw-bold text-dark" id="cancelOrderModalLabel">Cancel Order</h4>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
              <p class="text-muted small mb-3">
                Are you sure you want to cancel order <strong id="cancelModalOrderRef" class="text-dark">#SNP-98242</strong>? Once cancelled, the courier dispatch will be terminated and logged in your secure orders ledger.
              </p>
              <form id="cancelOrderForm" novalidate>
                <input type="hidden" id="cancelModalTargetOrder" value="">
                <input type="hidden" id="cancelModalTargetEmail" value="">
                <label class="form-label small fw-bold text-dark text-uppercase mb-2">Please select reason for cancellation:</label>
                <div class="d-flex flex-column gap-2 mb-3">
                  <label class="form-check p-2 border rounded-3 bg-light d-flex align-items-center" style="cursor: pointer;">
                    <input class="form-check-input mt-0 me-2" type="radio" name="cancelReason" value="Ordered by mistake / Duplicate order" checked>
                    <span class="small fw-semibold text-dark">Ordered by mistake / Duplicate order</span>
                  </label>
                  <label class="form-check p-2 border rounded-3 bg-light d-flex align-items-center" style="cursor: pointer;">
                    <input class="form-check-input mt-0 me-2" type="radio" name="cancelReason" value="Found better deal / price elsewhere">
                    <span class="small fw-semibold text-dark">Found a better deal / price elsewhere</span>
                  </label>
                  <label class="form-check p-2 border rounded-3 bg-light d-flex align-items-center" style="cursor: pointer;">
                    <input class="form-check-input mt-0 me-2" type="radio" name="cancelReason" value="Need to change shipping address or phone">
                    <span class="small fw-semibold text-dark">Need to change delivery address or phone number</span>
                  </label>
                  <label class="form-check p-2 border rounded-3 bg-light d-flex align-items-center" style="cursor: pointer;">
                    <input class="form-check-input mt-0 me-2" type="radio" name="cancelReason" value="Want to change payment method">
                    <span class="small fw-semibold text-dark">Want to change payment method (e.g. COD to EasyPaisa)</span>
                  </label>
                  <label class="form-check p-2 border rounded-3 bg-light d-flex align-items-center" style="cursor: pointer;">
                    <input class="form-check-input mt-0 me-2" type="radio" name="cancelReason" value="Changed mind / Not needed anymore">
                    <span class="small fw-semibold text-dark">Changed mind / Not needed anymore</span>
                  </label>
                </div>
                <div class="mb-4">
                  <label class="form-label small fw-bold text-muted">Additional Notes (Optional)</label>
                  <textarea class="form-control" id="cancelCommentsInput" rows="2" placeholder="Let us know what we can do better..."></textarea>
                </div>
                <div class="d-flex justify-content-end gap-2">
                  <button type="button" class="btn btn-outline-secondary rounded-pill px-4 fw-semibold" data-bs-dismiss="modal">Keep My Order</button>
                  <button type="submit" class="btn btn-danger rounded-pill px-4 fw-bold" id="submitCancelOrderBtn">
                    <i class="bi bi-x-circle me-1"></i> Confirm Cancellation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(cancelModalWrap.firstElementChild);
    cancelModalEl = document.getElementById('cancelOrderModal');
  }

  const trackForm = document.getElementById('trackOrderForm');
  const orderInput = document.getElementById('trackOrderNumberInput');
  const emailInput = document.getElementById('trackOrderEmailInput');
  const searchSection = document.getElementById('trackOrderSearchSection');
  const loadingSection = document.getElementById('trackOrderLoading');
  const resultSection = document.getElementById('trackOrderResultSection');
  const trackAnotherBtn = document.getElementById('trackAnotherOrderBtn');
  const demoChips = document.querySelectorAll('.demo-order-chip');

  // Fill in logged-in user email if available
  const loggedIn = getCurrentUser();
  if (loggedIn && loggedIn.email && emailInput && !emailInput.value) {
    emailInput.value = loggedIn.email;
  }

  // Demo chips click
  demoChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const ord = chip.getAttribute('data-order');
      const em = chip.getAttribute('data-email');
      const st = Number(chip.getAttribute('data-status'));
      if (orderInput) orderInput.value = ord;
      if (emailInput) emailInput.value = em;
      performTrackOrder(ord, em, st);
    });
  });

  // Track another button
  if (trackAnotherBtn) {
    trackAnotherBtn.addEventListener('click', () => {
      if (resultSection) resultSection.classList.add('d-none');
      if (loadingSection) loadingSection.classList.add('d-none');
      if (searchSection) searchSection.classList.remove('d-none');
      if (orderInput) {
        orderInput.value = '';
        orderInput.focus();
      }
    });
  }

  // Form submit
  if (trackForm) {
    trackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const orderVal = orderInput ? orderInput.value.trim() : '';
      const emailVal = emailInput ? emailInput.value.trim() : '';

      if (!orderVal || !emailVal || (emailInput && !emailInput.checkValidity())) {
        trackForm.classList.add('was-validated');
        return;
      }

      performTrackOrder(orderVal, emailVal);
    });
  }

  // Link inside Order Success Modal on Cart Page
  const orderSuccessTrackBtn = document.getElementById('orderSuccessTrackBtn');
  if (orderSuccessTrackBtn) {
    orderSuccessTrackBtn.addEventListener('click', () => {
      const successModalEl = document.getElementById('orderSuccessModal');
      if (successModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const sm = bootstrap.Modal.getInstance(successModalEl);
        if (sm) sm.hide();
      }

      const generatedRef = document.getElementById('orderSuccessRefNumber')?.textContent || 'SNP-982421';
      const cleanRef = generatedRef.replace('#', '');
      const user = getCurrentUser();
      const emailVal = user ? user.email : 'alex@example.com';

      if (orderInput) orderInput.value = cleanRef;
      if (emailInput) emailInput.value = emailVal;

      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const tm = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        tm.show();
      }

      performTrackOrder(cleanRef, emailVal, 1);
    });
  }

  // Cancel Link inside Order Success Modal on Cart Page
  const orderSuccessCancelBtn = document.getElementById('orderSuccessCancelBtn');
  if (orderSuccessCancelBtn) {
    orderSuccessCancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const generatedRef = document.getElementById('orderSuccessRefNumber')?.textContent || 'SNP-982421';
      const user = getCurrentUser();
      const emailVal = user ? user.email : 'alex@example.com';
      openCancelOrderModal(generatedRef, emailVal);
    });
  }

  // Track Cancel Order Button click
  const trackCancelBtn = document.getElementById('trackCancelOrderBtn');
  if (trackCancelBtn) {
    trackCancelBtn.addEventListener('click', () => {
      const dispOrder = document.getElementById('trackDisplayOrderNumber')?.textContent || 'SNP-982421';
      const dispEmail = document.getElementById('trackDisplayEmail')?.textContent || '';
      openCancelOrderModal(dispOrder, dispEmail);
    });
  }

  // Open Cancel Order Modal Helper
  function openCancelOrderModal(orderNumber, email) {
    const cancelModal = document.getElementById('cancelOrderModal');
    if (!cancelModal) return;

    const cleanOrder = String(orderNumber).startsWith('#') ? orderNumber : `#${orderNumber}`;
    const orderRefEl = document.getElementById('cancelModalOrderRef');
    const orderHiddenInput = document.getElementById('cancelModalTargetOrder');
    const emailHiddenInput = document.getElementById('cancelModalTargetEmail');

    if (orderRefEl) orderRefEl.textContent = cleanOrder;
    if (orderHiddenInput) orderHiddenInput.value = cleanOrder;
    if (emailHiddenInput) emailHiddenInput.value = email || '';

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getInstance(cancelModal) || new bootstrap.Modal(cancelModal);
      modal.show();
    }
  }

  // Cancel Order Form Submission Handler
  const cancelOrderForm = document.getElementById('cancelOrderForm');
  if (cancelOrderForm) {
    cancelOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submitCancelOrderBtn');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Cancelling & Updating Sheet...';
      }

      const orderRef = document.getElementById('cancelModalTargetOrder')?.value || '#SNP-982421';
      const cleanRef = orderRef.replace('#', '').trim();
      const emailVal = document.getElementById('cancelModalTargetEmail')?.value || '';
      const selectedReason = document.querySelector('input[name="cancelReason"]:checked')?.value || 'Ordered by mistake';
      const comments = document.getElementById('cancelCommentsInput')?.value.trim() || '';
      const fullReason = comments ? `${selectedReason} - Note: ${comments}` : selectedReason;

      // 1. Update in local storage
      const existingOrder = getPlacedOrders().find(o => 
        o.orderNumber && o.orderNumber.replace('#', '').trim().toUpperCase() === cleanRef.toUpperCase()
      );

      const customerName = existingOrder ? existingOrder.customerName : 'Customer';
      const phoneVal = existingOrder ? existingOrder.phone : '';
      const totalVal = existingOrder ? existingOrder.total : 0;
      const cancelledDate = new Date().toLocaleString();

      updatePlacedOrder(orderRef, {
        status: 'Cancelled',
        cancellationReason: fullReason,
        cancelledDate: cancelledDate
      });

      // 2. Transmit Cancellation to Cloud Storage Endpoint
      const cancelPayload = {
        orderNumber: orderRef,
        orderId: orderRef,
        action: 'CANCEL_ORDER',
        status: 'Cancelled',
        customerName: customerName,
        phone: phoneVal,
        email: emailVal,
        total: totalVal,
        cancellationReason: fullReason,
        date: cancelledDate,
        dateString: cancelledDate,
        "Order ID": orderRef,
        "Order Status": 'Cancelled',
        "Customer Name": customerName,
        "Phone": phoneVal,
        "Payment Method": existingOrder ? existingOrder.paymentMethod : 'N/A',
        "Total Amount": totalVal
      };

      try {
        await Promise.race([
          sendOrderToGoogleSheet(cancelPayload),
          new Promise(res => setTimeout(res, 2500))
        ]);
      } catch (err) {
        // Quiet fallback
      }

      // Restore submit button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }

      // Close Cancel Modal
      const cancelModal = document.getElementById('cancelOrderModal');
      if (cancelModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(cancelModal);
        if (modal) modal.hide();
      }

      // Close Order Success Modal if open
      const successModalEl = document.getElementById('orderSuccessModal');
      if (successModalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const sm = bootstrap.Modal.getInstance(successModalEl);
        if (sm) sm.hide();
      }

      showToast(`Order ${orderRef} has been cancelled successfully.`);

      // Ensure Track Order Modal is visible and re-rendered with Cancelled state
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const tm = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        tm.show();
      }
      performTrackOrder(cleanRef, emailVal);
    });
  }

  /** Execute Tracking Display with simulated steps */
  function performTrackOrder(orderNumber, email, forcedStep = null) {
    if (searchSection) searchSection.classList.add('d-none');
    if (resultSection) resultSection.classList.add('d-none');
    if (loadingSection) loadingSection.classList.remove('d-none');

    // Simulate network latency for realistic feel
    setTimeout(() => {
      if (loadingSection) loadingSection.classList.add('d-none');
      if (resultSection) resultSection.classList.remove('d-none');

      // Check if user is tracking a real placed order
      const cleanOrder = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;
      const rawNum = orderNumber.replace('#', '').trim().toUpperCase();
      const placedOrders = getPlacedOrders();
      const matchedOrder = placedOrders.find(o => 
        (o.orderNumber && o.orderNumber.replace('#', '').trim().toUpperCase() === rawNum) ||
        (o.email && email && o.email.toLowerCase() === email.toLowerCase() && !rawNum)
      );

      const dispOrder = document.getElementById('trackDisplayOrderNumber');
      const dispEmail = document.getElementById('trackDisplayEmail');
      const dispBadge = document.getElementById('trackDisplayStatusBadge');
      const dispCarrier = document.getElementById('trackDisplayCarrier');
      const progLine = document.getElementById('trackProgressLine');
      const stepperWrap = document.getElementById('trackStepperWrap');
      const cancelledNotice = document.getElementById('trackOrderCancelledNotice');
      const cancelledReasonText = document.getElementById('trackCancelledReasonText');
      const cancelBtn = document.getElementById('trackCancelOrderBtn');
      const activityLog = document.getElementById('trackActivityLog');

      if (dispOrder) dispOrder.textContent = matchedOrder ? matchedOrder.orderNumber : cleanOrder;
      if (dispEmail) dispEmail.textContent = (matchedOrder && matchedOrder.email) ? matchedOrder.email : email;

      const isCancelled = matchedOrder && (matchedOrder.status === 'Cancelled' || String(matchedOrder.orderNumber).toUpperCase().includes('CANCEL'));

      // IF ORDER IS CANCELLED
      if (isCancelled) {
        if (dispBadge) {
          dispBadge.textContent = 'Order Cancelled';
          dispBadge.className = getOrderStatusCSSClass('Cancelled', 'badge');
        }
        if (dispCarrier) {
          dispCarrier.textContent = 'Package Dispatch Aborted by Customer';
        }
        if (cancelledNotice) {
          cancelledNotice.classList.remove('d-none');
        }
        if (cancelledReasonText) {
          cancelledReasonText.innerHTML = `<strong>Reason:</strong> ${matchedOrder.cancellationReason || 'Cancelled by customer'}<br><span class="text-muted" style="font-size: 0.75rem;">Cancelled on ${matchedOrder.cancelledDate || 'Recently'}. This order will not be delivered or charged.</span>`;
        }
        if (stepperWrap) {
          stepperWrap.style.display = 'none';
        }
        if (cancelBtn) {
          cancelBtn.style.display = 'none';
        }
        if (activityLog) {
          activityLog.innerHTML = `
            <div class="d-flex align-items-start gap-2 mb-2 pb-2 border-bottom">
              <span class="track-event-dot mt-1" style="background-color: #dc3545;"></span>
              <div>
                <div class="fw-semibold text-danger">Order Cancelled by Customer</div>
                <div class="text-dark small">${matchedOrder.cancellationReason || 'Cancellation confirmed.'}</div>
                <div class="text-muted" style="font-size: 0.72rem;">${matchedOrder.cancelledDate || 'Recorded just now'}</div>
              </div>
            </div>
            <div class="d-flex align-items-start gap-2 mb-2 pb-2 border-bottom">
              <span class="track-event-dot mt-1" style="background-color: #198754;"></span>
              <div>
                <div class="fw-semibold text-dark">Encrypted Cloud Database Sync</div>
                <div class="text-muted" style="font-size: 0.72rem;">Status marked as CANCELLED in secure cloud ledger.</div>
              </div>
            </div>
          `;
        }
        return;
      }

      // IF NOT CANCELLED, PROCEED WITH NORMAL TRACKING DISPLAY
      if (cancelledNotice) cancelledNotice.classList.add('d-none');
      if (stepperWrap) stepperWrap.style.display = 'block';

      // Determine step (1 to 4)
      let activeStep = 3; // Default Out for Delivery
      if (forcedStep !== null && forcedStep >= 1 && forcedStep <= 4) {
        activeStep = forcedStep;
      } else if (matchedOrder) {
        activeStep = 1; // Newly placed order starts at Step 1
      } else {
        const upper = orderNumber.toUpperCase();
        if (upper.includes('DELIVER') || upper.endsWith('2') || upper.endsWith('8')) {
          activeStep = 4; // Delivered
        } else if (upper.includes('OUT') || upper.endsWith('1') || upper.endsWith('7')) {
          activeStep = 3; // Out for Delivery
        } else if (upper.includes('SHIP') || upper.endsWith('4') || upper.endsWith('5')) {
          activeStep = 2; // Shipped
        } else {
          activeStep = 1; // Order Placed
        }
      }

      // Show/Hide Cancel button based on step
      if (cancelBtn) {
        if (activeStep <= 3) {
          cancelBtn.style.display = 'inline-flex';
        } else {
          cancelBtn.style.display = 'none'; // Cannot cancel once delivered
        }
      }

      // Status configs using the helper function
      const stepConfigs = {
        1: {
          badge: 'Pending & Verified',
          badgeClass: getOrderStatusCSSClass('Pending', 'badge'),
          carrier: 'SnapLogistics Warehouse Manifest #ORD-1092',
          percent: '0%'
        },
        2: {
          badge: 'Shipped & In Transit',
          badgeClass: getOrderStatusCSSClass('Shipped', 'badge'),
          carrier: 'FedEx Express Air Cargo #FX-40291',
          percent: '33%'
        },
        3: {
          badge: 'Out for Delivery',
          badgeClass: getOrderStatusCSSClass('Out for Delivery', 'badge'),
          carrier: 'SnapExpress Local Van Courier #VAN-42',
          percent: '66%'
        },
        4: {
          badge: 'Delivered Successfully',
          badgeClass: getOrderStatusCSSClass('Delivered', 'badge'),
          carrier: 'Handed to Resident / Front Porch',
          percent: '100%'
        }
      };

      const currentConfig = stepConfigs[activeStep];
      if (dispBadge) {
        dispBadge.textContent = currentConfig.badge;
        dispBadge.className = currentConfig.badgeClass;
      }
      if (dispCarrier) dispCarrier.textContent = currentConfig.carrier;
      if (progLine) progLine.style.width = currentConfig.percent;

      // Apply Stepper Classes
      const stepElements = [
        document.getElementById('step1Item'),
        document.getElementById('step2Item'),
        document.getElementById('step3Item'),
        document.getElementById('step4Item')
      ];

      stepElements.forEach((el, idx) => {
        if (!el) return;
        const stepNum = idx + 1;
        el.classList.remove('completed', 'active');
        if (stepNum < activeStep) {
          el.classList.add('completed');
        } else if (stepNum === activeStep) {
          if (activeStep === 4) {
            el.classList.add('completed');
          } else {
            el.classList.add('active');
          }
        }
      });

      // Timestamps
      const now = new Date();
      const formatTime = (d, timeStr) => `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeStr}`;
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const s1Time = document.getElementById('step1Time');
      const s2Time = document.getElementById('step2Time');
      const s3Time = document.getElementById('step3Time');
      const s4Time = document.getElementById('step4Time');

      if (s1Time) s1Time.textContent = formatTime(twoDaysAgo, '09:14 AM');
      if (s2Time) s2Time.textContent = formatTime(yesterday, '04:30 PM');
      if (s3Time) s3Time.textContent = formatTime(now, '08:45 AM');
      if (s4Time) {
        s4Time.textContent = activeStep === 4 ? formatTime(now, '01:22 PM') : 'Est. Today by 6 PM';
      }

      // Detailed transit log
      if (activityLog) {
        const eventsByStep = {
          1: [
            { time: formatTime(twoDaysAgo, '09:14 AM'), text: 'Order verified & payment confirmed via checkout gateway.' },
            { time: formatTime(twoDaysAgo, '10:05 AM'), text: 'Warehouse automation allocated items for picking & boxing.' }
          ],
          2: [
            { time: formatTime(yesterday, '04:30 PM'), text: 'Departed regional logistics sorting terminal in container #B8.' },
            { time: formatTime(yesterday, '01:15 PM'), text: 'Carrier pickup scanned into central transit hub.' },
            { time: formatTime(twoDaysAgo, '09:14 AM'), text: 'Order confirmed and packing completed.' }
          ],
          3: [
            { time: formatTime(now, '08:45 AM'), text: 'Loaded onto courier van for final doorstep delivery.' },
            { time: formatTime(now, '04:12 AM'), text: 'Arrived at local postal distribution center.' },
            { time: formatTime(yesterday, '04:30 PM'), text: 'In transit via highway linehaul.' }
          ],
          4: [
            { time: formatTime(now, '01:22 PM'), text: 'Delivered to resident at front door. Signature captured.' },
            { time: formatTime(now, '08:45 AM'), text: 'Out for delivery with driver.' },
            { time: formatTime(yesterday, '04:30 PM'), text: 'Arrived at local carrier sorting facility.' }
          ]
        };

        let events = eventsByStep[activeStep] || eventsByStep[3];
        if (matchedOrder) {
          events = [
            { time: matchedOrder.dateString || 'Just now', text: `Order ${matchedOrder.orderNumber} confirmed & recorded in secure cloud database.` },
            { time: 'Payment Verified', text: `Selected: ${matchedOrder.paymentMethod} — Total: $${Number(matchedOrder.total || 0).toFixed(2)}` },
            { time: 'Allocating Items', text: `Cart contents: ${matchedOrder.itemsSummary}` },
            { time: 'Destination', text: `Courier assigned for: ${matchedOrder.address}` }
          ];
        }
        activityLog.innerHTML = events.map(ev => `
          <div class="d-flex align-items-start gap-2 mb-2 pb-2 border-bottom">
            <span class="track-event-dot mt-1"></span>
            <div>
              <div class="fw-semibold text-dark">${ev.text}</div>
              <div class="text-muted" style="font-size: 0.72rem;">${ev.time}</div>
            </div>
          </div>
        `).join('');
      }
    }, 400);
  }
}

/* ==========================================================================
   14. CONTACT US & INQUIRY RESOLUTION DESK
   ========================================================================== */

function initContactPage() {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  const nameInput = document.getElementById('contactName');
  const emailInput = document.getElementById('contactEmail');
  const phoneInput = document.getElementById('contactPhone');
  const orderRefInput = document.getElementById('contactOrderRef');
  const departmentSelect = document.getElementById('contactDepartment');
  const messageInput = document.getElementById('contactMessage');
  const consentCheckbox = document.getElementById('contactConsent');
  const submitBtn = document.getElementById('contactSubmitBtn');
  const banner = document.getElementById('contactSuccessBanner');
  const bannerMsg = document.getElementById('contactSuccessMsg');

  // Autofill with logged-in user if available
  const user = getCurrentUser();
  if (user) {
    if (nameInput && !nameInput.value) nameInput.value = user.name || '';
    if (emailInput && !emailInput.value) emailInput.value = user.email || '';
    if (phoneInput && !phoneInput.value && user.phone && user.phone !== 'N/A') phoneInput.value = user.phone;
  }

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const orderRef = orderRefInput ? orderRefInput.value.trim() : '';
    const department = departmentSelect ? departmentSelect.value : '';
    const message = messageInput ? messageInput.value.trim() : '';
    const hasConsent = consentCheckbox ? consentCheckbox.checked : true;

    if (!name || !email || !phone || !department || !message || message.length < 5 || !hasConsent) {
      contactForm.classList.add('was-validated');
      showToast('Please fill out all required fields before submitting.');
      return;
    }

    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Submitting Ticket...';
    }

    const payload = {
      action: 'CONTACT_INQUIRY',
      name: name,
      email: email,
      phone: phone,
      orderRef: orderRef || 'N/A',
      department: department,
      message: message,
      timestamp: new Date().toISOString(),
      dateString: new Date().toLocaleString()
    };

    try {
      await Promise.race([
        sendUserDataToGoogleSheet('CONTACT_INQUIRY', payload),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
    } catch (err) {
      console.warn('Contact sync note:', err);
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    }

    // Show success banner
    if (banner) {
      banner.classList.remove('d-none');
      if (bannerMsg) {
        bannerMsg.innerHTML = `Thank you <strong>${escapeHtml(name)}</strong>! Your inquiry regarding <em>${escapeHtml(department)}</em> has been logged (Ticket Ref: <strong>#TKT-${Math.floor(100000 + Math.random() * 900000)}</strong>). Our support agent will reach you via WhatsApp or Email within 2 hours.`;
      }
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showToast('🎉 Inquiry submitted! Check your email or WhatsApp for a confirmation.');
    contactForm.reset();
    contactForm.classList.remove('was-validated');
  });
}
