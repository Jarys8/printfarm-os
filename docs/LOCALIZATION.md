# Localization

The interface ships in **English** and **Czech**. Switch it in
**Settings → Appearance → Language / Jazyk**; the change applies immediately and
is saved in `FarmSettings.language`.

## How it works

- `src/types/farm.ts` defines `Language = 'en' | 'cs'` and stores it in
  `FarmSettings`.
- `src/i18n.ts` holds a phrase-keyed dictionary: the English source string is the
  key and the Czech translation is the value, e.g.
  `'Save changes': 'Uložit změny'`.
- `translate(lang, text, vars)` returns the Czech value when the language is
  `cs`, interpolates `{placeholders}`, and falls back to the English source when
  a key is missing. This keeps untranslated strings readable instead of showing
  raw keys.
- `src/hooks/useT.ts` returns a translator bound to the current settings, so
  components call `t('Save changes')` without passing the language around.
- `FarmProvider` sets `<html lang="en|cs">` for accessibility and correct
  hyphenation.

## Adding a language

1. Extend the `Language` union and the Settings selector.
2. Add a dictionary for the new language (copy the English keys).
3. Extend `translate()` to pick the dictionary for that language.

## Adding or changing strings

Add the English phrase and its translation to the dictionary, then wrap the
literal in the component with `t('…')`. Dynamic counts use placeholder keys such
as `'{n} open'`. Dates and numbers use `toLocaleDateString` / `Intl` with the
browser locale, so they follow the device settings.

## Current coverage

Navigation, dashboard, calculator, inventory (including spool editor, weighing,
adjustment and hardware modals), orders (board, editor, cards), printers
(fleet, editor, maintenance), settings, quote/invoice documents, scanner modal
and toast notifications are translated. Product names, client names and
free-text notes are user data and are never translated.
