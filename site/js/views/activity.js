// Actividad educativa: ordenar eventos del más antiguo al más reciente.
// No necesita datos propios: se arma sola con los eventos publicados.

import { data, sortKey } from '../data.js';
import { t, trText, formatDate, isoDate } from '../i18n.js';
import { el, trEl, icon, announce } from '../dom.js';
import { ACTIVITY } from '../config.js';

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Elige eventos con fechas distintas (dos eventos del mismo día no tienen un orden correcto).
function pickEvents() {
  const seen = new Set();
  const candidates = shuffle(data.events).filter((event) => {
    const key = sortKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return candidates.slice(0, ACTIVITY.maxEvents);
}

const isSorted = (list) => list.every((event, i) => i === 0 || sortKey(list[i - 1]) < sortKey(event));

export function renderActivity(main) {
  const head = el('section', { class: 'page-head' },
    el('h1', {}, t('activity.title')),
    el('p', { class: 'page-lead' }, t('activity.intro')),
  );
  const board = el('section', { class: 'activity', 'aria-label': t('activity.title') });
  main.replaceChildren(head, board);

  let order = [];
  let checked = false;

  const start = () => {
    const picked = pickEvents();
    if (picked.length < ACTIVITY.minEvents) {
      board.replaceChildren(el('p', { class: 'notice' }, t('activity.notEnough')));
      return;
    }
    do { order = shuffle(picked); } while (isSorted(order));
    checked = false;
    draw();
  };

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    draw();
    // El foco sigue al evento que se movió (o pasa al otro botón si llegó a un extremo).
    const row = board.querySelectorAll('.sort-item')[target];
    const button = row.querySelector(delta < 0 ? '.sort-up:not(:disabled)' : '.sort-down:not(:disabled)')
      ?? row.querySelector('button:not(:disabled)');
    button?.focus();
    announce(t('activity.moved', { title: trText(order[target].title), n: target + 1, total: order.length }));
  };

  const draw = () => {
    const correct = [...order].sort((a, b) => sortKey(a) - sortKey(b));
    const hits = order.filter((event, i) => event === correct[i]).length;

    const items = order.map((event, index) => {
      const ok = event === correct[index];
      const title = trText(event.title);
      return el('li', { class: `sort-item${checked ? (ok ? ' is-correct' : ' is-wrong') : ''}` },
        el('span', { class: 'sort-number', 'aria-hidden': 'true' }, String(index + 1)),
        el('div', { class: 'sort-text' },
          trEl('p', { class: 'sort-title' }, event.title, { badge: false }),
          checked && el('p', { class: 'sort-result' },
            el('span', { class: 'sort-verdict' }, ok && icon('check'), t(ok ? 'activity.correct' : 'activity.wrong')),
            el('time', { datetime: isoDate(event) }, formatDate(event)),
            el('a', { href: `#/evento/${event.id}` }, t('event.more')),
          ),
        ),
        !checked && el('div', { class: 'sort-buttons' },
          el('button', { type: 'button', class: 'icon-button sort-up', disabled: index === 0, 'aria-label': `${t('activity.up')}: ${title}`, onclick: () => move(index, -1) }, icon('arrowUp')),
          el('button', { type: 'button', class: 'icon-button sort-down', disabled: index === order.length - 1, 'aria-label': `${t('activity.down')}: ${title}`, onclick: () => move(index, 1) }, icon('arrowDown')),
        ),
      );
    });

    const perfect = hits === order.length;
    const message = perfect ? t('activity.perfect') : t('activity.result', { n: hits, total: order.length });

    board.replaceChildren(
      el('ol', { class: 'sort-list' }, items),
      checked && el('p', { class: `activity-result${perfect ? ' is-perfect' : ''}` }, message),
      el('div', { class: 'activity-actions' },
        !checked && el('button', { type: 'button', class: 'button button--primary', onclick: () => { checked = true; draw(); announce(message); board.querySelector('.activity-actions button')?.focus(); } }, t('activity.check')),
        checked && !perfect && el('button', { type: 'button', class: 'button button--primary', onclick: () => { checked = false; draw(); board.querySelector('.sort-item button:not(:disabled)')?.focus(); } }, t('activity.retry')),
        checked && el('button', { type: 'button', class: `button${perfect ? ' button--primary' : ''}`, onclick: () => { start(); board.querySelector('.sort-item button:not(:disabled)')?.focus(); } }, t('activity.new')),
      ),
    );

  };

  start();
}
