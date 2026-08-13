-- 0013_clean_chapter_titles — drop roman-numeral tokens from chapter names.
--
-- Corrections doc: "On va enlever les Cytologie I …. II….III et ne garder que
-- les titres." Chapter names of the form "Cytologie I — La cellule" carry a
-- roman-numeral tag that the reviewer wants gone; the descriptive title is
-- kept. Two safe, idempotent passes:
--   1. Remove a roman numeral sitting between a word and a dash separator:
--        "Cytologie I — La cellule"  ->  "Cytologie — La cellule"
--   2. Remove a trailing roman numeral with no title after it:
--        "Cytologie I"               ->  "Cytologie"
-- Then collapse any doubled spaces and trim. Non-destructive of the title text,
-- so it will not collapse distinct chapters into duplicate names. Re-runnable.

update public.chapters
set
  name_fr = btrim(regexp_replace(regexp_replace(name_fr, '\s+(IX|IV|V?I{1,3})\s+(—|–|-)\s+', ' \2 ', 'g'), '\s+(IX|IV|V?I{1,3})\s*$', '', 'g')),
  name_en = btrim(regexp_replace(regexp_replace(name_en, '\s+(IX|IV|V?I{1,3})\s+(—|–|-)\s+', ' \2 ', 'g'), '\s+(IX|IV|V?I{1,3})\s*$', '', 'g'))
where
  name_fr ~ '\s+(IX|IV|V?I{1,3})(\s+(—|–|-)|\s*$)'
  or name_en ~ '\s+(IX|IV|V?I{1,3})(\s+(—|–|-)|\s*$)';

-- Tidy any residual double spaces introduced by the removal.
update public.chapters
set name_fr = regexp_replace(name_fr, '\s{2,}', ' ', 'g'),
    name_en = regexp_replace(name_en, '\s{2,}', ' ', 'g')
where name_fr ~ '\s{2,}' or name_en ~ '\s{2,}';
