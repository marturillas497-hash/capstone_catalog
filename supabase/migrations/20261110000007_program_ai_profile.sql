-- Step 5a: per-program AI advice settings.
-- The advisory prompt is built from programs.ai_profile (see lib/aiProfile.js).
-- Additive: the code deployed today does not read this column.

alter table public.programs add column ai_profile jsonb;

-- The profile is prompt text, so it stays server-side. The programs list is public
-- (the register page needs it), so signed-out and signed-in users get column grants
-- that leave ai_profile out. The service role is not affected.
revoke select on public.programs from anon, authenticated;
grant select (id, code, name, created_at) on public.programs to anon, authenticated;

update public.programs set ai_profile = $j${
  "discipline": "Bachelor of Science in Information Systems (BSIS) capstone projects",
  "topic": "capstone topic",
  "focus": "Silently identify the proposal's core system type in one short phrase (e.g. an inventory management system) and do not print it. Every title and direction must be that same core system type, applied differently as instructed per section.",
  "title_form": "describes one system with one clear purpose (never a feasibility study, analysis, assessment, or review)",
  "titles": [
    "Same core system type, scoped to a narrower or different function or record type than the matched studies cover (never one their abstracts already name).",
    "Same core system type, applied to a different sector or beneficiary group.",
    "Same core system type, plus exactly one AI feature as its core differentiator that is genuinely useful to the system. Only one technology in this title."
  ],
  "noun": "project",
  "uncovered": "function, beneficiary, or record type",
  "varied": "sector or beneficiary",
  "org_examples": "a small barangay office, a rural health unit",
  "local": "Typical settings are barangay offices, rural health units, municipal offices, schools, farmers' cooperatives, and small local businesses.",
  "specific": "Keep the system's function specific even though the organization is generic: one defined problem, one defined output, one defined user group.",
  "limits": "Assume unreliable internet and mostly Android phones. Do not suggest systems that depend on costly hardware, constant high-speed internet, or integration with national government systems."
}$j$::jsonb where code = 'BSIS';

update public.programs set ai_profile = $j${
  "discipline": "Bachelor of Science in Criminology (BSC) research studies",
  "topic": "research topic",
  "focus": "Silently identify the proposal's core research focus in one short phrase (the crime, justice, or community safety issue plus the group or setting studied) and do not print it. Every title and direction must keep that same core issue, studied through the different angle instructed per section.",
  "title_form": "states one research problem about one group of people in one kind of setting, as a descriptive study title (for example awareness, perception, effectiveness, or contributing factors) and never as a software project",
  "titles": [
    "Same core issue, narrowed to a more specific aspect, offense type, or program than the matched studies cover (never one their abstracts already name).",
    "Same core issue, studied among a different group of respondents or in a different kind of community or setting.",
    "Same core issue, adding exactly one extra angle that genuinely helps explain it, such as comparing two groups or looking at one added factor. Only one added angle in this title."
  ],
  "noun": "study",
  "uncovered": "focus, group of respondents, or setting",
  "varied": "group of respondents or setting",
  "org_examples": "a barangay peace and order council, a public high school, a tricycle drivers' association",
  "local": "Typical settings are barangays, public markets, public schools, and tricycle and jeepney routes in a small municipality.",
  "specific": "Keep every title and direction specific even though the setting is generic: one defined problem, one defined group of respondents, one defined setting.",
  "limits": "Only suggest studies that use surveys, interviews with consenting adults, or public documents. Do not suggest studies that need confidential police, court, or case records, interviews with victims or with minors in conflict with the law, jail access, forensic laboratory work, or any fieldwork that puts students at risk."
}$j$::jsonb where code = 'BSC';

update public.programs set ai_profile = $j${
  "discipline": "Bachelor of Science in Agriculture (BSA) research studies",
  "topic": "research topic",
  "focus": "Silently identify the proposal's core research focus in one short phrase (the crop, animal, or farming practice plus the question asked about it) and do not print it. Every title and direction must keep that same core focus, studied through the different angle instructed per section.",
  "title_form": "states one agricultural research problem about one crop, animal, or farming practice, as a descriptive or experimental study title and never as a software project",
  "titles": [
    "Same core crop, animal, or practice, narrowed to a more specific aspect, variety, growth stage, or management practice than the matched studies cover (never one their abstracts already name).",
    "Same core focus, applied to a different crop, animal, or kind of farm or farming community.",
    "Same core focus, adding exactly one extra factor to test or compare, such as one organic input, planting method, or post-harvest step. Only one added factor in this title."
  ],
  "noun": "study",
  "uncovered": "crop, practice, or group of farmers",
  "varied": "crop, animal, or farming community",
  "org_examples": "a farmers' association, a small family farm, a municipal agriculture office",
  "local": "Realistic local crops and livestock include rice, corn, banana, rubber, coffee, cacao, vegetables, and fruit trees, plus backyard poultry, hogs, goats, and cattle. Farms are mostly small, in lowland and upland barangays, with distinct wet and dry seasons.",
  "specific": "Keep every title and direction specific even though the setting is generic: one defined problem, one defined crop or animal, one defined farming setting.",
  "limits": "Only suggest studies a student can finish within one cropping season or one short animal production cycle, on a small plot or a few animals, using low-cost inputs and simple measurements. Do not suggest studies that need laboratory analysis, imported or restricted chemicals, biotechnology, or trees that take years to bear fruit."
}$j$::jsonb where code = 'BSA';

update public.programs set ai_profile = $j${
  "discipline": "Bachelor of Science in Midwifery (BSM) research studies",
  "topic": "research topic",
  "focus": "Silently identify the proposal's core research focus in one short phrase (the maternal, newborn, or community health topic plus the group of people studied) and do not print it. Every title and direction must keep that same core topic, studied through the different angle instructed per section.",
  "title_form": "states one research problem about one group of people in one kind of setting, as a descriptive study title (for example knowledge, practices, contributing factors, or experiences) and never as a software project or a clinical procedure",
  "titles": [
    "Same core topic, narrowed to a more specific aspect, stage of care, or practice than the matched studies cover (never one their abstracts already name).",
    "Same core topic, studied among a different group of mothers, families, or health workers, or in a different kind of community.",
    "Same core topic, adding exactly one extra factor to look at, such as one cultural belief, one access barrier, or one source of information. Only one added factor in this title."
  ],
  "noun": "study",
  "uncovered": "focus, group of respondents, or setting",
  "varied": "group of respondents or community",
  "org_examples": "a barangay health station, a rural health unit, a barangay health workers' group",
  "local": "Typical settings are barangay health stations, rural health units, and communities where some mothers live far from a facility, including upland and indigenous communities, where barangay health workers and traditional birth attendants (hilots) are part of everyday care.",
  "specific": "Keep every title and direction specific even though the setting is generic: one defined problem, one defined group of respondents, one defined setting.",
  "limits": "Only suggest studies that use surveys or interviews with consenting adult respondents, or public health program reports. Do not suggest studies that need individual patient records, clinical procedures, physical examination, medication, or any intervention on mothers or babies. Avoid studies that interview minors or involve very sensitive personal topics."
}$j$::jsonb where code = 'BSM';

update public.programs set ai_profile = $j${
  "discipline": "Bachelor of Public Administration (BPA) research studies",
  "topic": "research topic",
  "focus": "Silently identify the proposal's core research focus in one short phrase (the public service, program, or governance issue plus the office or community it concerns) and do not print it. Every title and direction must keep that same core issue, studied through the different angle instructed per section.",
  "title_form": "states one research problem about one public service, program, or office, as a descriptive study title (for example implementation, awareness, satisfaction, or challenges) and never as a software project",
  "titles": [
    "Same core issue, narrowed to a more specific service, process, or aspect of implementation than the matched studies cover (never one their abstracts already name).",
    "Same core issue, studied in a different kind of office, barangay, or group of service users.",
    "Same core issue, adding exactly one extra factor, such as one resource constraint, one participation channel, or one communication practice. Only one added factor in this title."
  ],
  "noun": "study",
  "uncovered": "service, office, or group of service users",
  "varied": "office, barangay, or group of service users",
  "org_examples": "a barangay council, a municipal office, a people's organization",
  "local": "Typical settings are barangay halls, municipal offices, barangay development councils, and local programs such as solid waste management, disaster risk reduction, and social services.",
  "specific": "Keep every title and direction specific even though the setting is generic: one defined problem, one defined service or program, one defined group of respondents.",
  "limits": "Only suggest studies based on surveys, interviews with consenting officials or residents, observation, or public documents such as published ordinances and annual reports. Do not suggest studies that need confidential government records or non-public budget data, or that evaluate named officials."
}$j$::jsonb where code = 'BPA';

update public.programs set ai_profile = $j${
  "discipline": "Bachelor of Science in Entrepreneurship (BSE) feasibility studies and business plans",
  "topic": "feasibility study or business plan topic",
  "focus": "Silently identify the proposal's core business idea in one short phrase (the product or service plus the customers it serves) and do not print it. Every title and direction must keep that same core business idea, applied differently as instructed per section.",
  "title_form": "describes one business idea for one defined market, written as a feasibility study or business plan title",
  "titles": [
    "Same core business idea, narrowed to a more specific product, service variant, or customer need than the matched studies cover (never one their abstracts already name).",
    "Same core business idea, aimed at a different group of customers or a different local market.",
    "Same core business idea, adding exactly one differentiator, such as one added product feature, service, or sales channel. Only one differentiator in this title."
  ],
  "noun": "business idea",
  "uncovered": "product, customer group, or local market",
  "varied": "customer group or local market",
  "org_examples": "a small family-run shop, a farmers' cooperative",
  "local": "Typical local markets are public markets, barangay stores, schools, farmers and their cooperatives, and visitors passing through the area. Use local products and services, such as agricultural products, food, and basic services.",
  "specific": "Keep every title and direction specific even though the setting is generic: one defined product or service, one defined group of customers, one defined local market.",
  "limits": "Only suggest businesses that could start with small capital, a few workers, and mostly locally sourced materials. Do not suggest businesses that need heavy equipment, special government licenses, imported inputs, or a large-city market."
}$j$::jsonb where code = 'BSE';
