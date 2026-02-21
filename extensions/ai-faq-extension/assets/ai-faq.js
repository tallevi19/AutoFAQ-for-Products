/**
 * AI FAQ Section - Accordion JavaScript
 * Handles open/close toggle for FAQ items
 */

(function () {
  'use strict';

  function initFaqAccordions() {
    const sections = document.querySelectorAll('.ai-faq-section');

    sections.forEach(function (section) {
      const items = section.querySelectorAll('.ai-faq-item');

      items.forEach(function (item) {
        const button = item.querySelector('.ai-faq-item__question');
        const answer = item.querySelector('.ai-faq-item__answer');

        if (!button || !answer) return;

        button.addEventListener('click', function () {
          const isOpen = item.classList.contains('ai-faq-item--open');

          // Close all items in this section
          items.forEach(function (otherItem) {
            if (otherItem !== item) {
              closeItem(otherItem);
            }
          });

          // Toggle current item
          if (isOpen) {
            closeItem(item);
          } else {
            openItem(item);
          }
        });
      });
    });
  }

  function openItem(item) {
    const button = item.querySelector('.ai-faq-item__question');
    const answer = item.querySelector('.ai-faq-item__answer');
    const inner = answer.querySelector('.ai-faq-item__answer-inner');

    item.classList.add('ai-faq-item--open');
    button.setAttribute('aria-expanded', 'true');
    answer.setAttribute('aria-hidden', 'false');

    // Smooth height animation
    const targetHeight = inner ? inner.scrollHeight : 0;
    answer.style.maxHeight = targetHeight + 'px';
  }

  function closeItem(item) {
    const button = item.querySelector('.ai-faq-item__question');
    const answer = item.querySelector('.ai-faq-item__answer');

    item.classList.remove('ai-faq-item--open');
    button.setAttribute('aria-expanded', 'false');
    answer.setAttribute('aria-hidden', 'true');
    answer.style.maxHeight = '0px';
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFaqAccordions);
  } else {
    initFaqAccordions();
  }

  // Re-init for Shopify's dynamic sections (Theme Editor)
  document.addEventListener('shopify:section:load', initFaqAccordions);
  document.addEventListener('shopify:block:load', initFaqAccordions);
})();
