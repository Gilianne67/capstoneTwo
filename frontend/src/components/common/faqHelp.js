export const FAQ_AUDIENCES = ['all', 'student', 'provider', 'admin'];

export const FAQ_AUDIENCE_LABELS = {
  all: 'All audiences',
  student: 'Students',
  provider: 'Providers',
  admin: 'Admins',
};

const clean = (value) => String(value || '').trim();

export function buildFaqWriteBody(input) {
  const source = input || {};
  const category = clean(source.category);
  const question = clean(source.question);
  const answer = clean(source.answer);
  const targetRole = clean(source.targetRole);

  if (!FAQ_AUDIENCES.includes(targetRole)) {
    return { ok: false, error: 'Choose a valid audience.' };
  }
  if (!category || !question || !answer) {
    return { ok: false, error: 'Category, question, and answer are required.' };
  }
  if (typeof source.isPublished !== 'boolean') {
    return { ok: false, error: 'Publication status is required.' };
  }

  return {
    ok: true,
    body: {
      targetRole,
      category,
      question,
      answer,
      isPublished: source.isPublished,
    },
  };
}

function isPortalArticle(faq, role) {
  if (!faq || faq.isPublished !== true) return false;
  if (role === 'student') return faq.targetRole === 'student' || faq.targetRole === 'all';
  if (role === 'provider') return faq.targetRole === 'provider' || faq.targetRole === 'all';
  return false;
}

export function filterHelpArticles(faqs, options = {}) {
  const role = options.role || 'student';
  const isAdmin = Boolean(options.isAdmin);
  const query = clean(options.query).toLowerCase();
  let list = Array.isArray(faqs) ? faqs.filter(Boolean) : [];

  if (!isAdmin) {
    list = list.filter((faq) => isPortalArticle(faq, role));
  } else {
    if (options.audience && options.audience !== 'any') {
      list = list.filter((faq) => faq.targetRole === options.audience);
    }
    if (options.status === 'published') {
      list = list.filter((faq) => faq.isPublished === true);
    } else if (options.status === 'unpublished') {
      list = list.filter((faq) => faq.isPublished === false);
    }
    if (options.category && options.category !== 'any') {
      list = list.filter((faq) => (faq.category || 'General') === options.category);
    }
  }

  if (query) {
    list = list.filter((faq) => {
      const haystack = [faq.question, faq.answer, faq.category]
        .map((value) => String(value || '').toLowerCase());
      return haystack.some((value) => value.includes(query));
    });
  }

  return list;
}
