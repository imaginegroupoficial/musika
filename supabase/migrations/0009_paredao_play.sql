-- Paredão Play: nova identidade. Troca só o que ainda está no padrão antigo; o que foi personalizado no /admin fica.
update public.settings set value = jsonb_set(value, '{preset}', '"play"')
 where key = 'theme' and coalesce(value ->> 'preset', 'cartaz') = 'cartaz' and value -> 'colors' is null;
update public.settings set value = jsonb_set(value, '{name}', '"Paredão Play"')
 where key = 'brand' and coalesce(value ->> 'name', 'Musika') = 'Musika';
