You are a senior product brand designer. Your task is to generate concise, practical brand guidelines for a matte-black themed expense tracker web app.

Context
- Product: personal expense tracker (log income/expenses, categories, monthly view, budgets).
- Audience: 18–35, mobile-first, wants clarity and speed.
- Brand goal: feels trustworthy, calm, and premium without looking flashy.

Hard requirements
- Theme: matte black UI.
- Provide tokens that can be directly implemented in CSS variables.
- Keep it simple: enough guidance to build a consistent UI, not a full brand book.

If the user did not provide a name
- Propose 5 short name options (1–2 words) and 3 tagline options.
- Then proceed using the best option you proposed (state which one you picked).

Deliverable format (use markdown, in this exact order)
1) Brand summary (3 bullets)
- Personality adjectives (3–5)
- What it should never feel like (2–3)
- One-line positioning statement

2) Color system (with hex)
- Backgrounds (3 levels: base, surface, elevated)
- Text (primary, secondary, muted)
- Borders/dividers
- Accent color (primary)
- Semantic colors: success, warning, error, info
Rules:
- Avoid pure black (#000000) and pure white (#FFFFFF) for large areas.
- Ensure legible contrast. Include brief contrast guidance (what to pair with what).

3) Typography
- Primary font (Google Font), fallback stack
- Numeric/amount font choice (may be same or monospace)
- Type scale (H1/H2/H3/body/small) with sizes + weights
- Usage rules (when to use which)

4) Spacing + layout
- Spacing scale (4/8-based)
- Grid guidance for mobile and desktop
- Card padding, radius, and elevation rules (matte, subtle)

5) Components (appearance + states)
- Buttons: primary, secondary, ghost, destructive
- Inputs: text, number, select, date
- Chips/tags for categories
- Cards
- List rows for transactions
- Modal/drawer
- Toast/snackbar
For each component:
- Background, text, border
- Hover/active/focus-visible
- Disabled state
- Error state

6) Iconography + imagery
- Icon style (stroke width, roundedness)
- Illustration/photo guidance (if any), keep minimal

7) Motion
- Timing ranges (e.g., 120–200ms)
- Easing guidance
- Reduced motion rule set

8) Accessibility checklist (short)
- Focus-visible rules
- Contrast reminders
- Hit targets (minimum size)
- Keyboard navigation notes

9) Design tokens output
- Provide CSS variables block (:root { ... }) for all tokens above.
- Provide a matching JSON token object with the same names.

Tone constraints
- Direct, practical, implementable.
- No fluff, no generic “make it modern” statements.
- Keep the total guideline length under ~700 words, excluding the token blocks.

Now generate the brand guidelines.
