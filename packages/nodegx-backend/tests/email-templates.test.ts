/**
 * BAK-002 template system — interpolation, defaults, and override merging.
 * Pure functions, no I/O.
 */
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_IDS,
  interpolate,
  renderTemplate,
  mergeTemplate,
  isTemplateId
} from '../src/email/templates';

describe('template interpolation', () => {
  it('substitutes known variables', () => {
    expect(interpolate('Hello {{name}}!', { name: 'Ada' })).toBe('Hello Ada!');
  });

  it('substitutes the same variable used multiple times', () => {
    expect(interpolate('{{x}} and {{x}}', { x: '1' })).toBe('1 and 1');
  });

  it('renders unknown variables as empty string, not the raw token', () => {
    expect(interpolate('Hi {{missing}}.', {})).toBe('Hi .');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(interpolate('{{ name }}', { name: 'Ada' })).toBe('Ada');
  });

  it('leaves non-template text untouched', () => {
    expect(interpolate('no variables here', { anything: 'x' })).toBe('no variables here');
  });
});

describe('renderTemplate', () => {
  it('interpolates subject/text/html together', () => {
    const rendered = renderTemplate(
      { subject: 'Hi {{name}}', text: 'Body {{name}}', html: '<p>{{name}}</p>' },
      { name: 'Ada' }
    );
    expect(rendered).toEqual({ subject: 'Hi Ada', text: 'Body Ada', html: '<p>Ada</p>' });
  });
});

describe('mergeTemplate', () => {
  const base = { subject: 'S', text: 'T', html: 'H' };

  it('returns the base untouched with no override', () => {
    expect(mergeTemplate(base)).toEqual(base);
  });

  it('overrides only the fields given', () => {
    expect(mergeTemplate(base, { subject: 'Custom subject' })).toEqual({ subject: 'Custom subject', text: 'T', html: 'H' });
  });

  it('blank/whitespace-only override fields fall back to the default', () => {
    expect(mergeTemplate(base, { subject: '   ', text: '' })).toEqual(base);
  });
});

describe('shipped defaults', () => {
  it.each(TEMPLATE_IDS)('%s has non-empty subject/text/html', (id) => {
    const t = DEFAULT_TEMPLATES[id];
    expect(t.subject.trim().length).toBeGreaterThan(0);
    expect(t.text.trim().length).toBeGreaterThan(0);
    expect(t.html.trim().length).toBeGreaterThan(0);
  });

  it('passwordReset default references {{resetUrl}}', () => {
    expect(DEFAULT_TEMPLATES.passwordReset.text).toContain('{{resetUrl}}');
  });

  it('verifyEmail default references {{verifyUrl}}', () => {
    expect(DEFAULT_TEMPLATES.verifyEmail.text).toContain('{{verifyUrl}}');
  });
});

describe('isTemplateId', () => {
  it('accepts known ids', () => {
    expect(isTemplateId('passwordReset')).toBe(true);
    expect(isTemplateId('verifyEmail')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isTemplateId('somethingElse')).toBe(false);
    expect(isTemplateId(123)).toBe(false);
    expect(isTemplateId(undefined)).toBe(false);
  });
});
