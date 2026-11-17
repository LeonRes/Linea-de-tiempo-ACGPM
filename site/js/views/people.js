// Vista de personas: una tarjeta por cada fila de la pestaña «personas».

import { data } from '../data.js';
import { t } from '../i18n.js';
import { el, trEl } from '../dom.js';
import { portrait, lifeYears } from '../detail.js';

export function renderPeople(main) {
  main.replaceChildren(
    el('section', { class: 'page-head' },
      el('h1', {}, t('people.title')),
      el('p', { class: 'page-lead' }, t('people.intro')),
    ),
    el('ul', { class: 'people-grid' }, data.people.map((person) => el('li', { class: 'person-card' },
      portrait(person, 'person-card-img'),
      // El enlace está en el nombre y se extiende a toda la tarjeta con CSS (.person-link::after).
      el('h2', { class: 'person-name' }, el('a', { class: 'person-link', href: `#/persona/${person.id}` }, person.name)),
      lifeYears(person) && el('p', { class: 'person-years' }, lifeYears(person)),
      trEl('p', { class: 'person-role' }, person.role, { badge: false }),
    ))),
  );
}

export function focusPersonCard(id) {
  document.querySelector(`.person-link[href="#/persona/${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
