-- Echo: AI-generated summaries and highlights.
-- summaries.sections holds the template's sections ([{ heading, bullets }]).
-- highlights.kind separates your own notes and flags from AI highlights, which
-- also carry a title and bullet points.

alter table public.summaries
  add column title text check (char_length(title) <= 200),
  add column sections jsonb not null default '[]'::jsonb,
  add column language text check (char_length(language) <= 40);

alter table public.highlights
  add column kind text not null default 'note' check (kind in ('note', 'flag', 'ai')),
  add column title text check (char_length(title) <= 300),
  add column bullets jsonb not null default '[]'::jsonb;

-- Flags saved by the recorder used the text "Flagged moment".
update public.highlights set kind = 'flag' where text = 'Flagged moment';
