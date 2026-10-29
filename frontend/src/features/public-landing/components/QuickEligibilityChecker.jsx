import { useEffect, useReducer, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, RotateCcw, Sparkles } from 'lucide-react';
import {
  INCOME_BRACKETS,
  SAMPLE_SCHOLARSHIP,
  SIGNUP_PATH,
  createPreviewState,
  describePracticeResult,
  formatScore,
  formatWeight,
  reducePreview,
} from './matchingSimulator.js';

const FIELD_ORDER = ['scale', 'gwa', 'incomeBracket', 'hasPreferredTag'];

const FIELD_IDS = {
  scale: 'sample-scale',
  gwa: 'sample-gwa',
  incomeBracket: 'sample-income',
  hasPreferredTag: 'sample-tag-yes',
};

const choiceClass = (selected) =>
  `flex min-h-12 cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition focus-within:ring-2 focus-within:ring-[#1b4332] focus-within:ring-offset-2 ${
    selected
      ? 'border-[#1b4332] bg-[#e7f2ec] text-[#143628] shadow-sm'
      : 'border-stone-200 bg-white text-stone-800 hover:border-[#1b4332]/35'
  }`;

export default function QuickEligibilityChecker() {
  const [state, dispatch] = useReducer(reducePreview, null, createPreviewState);
  const resultRef = useRef(null);
  const { form, errors, result } = state;
  const practice = describePracticeResult(result);

  useEffect(() => {
    if (!result || !resultRef.current) return;
    const top = resultRef.current.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [result]);

  const edit = (field, value) => dispatch({ type: 'edit', field, value });

  const onSubmit = (event) => {
    event.preventDefault();
    const next = reducePreview(state, { type: 'submit' });
    dispatch({ type: 'submit' });
    const field = FIELD_ORDER.find((key) => next.errors[key]);
    if (field) {
      requestAnimationFrame(() => document.getElementById(FIELD_IDS[field])?.focus());
    }
  };

  const gradeHint = form.scale === '60-100'
    ? 'Enter 60 to 100. A higher number is a better grade.'
    : form.scale === '1.00-5.00'
      ? 'Enter 1.00 to 5.00. A lower number is a better grade.'
      : 'Choose your school’s scale, then enter a practice grade.';

  return (
    <section id="eligibility" className="scroll-mt-24 bg-[#eef2ef] py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[28px] bg-[#1b4332] shadow-2xl">
          <div className="px-6 pb-2 pt-8 text-white sm:px-10 sm:pt-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">
              Scholarship preview
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your next opportunity could start here.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-emerald-50 sm:text-base">
              See how your qualifications might fit a scholarship in just a few taps.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
                <Clock className="h-3.5 w-3.5" />
                Under 30 seconds
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
                <Sparkles className="h-3.5 w-3.5" />
                Practice only
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="rounded-3xl border border-white/10 bg-[#f7f8f6] p-5 shadow-lg sm:p-8">
              <div className="mb-6">
                <h3 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
                  Try a sample match
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                  These answers stay on this page. They are not saved, and they do not open an account or live scholarships.
                </p>
              </div>

              <form onSubmit={onSubmit} noValidate autoComplete="off" className="space-y-7">
                <fieldset
                  aria-invalid={Boolean(errors.scale)}
                  aria-describedby={errors.scale ? 'sample-scale-error' : undefined}
                >
                  <legend className="w-full">
                    <QuestionLabel number="1" title="Your academic performance" />
                    <span className="mt-3 block text-sm font-bold text-stone-900">
                      Which grading scale does your school use?
                    </span>
                  </legend>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { value: '1.00-5.00', title: '1.00–5.00', detail: 'Lower is better' },
                      { value: '60-100', title: '60–100', detail: 'Higher is better' },
                    ].map((option) => (
                      <label key={option.value} className={choiceClass(form.scale === option.value)}>
                        <input
                          id={option.value === '1.00-5.00' ? 'sample-scale' : undefined}
                          type="radio"
                          name="scale"
                          value={option.value}
                          checked={form.scale === option.value}
                          onChange={() => edit('scale', option.value)}
                          className="accent-[#1b4332]"
                        />
                        <span>
                          <span className="block">{option.title}</span>
                          <span className="block text-xs font-medium text-stone-600">{option.detail}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.scale && <FieldError id="sample-scale-error" message={errors.scale} />}

                  <label htmlFor="sample-gwa" className="mt-4 block text-sm font-bold text-stone-900">
                    What is your GWA or grade?
                  </label>
                  <input
                    id="sample-gwa"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={form.scale === '60-100' ? 60 : 1}
                    max={form.scale === '60-100' ? 100 : 5}
                    placeholder={form.scale === '60-100' ? 'e.g. 92' : 'e.g. 1.75'}
                    value={form.gwa}
                    onChange={(event) => edit('gwa', event.target.value)}
                    aria-invalid={Boolean(errors.gwa)}
                    aria-describedby={errors.gwa ? 'sample-gwa-error' : 'sample-gwa-hint'}
                    className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-stone-900 outline-none transition focus:border-[#1b4332] focus:ring-4 focus:ring-[#1b4332]/10 ${
                      errors.gwa ? 'border-red-500' : 'border-stone-300'
                    }`}
                  />
                  <p id="sample-gwa-hint" className="mt-2 text-sm text-stone-600">{gradeHint}</p>
                  {errors.gwa && <FieldError id="sample-gwa-error" message={errors.gwa} />}
                </fieldset>

                <fieldset
                  aria-invalid={Boolean(errors.incomeBracket)}
                  aria-describedby={errors.incomeBracket ? 'sample-income-error' : 'sample-income-hint'}
                >
                  <legend className="w-full">
                    <QuestionLabel number="2" title="Household monthly income" />
                    <span className="sr-only">Which range best describes your household&apos;s monthly income?</span>
                  </legend>
                  <p id="sample-income-hint" className="mt-2 text-sm text-stone-600">
                    Choose the closest range. This fictional sample includes households at or below {SAMPLE_SCHOLARSHIP.incomeCapLabel}.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {INCOME_BRACKETS.map((bracket, index) => (
                      <label key={bracket.label} className={choiceClass(form.incomeBracket === bracket.label)}>
                        <input
                          id={index === 0 ? 'sample-income' : undefined}
                          type="radio"
                          name="incomeBracket"
                          value={bracket.label}
                          checked={form.incomeBracket === bracket.label}
                          onChange={() => edit('incomeBracket', bracket.label)}
                          className="accent-[#1b4332]"
                        />
                        <span>{bracket.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.incomeBracket && <FieldError id="sample-income-error" message={errors.incomeBracket} />}
                </fieldset>

                <fieldset
                  aria-invalid={Boolean(errors.hasPreferredTag)}
                  aria-describedby={errors.hasPreferredTag ? 'sample-tag-error' : 'sample-tag-hint'}
                >
                  <legend className="w-full">
                    <QuestionLabel number="3" title="Scholarship preference" />
                    <span className="mt-3 block text-sm font-bold text-stone-900">
                      Do you have the preferred qualification “{SAMPLE_SCHOLARSHIP.preferredTag}”?
                    </span>
                  </legend>
                  <p id="sample-tag-hint" className="mt-2 text-sm leading-relaxed text-stone-600">
                    This preference belongs only to the fictional {SAMPLE_SCHOLARSHIP.name}. Answering No lowers that part of the sample score. It does not block every scholarship.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                    ].map((option) => (
                      <label key={option.value} className={`${choiceClass(form.hasPreferredTag === option.value)} justify-center`}>
                        <input
                          id={option.value === 'yes' ? 'sample-tag-yes' : undefined}
                          type="radio"
                          name="hasPreferredTag"
                          value={option.value}
                          checked={form.hasPreferredTag === option.value}
                          onChange={() => edit('hasPreferredTag', option.value)}
                          className="accent-[#1b4332]"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.hasPreferredTag && <FieldError id="sample-tag-error" message={errors.hasPreferredTag} />}
                </fieldset>

                <div className="flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1b4332] px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#143628] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b4332] focus-visible:ring-offset-2"
                  >
                    See my sample match
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'reset' })}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-5 py-3.5 text-sm font-bold text-stone-800 transition hover:border-[#1b4332] hover:text-[#1b4332] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b4332] focus-visible:ring-offset-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                </div>
              </form>

              {practice && (
                <article
                  ref={resultRef}
                  className="mt-6 scroll-mt-28 overflow-hidden rounded-3xl border border-[#1b4332]/15 bg-white"
                  aria-live="polite"
                >
                  <div className="bg-[#1b4332] px-5 py-4 text-white sm:px-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100">Simulated result</p>
                    <h4 className="mt-1 text-lg font-extrabold">{SAMPLE_SCHOLARSHIP.name}</h4>
                  </div>
                  <div className="space-y-4 px-5 py-5 sm:px-6">
                    <h5 className="text-2xl font-extrabold tracking-tight text-stone-900">{practice.heading}</h5>
                    {practice.score !== null && (
                      <div>
                        <div className="flex items-end justify-between gap-3">
                          <p className="text-5xl font-black leading-none text-[#1b4332]">{formatScore(practice.score)}</p>
                          <p className="pb-1 text-sm font-bold text-stone-500">out of 100</p>
                        </div>
                        <div
                          className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-200"
                          role="meter"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={practice.score}
                          aria-label={`${practice.classification} sample score`}
                        >
                          <div
                            className="h-full rounded-full bg-[#1b4332]"
                            style={{ width: `${Math.min(100, Math.max(0, practice.score))}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-stone-600">{practice.summary}</p>
                    {practice.reasons.length > 0 && (
                      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-700">
                        {practice.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                    <p className="rounded-2xl bg-[#e7f2ec] px-4 py-3 text-sm leading-relaxed text-[#143628]">
                      Practice only. This is not a real scholarship offer or a guarantee of eligibility.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        to={SIGNUP_PATH}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1b4332] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#143628] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b4332] focus-visible:ring-offset-2"
                      >
                        Create your free account
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'reset' })}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 px-5 py-3.5 text-sm font-bold text-stone-800 transition hover:border-[#1b4332] hover:text-[#1b4332] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b4332] focus-visible:ring-offset-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Try again
                      </button>
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>
        </div>

        <details className="group mt-5 rounded-2xl border border-stone-200 bg-white px-5 py-4">
          <summary className="cursor-pointer list-none text-sm font-bold text-[#1b4332] outline-none focus-visible:ring-2 focus-visible:ring-[#1b4332] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              How matching works
              <span className="text-xs font-semibold text-stone-500 group-open:hidden">Show</span>
              <span className="hidden text-xs font-semibold text-stone-500 group-open:inline">Hide</span>
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            A scholarship is ranked only after its requirements are met. The default score uses academic performance {formatWeight(SAMPLE_SCHOLARSHIP.weights.gwaWeight)}, household income {formatWeight(SAMPLE_SCHOLARSHIP.weights.incomeWeight)}, and preferred tags {formatWeight(SAMPLE_SCHOLARSHIP.weights.tagsWeight)}. A provider may set other approved weights that still total 100%. This sample does not use an account or live scholarships.
          </p>
        </details>
      </div>
    </section>
  );
}

function QuestionLabel({ number, title }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1b4332] text-xs font-bold text-white">
        {number}
      </span>
      <span className="text-base font-extrabold text-stone-900">{title}</span>
    </div>
  );
}

function FieldError({ id, message }) {
  return (
    <p id={id} className="mt-2 text-sm font-medium text-red-700">{message}</p>
  );
}
