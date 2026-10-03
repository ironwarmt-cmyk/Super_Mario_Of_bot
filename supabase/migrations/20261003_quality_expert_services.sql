create table if not exists quality_services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_pl text not null,
  name_en text not null,
  description_pl text not null,
  description_en text not null,
  deliverables_pl jsonb not null default '[]'::jsonb,
  deliverables_en jsonb not null default '[]'::jsonb,
  price_pln numeric(10,2) not null check (price_pln > 0),
  checkout_url text not null,
  payment_methods text[] not null default array['BLIK','card']::text[],
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table quality_services enable row level security;
revoke all on table quality_services from anon, authenticated;
grant select, insert, update, delete on table quality_services to service_role;

insert into quality_services (
  slug,name_pl,name_en,description_pl,description_en,deliverables_pl,deliverables_en,
  price_pln,checkout_url,sort_order
) values
('nonconformity-analysis','Analiza niezgodności','Nonconformity Analysis',
 'Ekspercka analiza jednej niezgodności jakościowej lub systemowej. Usługa obejmuje uporządkowanie faktów, ocenę ryzyka, analizę przyczyny źródłowej oraz przygotowanie praktycznego planu działań.',
 'Expert analysis of one quality or system nonconformity, including fact review, risk assessment, root-cause analysis and a practical action plan.',
 '["przegląd materiałów i dowodów","ocena wpływu i ryzyka","analiza przyczyny źródłowej","propozycja korekcji i CAPA","pisemne podsumowanie oraz plan działań"]'::jsonb,
 '["review of evidence","impact and risk assessment","root-cause analysis","correction and CAPA proposal","written summary and action plan"]'::jsonb,
 1500.00,'https://book.stripe.com/3cI00i90t6ZI2we6Cqdby07',10),
('complaint-analysis','Analiza reklamacji','Complaint Analysis',
 'Ekspercka analiza jednej reklamacji klienta lub konsumenta: identyfikacja możliwych przyczyn, ocena danych procesowych, proponowane działania i materiał do profesjonalnej odpowiedzi.',
 'Expert analysis of one customer or consumer complaint: possible causes, process-data review, recommended actions and material for a professional response.',
 '["uporządkowanie danych reklamacyjnych","analiza partii i zapisów procesu","ocena możliwych przyczyn","propozycja działań korygujących","szkielet odpowiedzi do klienta i raport analizy"]'::jsonb,
 '["complaint data review","lot and process-record analysis","assessment of possible causes","corrective-action proposal","customer-response outline and analysis report"]'::jsonb,
 1500.00,'https://book.stripe.com/eVq00i3G9do69YG7Gudby08',20),
('quality-problem-analysis','Analiza problemu jakościowego','Quality Problem Analysis',
 'Strukturalna analiza jednego problemu jakościowego lub procesowego z oceną przyczyn, skali, ryzyka oraz rekomendacjami dotyczącymi stabilizacji procesu i zapobiegania nawrotom.',
 'Structured analysis of one quality or process problem, covering causes, scale, risk and recommendations to stabilise the process and prevent recurrence.',
 '["definicja problemu i zakresu","mapa danych i faktów","analiza przyczyn","ocena ryzyka i wpływu","plan działań natychmiastowych i trwałych","pisemny raport końcowy"]'::jsonb,
 '["problem definition and scope","data and fact map","cause analysis","risk and impact assessment","immediate and permanent action plan","final written report"]'::jsonb,
 1500.00,'https://book.stripe.com/14A8wO5OhgAib2K3qedby09',30),
('new-technology-introduction','Wprowadzenie nowej technologii','New Technology Introduction',
 'Ekspercka analiza wdrożenia jednej nowej technologii, maszyny, etapu procesu lub istotnej zmiany technologicznej z perspektywy jakości i bezpieczeństwa żywności.',
 'Expert analysis of implementing one new technology, machine, process step or significant technological change from a food quality and safety perspective.',
 '["ocena wpływu na proces i produkt","aktualizacja ryzyk i analizy zagrożeń","wymagania dla walidacji i prób","plan kontroli i monitoringu","wpływ na dokumentację, szkolenia i identyfikowalność","lista działań przed uruchomieniem"]'::jsonb,
 '["process and product impact assessment","risk and hazard-analysis update","validation and trial requirements","control and monitoring plan","impact on documentation, training and traceability","pre-launch action list"]'::jsonb,
 1500.00,'https://book.stripe.com/6oU14mb8Bdo68UCbWKdby0a',40)
on conflict (slug) do update set
  name_pl=excluded.name_pl,name_en=excluded.name_en,
  description_pl=excluded.description_pl,description_en=excluded.description_en,
  deliverables_pl=excluded.deliverables_pl,deliverables_en=excluded.deliverables_en,
  price_pln=excluded.price_pln,checkout_url=excluded.checkout_url,
  active=true,sort_order=excluded.sort_order,updated_at=now();
