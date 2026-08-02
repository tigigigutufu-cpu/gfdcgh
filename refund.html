// ToolSphere shared behaviour
document.addEventListener('DOMContentLoaded', () => {
  // Smooth reveal-on-scroll for cards and panels
  const revealTargets = document.querySelectorAll('.tool-card, .panel, .strip .item, .blog-card, .faq-item');
  if ('IntersectionObserver' in window && revealTargets.length) {
    revealTargets.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(el => io.observe(el));
  }

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  }
  document.querySelectorAll('.has-dropdown > a').forEach(a => {
    a.addEventListener('click', (e) => {
      if (window.innerWidth <= 900) {
        e.preventDefault();
        a.parentElement.classList.toggle('open');
      }
    });
  });

  // Generic copy buttons: data-copy-target="#id" or copies closest .output-item text
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;
    let text = '';
    if (btn.dataset.copy) {
      text = btn.dataset.copy;
    } else {
      const item = btn.closest('.output-item');
      const txt = item ? item.querySelector('.txt') : null;
      text = txt ? txt.textContent : '';
    }
    navigator.clipboard.writeText(text.trim()).then(() => {
      btn.classList.add('copied');
      const old = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = old; }, 1400);
    });
  });
});

function tsEscapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function tsMakeOutputItem(text) {
  return `<div class="output-item"><div class="txt">${tsEscapeHTML(text)}</div><button class="copy-btn" type="button">Copy</button></div>`;
}
