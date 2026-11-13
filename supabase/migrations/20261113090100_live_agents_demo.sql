-- Demo Live Agents so the listing pages have something to show before real
-- agents sign up. Every row is is_demo = true: the pages label them
-- "Demo profile", keep them out of search engines, and show no ratings or
-- reviews. The voice clips are AI voices (labeled as such), served from
-- /public/live-agents/demo. Remove them all later with:
--   delete from public.live_agents where is_demo;

insert into public.live_agents
  (handle, display_name, headline, bio, city, region, time_zone, geo_lat, geo_lng, years_experience, languages, industries, skills,
   experience, per_minute_cents, hourly_cents, retainer_cents, retainer_hours, availability, available_now, status, is_demo, indexable, reply_minutes)
values
  ('maya-r', 'Maya R.', 'Warm, organized front desk for medical and dental offices',
   'Seven years running the front desk at a busy family dental practice. I book, confirm and reschedule, verify insurance, and switch to Spanish whenever a caller is more comfortable.',
   'Chandler', 'AZ', 'America/Phoenix', 33.3197, -111.8602, 7, array['English', 'Spanish'], array['Dental', 'Medical', 'Wellness'],
   array['live-answering', 'booking', 'bilingual', 'medical-office', 'warm-transfers', 'follow-up'],
   '[{"title": "Front desk lead, family dental practice", "detail": "5 years · scheduling, insurance verification"}, {"title": "Patient coordinator, urgent care", "detail": "2 years · intake and triage calls"}]',
   85, 3000, 115000, 40, '{"mon": ["07:00", "16:00"], "tue": ["07:00", "16:00"], "wed": ["07:00", "16:00"], "thu": ["07:00", "16:00"], "fri": ["07:00", "13:00"]}',
   true, 'live', true, false, 20),
  ('daniel-b', 'Daniel B.', 'Calm, professional B2B support and account calls',
   'Eleven years in software and IT support. I handle account questions, triage tickets and hand off to the right specialist with the details already captured.',
   'Chicago', 'IL', 'America/Chicago', 41.8907, -87.6491, 11, array['English'], array['Technology', 'B2B services'],
   array['live-answering', 'support', 'lead-qualification', 'warm-transfers', 'crm-entry'],
   '[{"title": "Support team lead, SaaS company", "detail": "6 years · tier 1 and 2 phone support"}, {"title": "Inside sales coordinator", "detail": "5 years · qualifying inbound leads"}]',
   95, 3200, null, null, '{"mon": ["08:00", "17:00"], "tue": ["08:00", "17:00"], "wed": ["08:00", "17:00"], "thu": ["08:00", "17:00"], "fri": ["08:00", "17:00"]}',
   true, 'live', true, false, 45),
  ('sofia-m', 'Sofia M.', 'Bilingual scheduling and friendly appointment reminders',
   'I keep calendars full for wellness studios and clinics: booking, rescheduling, reminder calls and answering questions in English or Spanish.',
   'Tucson', 'AZ', 'America/Phoenix', 32.2389, -110.9531, 5, array['English', 'Spanish'], array['Wellness', 'Healthcare admin'],
   array['booking', 'bilingual', 'outbound-callbacks', 'follow-up', 'live-answering'],
   '[{"title": "Scheduling coordinator, physical therapy group", "detail": "3 years"}, {"title": "Receptionist, day spa", "detail": "2 years"}]',
   75, 2600, 95000, 40, '{"tue": ["09:00", "18:00"], "wed": ["09:00", "18:00"], "thu": ["09:00", "18:00"], "fri": ["09:00", "18:00"], "sat": ["09:00", "14:00"]}',
   false, 'live', true, false, 60),
  ('alex-m', 'Alex M.', 'Polished front desk for real estate and hospitality',
   'Nine years at hotel front desks and a busy brokerage. I qualify buyers and sellers, set showings and make every caller feel looked after.',
   'Scottsdale', 'AZ', 'America/Phoenix', 33.5038, -111.9083, 9, array['English', 'French'], array['Real estate', 'Hospitality'],
   array['live-answering', 'real-estate', 'lead-qualification', 'booking', 'warm-transfers'],
   '[{"title": "Office coordinator, real estate brokerage", "detail": "4 years · showings and lead intake"}, {"title": "Front desk manager, resort", "detail": "5 years"}]',
   105, 3400, 125000, 40, '{"mon": ["10:00", "19:00"], "tue": ["10:00", "19:00"], "wed": ["10:00", "19:00"], "sat": ["09:00", "17:00"], "sun": ["10:00", "16:00"]}',
   true, 'live', true, false, 30),
  ('priya-s', 'Priya S.', 'Steady after-hours and overnight coverage',
   'I cover evenings and overnights for property managers and service companies: sorting true emergencies from what can wait, paging on-call staff and logging every call.',
   'Tempe', 'AZ', 'America/Phoenix', 33.4119, -111.9213, 6, array['English', 'Hindi'], array['Property management', 'Home services'],
   array['after-hours', 'support', 'dispatch', 'crm-entry', 'live-answering'],
   '[{"title": "After-hours dispatcher, property management", "detail": "4 years"}, {"title": "Call center agent, utilities", "detail": "2 years"}]',
   80, 2800, null, null, '{"mon": ["18:00", "23:59"], "tue": ["18:00", "23:59"], "wed": ["18:00", "23:59"], "thu": ["18:00", "23:59"], "fri": ["18:00", "23:59"], "sat": ["18:00", "23:59"]}',
   false, 'live', true, false, 90),
  ('marcus-j', 'Marcus J.', 'Fast, friendly dispatch for home services',
   'Former HVAC dispatcher. I book service calls, set arrival windows, take payments for trip fees and keep the crew''s schedule moving.',
   'Mesa', 'AZ', 'America/Phoenix', 33.4291, -111.8094, 8, array['English'], array['Home services', 'Trades'],
   array['dispatch', 'booking', 'payments', 'live-answering', 'after-hours'],
   '[{"title": "Dispatcher, HVAC company", "detail": "6 years"}, {"title": "Customer service, plumbing contractor", "detail": "2 years"}]',
   70, 2500, 90000, 40, '{"mon": ["06:00", "15:00"], "tue": ["06:00", "15:00"], "wed": ["06:00", "15:00"], "thu": ["06:00", "15:00"], "fri": ["06:00", "15:00"], "sat": ["07:00", "12:00"]}',
   true, 'live', true, false, 25),
  ('grace-l', 'Grace L.', 'Careful, confidential legal intake',
   'Paralegal background. I take intake calls for personal injury and family law firms, capture the facts that matter, check conflicts and book consultations.',
   'Phoenix', 'AZ', 'America/Phoenix', 33.4688, -112.0559, 10, array['English', 'Mandarin'], array['Legal'],
   array['legal-intake', 'live-answering', 'booking', 'warm-transfers', 'crm-entry'],
   '[{"title": "Intake specialist, personal injury firm", "detail": "6 years"}, {"title": "Legal assistant, family law", "detail": "4 years"}]',
   110, 3600, 135000, 40, '{"mon": ["08:00", "17:00"], "tue": ["08:00", "17:00"], "wed": ["08:00", "17:00"], "thu": ["08:00", "17:00"], "fri": ["08:00", "17:00"]}',
   false, 'live', true, false, 40),
  ('luis-h', 'Luis H.', 'Order taking and phone payments for restaurants and catering',
   'I take orders accurately at speed, read them back, handle card payments securely and keep regulars happy, in English or Spanish.',
   'Dallas', 'TX', 'America/Chicago', 32.7942, -96.7865, 4, array['English', 'Spanish'], array['Restaurants', 'Catering', 'Retail'],
   array['order-taking', 'payments', 'bilingual', 'live-answering', 'support'],
   '[{"title": "Catering sales associate", "detail": "3 years"}, {"title": "Phone orders, family restaurant", "detail": "1 year"}]',
   65, 2200, null, null, '{"mon": ["10:00", "20:00"], "wed": ["10:00", "20:00"], "thu": ["10:00", "20:00"], "fri": ["10:00", "21:00"], "sat": ["10:00", "21:00"]}',
   true, 'live', true, false, 35)
on conflict (handle) do nothing;

insert into public.live_agent_voice_samples (agent_id, title, transcript, storage_path, featured, ai_voice, status, sort)
select a.id, v.title, v.transcript, v.path, v.featured, true, 'approved', v.sort
from (values
  ('maya-r', 'Greeting', 'Thank you for calling Sonoran Smiles Dental, this is Maya. Are you an existing patient, or would you like to book your first visit with us?', '/live-agents/demo/maya-r-1.mp3', true, 1),
  ('maya-r', 'Warm transfer', 'Thanks for holding, Mr. Alvarez. I have Dr. Patel''s office on the line, and I''ve shared that you''d like a cleaning next Tuesday morning. Connecting you now.', '/live-agents/demo/maya-r-2.mp3', false, 2),
  ('maya-r', 'Spanish greeting', 'Gracias por llamar a Sonoran Smiles Dental, le habla Maya. ¿En qué le puedo ayudar hoy?', '/live-agents/demo/maya-r-3.mp3', false, 3),
  ('daniel-b', 'Greeting', 'Good afternoon, Northline Software support, this is Daniel. Can I get the name of your company and the email on the account?', '/live-agents/demo/daniel-b-1.mp3', true, 1),
  ('daniel-b', 'Warm transfer', 'I''m going to bring in our billing specialist. She''ll already have your account and the invoice number, so you won''t need to repeat anything.', '/live-agents/demo/daniel-b-2.mp3', false, 2),
  ('sofia-m', 'Greeting', 'Desert Bloom Wellness, this is Sofia. I can help you schedule, reschedule, or answer questions about your appointment.', '/live-agents/demo/sofia-m-1.mp3', true, 1),
  ('sofia-m', 'Booking confirmation', 'Perfect, you''re all set for Thursday at ten a.m. with Jordan. You''ll get a text confirmation in just a moment.', '/live-agents/demo/sofia-m-2.mp3', false, 2),
  ('alex-m', 'Greeting', 'Welcome to Camelback Realty Group, this is Alex. Are you calling about a listing you saw, or looking to sell your home?', '/live-agents/demo/alex-m-1.mp3', true, 1),
  ('alex-m', 'Warm transfer', 'Let me connect you with Rachel, the listing agent for that property. I''ve let her know you''d like a showing this weekend.', '/live-agents/demo/alex-m-2.mp3', false, 2),
  ('priya-s', 'After-hours greeting', 'You''ve reached the after-hours line for Copper State Property Management. This is Priya. Is this an emergency, like a leak or no heat?', '/live-agents/demo/priya-s-1.mp3', true, 1),
  ('priya-s', 'Emergency handoff', 'I''ve logged the leak under your unit and paged the on-call technician. He''ll call you back within fifteen minutes.', '/live-agents/demo/priya-s-2.mp3', false, 2),
  ('marcus-j', 'Greeting', 'Valley Air Heating and Cooling, this is Marcus. What''s going on with your system today?', '/live-agents/demo/marcus-j-1.mp3', true, 1),
  ('marcus-j', 'Booking a visit', 'I can get a technician out tomorrow between eight and ten. Can I confirm the address and the best number to reach you?', '/live-agents/demo/marcus-j-2.mp3', false, 2),
  ('grace-l', 'Greeting', 'Thank you for calling Mesa Ridge Law. This is Grace. I can take a few details about your matter and set up a consultation.', '/live-agents/demo/grace-l-1.mp3', true, 1),
  ('grace-l', 'Warm transfer', 'I''m transferring you to attorney Brooks now. I''ve passed along the date of the accident and the insurance company involved.', '/live-agents/demo/grace-l-2.mp3', false, 2),
  ('luis-h', 'Greeting', 'Thanks for calling Lone Star Catering, this is Luis. Are you placing an order or asking about an event?', '/live-agents/demo/luis-h-1.mp3', true, 1),
  ('luis-h', 'Order read-back', 'That''s forty boxed lunches for Friday at noon, delivered to your office. I''ll read back the order before I take payment.', '/live-agents/demo/luis-h-2.mp3', false, 2)
) as v(handle, title, transcript, path, featured, sort)
join public.live_agents a on a.handle = v.handle and a.is_demo
where not exists (select 1 from public.live_agent_voice_samples s where s.agent_id = a.id);
