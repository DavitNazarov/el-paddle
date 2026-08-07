export const ACCOUNT_TERMS_VERSION = '2026-08-06';
export const PRIVACY_POLICY_VERSION = '2026-08-06';
export const PARTICIPATION_TERMS_VERSION = '2026-07-17';
export const REFUND_POLICY_VERSION = '2026-07-17';

export const legalDocumentSlugs = ['privacy', 'terms', 'refunds', 'cookies'] as const;
export type LegalDocumentSlug = (typeof legalDocumentSlugs)[number];

export const legalBusiness = {
  name: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || 'El Padel Tournament Tbilisi',
  legalForm: process.env.NEXT_PUBLIC_LEGAL_ENTITY_FORM || 'Organizer',
  // No placeholder: the old fallback rendered `SET-NEXT-PUBLIC-LEGAL-ENTITY-ID`
  // on the public legal pages as if it were the company's real registration
  // number. An empty value is honest, and the page omits the row instead.
  identificationNumber: process.env.NEXT_PUBLIC_LEGAL_ENTITY_ID || '',
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || 'Tbilisi, Georgia',
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || 'register@elpadel.club',
  phone: process.env.NEXT_PUBLIC_LEGAL_PHONE || '',
};

type LocalizedText = { en: string; ka: string };
type LegalSection = { title: LocalizedText; paragraphs?: LocalizedText[]; items?: LocalizedText[] };

export type LegalDocument = {
  title: LocalizedText;
  summary: LocalizedText;
  version: string;
  sections: LegalSection[];
};

export const legalDocuments: Record<LegalDocumentSlug, LegalDocument> = {
  privacy: {
    title: { en: 'Privacy Policy', ka: 'კონფიდენციალურობის პოლიტიკა' },
    summary: {
      en: 'How El Padel collects, uses, shares, retains, and protects personal data.',
      ka: 'როგორ აგროვებს, იყენებს, გადასცემს, ინახავს და იცავს El Padel პერსონალურ მონაცემებს.',
    },
    version: PRIVACY_POLICY_VERSION,
    sections: [
      {
        title: { en: '1. Controller and contact', ka: '1. დამუშავებაზე პასუხისმგებელი პირი და კონტაქტი' },
        paragraphs: [{
          en: 'The controller is the organization identified in the Business details section below. Privacy and data-rights requests may be sent to the listed email address.',
          ka: 'დამუშავებაზე პასუხისმგებელი პირია ქვემოთ, „ორგანიზაციის მონაცემებში“ მითითებული ორგანიზაცია. კონფიდენციალურობასა და მონაცემთა უფლებებთან დაკავშირებული მოთხოვნები შეგიძლიათ გაგზავნოთ მითითებულ ელფოსტაზე.',
        }],
      },
      {
        title: { en: '2. Data we process', ka: '2. რა მონაცემებს ვამუშავებთ' },
        items: [
          { en: 'Account and identity data: name, surname, email, phone number, verification status, login provider, club membership, and age/guardian confirmation.', ka: 'ანგარიშისა და იდენტიფიკაციის მონაცემები: სახელი, გვარი, ელფოსტა, ტელეფონი, ვერიფიკაციის სტატუსი, შესვლის პროვაიდერი, კლუბის წევრობა და სრულწლოვანების/მეურვის თანხმობის დადასტურება.' },
          { en: 'Tournament data: event and category selections, teammate details, registration status, schedule, opponents, scores, results, rankings, disciplinary decisions, and payment/approval status. We do not collect card or online-banking credentials.', ka: 'ტურნირის მონაცემები: ღონისძიებისა და კატეგორიის არჩევანი, თანაგუნდელის მონაცემები, რეგისტრაციის სტატუსი, განრიგი, მეტოქეები, ანგარიშები, შედეგები, რეიტინგი, დისციპლინური გადაწყვეტილებები და გადახდის/დამტკიცების სტატუსი. ჩვენ არ ვაგროვებთ საბარათე ან ინტერნეტბანკის მონაცემებს.' },
          { en: 'Technical and security data: IP address, session and security-cookie data, timestamps, device/browser information made available by requests, audit events, and security logs.', ka: 'ტექნიკური და უსაფრთხოების მონაცემები: IP მისამართი, სესიისა და უსაფრთხოების cookie-ების მონაცემები, დროის ნიშნები, მოთხოვნით მოწოდებული მოწყობილობის/ბრაუზერის ინფორმაცია, აუდიტისა და უსაფრთხოების ჩანაწერები.' },
          { en: 'Communications: verification codes, invitations, support messages, registration notices, and optional messages sent through tournament features.', ka: 'კომუნიკაცია: ვერიფიკაციის კოდები, მოწვევები, მხარდაჭერის შეტყობინებები, რეგისტრაციის ცნობები და ტურნირის ფუნქციებით გაგზავნილი არასავალდებულო შეტყობინებები.' },
        ],
      },
      {
        title: { en: '3. Purposes and legal bases', ka: '3. მიზნები და სამართლებრივი საფუძვლები' },
        items: [
          { en: 'To create and secure accounts, organize tournaments, process registrations, communicate operational updates, publish authorized competition information, and provide requested services—because this is necessary to enter into or perform our agreement with you.', ka: 'ანგარიშების შექმნისა და დაცვის, ტურნირების ორგანიზების, რეგისტრაციების დამუშავების, საოპერაციო შეტყობინებების, ნებადართული შეჯიბრის ინფორმაციის გამოქვეყნებისა და მოთხოვნილი მომსახურების გასაწევად — თქვენთან შეთანხმების დადებისა და შესრულების მიზნით.' },
          { en: 'To prevent abuse, maintain audit trails, protect participants, resolve disputes, and improve reliability—based on our and participants’ legitimate interests, balanced against your rights.', ka: 'ბოროტად გამოყენების თავიდან ასაცილებლად, აუდიტის კვალის შესანარჩუნებლად, მონაწილეთა დასაცავად, დავების გადასაწყვეტად და საიმედოობის გასაუმჯობესებლად — ჩვენი და მონაწილეთა კანონიერი ინტერესების საფუძველზე, თქვენი უფლებების გათვალისწინებით.' },
          { en: 'To keep legally required records and respond to competent authorities—where required by law.', ka: 'კანონით მოთხოვნილი ჩანაწერების შესანახად და უფლებამოსილი ორგანოების მოთხოვნებზე საპასუხოდ — კანონით გათვალისწინებულ შემთხვევებში.' },
          { en: 'Promotional email, SMS, or optional photo/video publication will rely on separate consent where required. Consent can be withdrawn without affecting earlier lawful processing.', ka: 'სარეკლამო ელფოსტა, SMS ან არჩევითი ფოტო/ვიდეოს გამოქვეყნება საჭიროების შემთხვევაში დაეფუძნება ცალკე თანხმობას. თანხმობის გაუქმება არ იმოქმედებს მანამდე კანონიერად განხორციელებულ დამუშავებაზე.' },
        ],
      },
      {
        title: { en: '4. Teammate data and invitations', ka: '4. თანაგუნდელის მონაცემები და მოწვევები' },
        paragraphs: [{
          en: 'A player may select or invite a teammate. If another person provides your details, we use them to create or match an invited profile, send the invitation or operational notice, and prevent duplicate entries. The invitation identifies the source and links to this Policy. Do not provide someone else’s details unless you are authorized to do so.',
          ka: 'მოთამაშეს შეუძლია თანაგუნდელის არჩევა ან მოწვევა. თუ თქვენი მონაცემები სხვა პირმა მოგვაწოდა, მათ ვიყენებთ მოწვეული პროფილის შესაქმნელად/დასაკავშირებლად, მოწვევის ან საოპერაციო შეტყობინების გასაგზავნად და დუბლირებული განაცხადების თავიდან ასაცილებლად. მოწვევაში მითითებულია წყარო და ამ პოლიტიკის ბმული. ნუ მოგვაწვდით სხვის მონაცემებს შესაბამისი უფლებამოსილების გარეშე.',
        }],
      },
      {
        title: { en: '5. Recipients and international transfers', ka: '5. მიმღებები და საერთაშორისო გადაცემა' },
        paragraphs: [{
          en: 'Data may be available to authorized organizers, judges, and administrators as needed; to teammates and other participants where a tournament feature requires it; and to vetted hosting, database, email, authentication, monitoring, and support providers acting for us. Public club pages, brackets, schedules, scores, results, and rankings may display limited participant information when publication is enabled. Independently of any event, an active player account is listed in the public player directory and has a public profile page showing your name, club, club role, and aggregate match record; this listing is part of the service and lasts while the account is active. Some providers may process data outside Georgia; we use contractual and other appropriate safeguards where required.',
          ka: 'მონაცემები საჭიროების ფარგლებში შეიძლება ხელმისაწვდომი იყოს უფლებამოსილი ორგანიზატორებისთვის, მსაჯებისა და ადმინისტრატორებისთვის; თანაგუნდელებისა და სხვა მონაწილეებისთვის, როცა ამას ტურნირის ფუნქცია მოითხოვს; ასევე ჩვენთვის მოქმედი ჰოსტინგის, მონაცემთა ბაზის, ელფოსტის, ავთენტიფიკაციის, მონიტორინგისა და მხარდაჭერის სანდო მომწოდებლებისთვის. გამოქვეყნების ჩართვისას საჯარო კლუბის გვერდებზე, ბადეში, განრიგში, ანგარიშებში, შედეგებსა და რეიტინგში შეიძლება გამოჩნდეს მონაწილეთა შეზღუდული ინფორმაცია. ნებისმიერი ღონისძიებისგან დამოუკიდებლად, აქტიური მოთამაშის ანგარიში ჩამოთვლილია მოთამაშეთა საჯარო კატალოგში და აქვს საჯარო პროფილის გვერდი, სადაც ჩანს სახელი, კლუბი, კლუბში როლი და მატჩების ჯამური ჩანაწერი; ეს სერვისის ნაწილია და ძალაშია ანგარიშის აქტიურობის მანძილზე. ზოგი მომწოდებელი მონაცემებს საქართველოს ფარგლებს გარეთ ამუშავებს; საჭიროების შემთხვევაში ვიყენებთ სახელშეკრულებო და სხვა სათანადო გარანტიებს.',
        }],
      },
      {
        title: { en: '6. Retention', ka: '6. შენახვის ვადები' },
        paragraphs: [{
          en: 'Active account data is kept while the account is used. Verification codes and temporary OAuth data expire quickly. Operational, acceptance, registration, score, result, dispute, security, and audit records are retained for the period reasonably needed for tournament history, legal claims, accounting, fraud prevention, and legal obligations, then deleted or anonymized. We review retention periodically and do not keep data longer than necessary.',
          ka: 'აქტიური ანგარიშის მონაცემები ინახება ანგარიშის გამოყენების პერიოდში. ვერიფიკაციის კოდები და დროებითი OAuth მონაცემები სწრაფად იწურება. საოპერაციო, თანხმობის, რეგისტრაციის, ანგარიშის, შედეგის, დავის, უსაფრთხოებისა და აუდიტის ჩანაწერები ინახება ტურნირის ისტორიის, სამართლებრივი მოთხოვნების, ბუღალტერიის, თაღლითობის პრევენციისა და კანონიერი ვალდებულებებისთვის გონივრულად საჭირო ვადით, შემდეგ იშლება ან ანონიმდება. ვადებს პერიოდულად ვამოწმებთ.',
        }],
      },
      {
        title: { en: '7. Your rights', ka: '7. თქვენი უფლებები' },
        items: [
          { en: 'Request information, access, and a copy of your personal data.', ka: 'მოითხოვოთ ინფორმაცია, წვდომა და თქვენი მონაცემების ასლი.' },
          { en: 'Request correction, completion, updating, blocking, erasure, destruction, or restriction where applicable.', ka: 'მოითხოვოთ მონაცემების გასწორება, შევსება, განახლება, დაბლოკვა, წაშლა, განადგურება ან შეზღუდვა შესაბამის შემთხვევებში.' },
          { en: 'Object to processing, withdraw consent, and request data portability where the law provides.', ka: 'გააპროტესტოთ დამუშავება, გააუქმოთ თანხმობა და მოითხოვოთ მონაცემთა პორტირება კანონით გათვალისწინებულ შემთხვევებში.' },
          { en: 'Complain to the State Audit Office of Georgia or a court. We may verify identity before fulfilling a request.', ka: 'საჩივრით მიმართოთ საქართველოს სახელმწიფო აუდიტის სამსახურს ან სასამართლოს. მოთხოვნის შესრულებამდე შეიძლება დაგვჭირდეს თქვენი ვინაობის დადასტურება.' },
        ],
      },
      {
        title: { en: '8. Security and changes', ka: '8. უსაფრთხოება და ცვლილებები' },
        paragraphs: [{
          en: 'We use access controls, secure session cookies, encryption in transit, rate limits, audit logging, backups, and other proportionate safeguards. No system is risk-free. Material Policy changes will be announced in the service and, where required, renewed acceptance will be requested.',
          ka: 'ვიყენებთ წვდომის კონტროლს, დაცულ სესიურ cookie-ებს, გადაცემისას დაშიფვრას, სიხშირის შეზღუდვას, აუდიტის ჩანაწერებს, სარეზერვო ასლებსა და სხვა თანაზომიერ ზომებს. არცერთი სისტემა არ არის რისკისგან სრულად თავისუფალი. არსებითი ცვლილებები გამოცხადდება სერვისში და საჭიროების შემთხვევაში ხელახალ თანხმობას მოვითხოვთ.',
        }],
      },
    ],
  },
  terms: {
    title: { en: 'Terms of Use & Participation', ka: 'გამოყენებისა და მონაწილეობის პირობები' },
    summary: { en: 'Rules for accounts, tournament entry, conduct, risk, publication, and disputes.', ka: 'ანგარიშის, ტურნირში რეგისტრაციის, ქცევის, რისკის, გამოქვეყნებისა და დავების წესები.' },
    version: ACCOUNT_TERMS_VERSION,
    sections: [
      { title: { en: '1. Agreement and operator', ka: '1. შეთანხმება და ოპერატორი' }, paragraphs: [{ en: 'By creating an account or submitting a tournament entry, you enter into an agreement with the organization identified below and agree to these Terms, the Privacy Policy, the Refund and Cancellation Policy, published event details, and applicable tournament rules. If there is a conflict, event-specific rules control for that event, followed by these Terms.', ka: 'ანგარიშის შექმნით ან ტურნირზე განაცხადის გაგზავნით თქვენ დებთ შეთანხმებას ქვემოთ მითითებულ ორგანიზაციასთან და ეთანხმებით ამ პირობებს, კონფიდენციალურობის პოლიტიკას, თანხის დაბრუნებისა და გაუქმების პოლიტიკას, გამოქვეყნებულ ღონისძიების მონაცემებსა და ტურნირის წესებს. წინააღმდეგობის შემთხვევაში კონკრეტული ღონისძიების წესებს აქვს უპირატესობა, შემდეგ — ამ პირობებს.' }] },
      { title: { en: '2. Eligibility and accounts', ka: '2. დაშვება და ანგარიშები' }, items: [
        { en: 'You must be at least 18, or participate with valid parent or legal-guardian authorization and any additional consent requested by the organizer.', ka: 'უნდა იყოთ სულ მცირე 18 წლის, ან მონაწილეობდეთ მშობლის/კანონიერი მეურვის მოქმედი ნებართვით და ორგანიზატორის მიერ მოთხოვნილი დამატებითი თანხმობით.' },
        { en: 'Provide accurate, current information; keep credentials confidential; use one personal account; and notify us promptly of unauthorized use.', ka: 'მოგვაწოდეთ ზუსტი და განახლებული ინფორმაცია; დაიცავით ავტორიზაციის მონაცემები; გამოიყენეთ ერთი პირადი ანგარიში და უნებართვო გამოყენების შესახებ დაუყოვნებლივ შეგვატყობინეთ.' },
        { en: 'You may provide teammate information only with authority to do so. A teammate may need to accept an invitation and complete their profile.', ka: 'თანაგუნდელის მონაცემები მოგვაწოდეთ მხოლოდ შესაბამისი უფლებამოსილებით. თანაგუნდელს შეიძლება დასჭირდეს მოწვევის მიღება და პროფილის დასრულება.' },
      ] },
      { title: { en: '3. Registration, fees, and formation of entry', ka: '3. რეგისტრაცია, საფასური და განაცხადის ძალაში შესვლა' }, paragraphs: [{ en: 'An online submission is a request to enter the selected event and category. The listed team fee, payment method, deadline, and receiver are shown before submission. Submitting confirms the obligation to pay, but participation is not final until payment requirements are met and the organizer approves the entry. Capacity, eligibility, team composition, and duplicate-entry rules apply.', ka: 'ონლაინ განაცხადი არის არჩეულ ღონისძიებასა და კატეგორიაში მონაწილეობის მოთხოვნა. გუნდის საფასური, გადახდის მეთოდი, ვადა და მიმღები ნაჩვენებია გაგზავნამდე. განაცხადის გაგზავნა ადასტურებს გადახდის ვალდებულებას, თუმცა მონაწილეობა საბოლოო არ არის გადახდის პირობების შესრულებამდე და ორგანიზატორის დამტკიცებამდე. მოქმედებს ტევადობის, დაშვების, გუნდის შემადგენლობისა და დუბლირებული განაცხადების წესები.' }] },
      { title: { en: '4. Tournament rules and organizer decisions', ka: '4. ტურნირის წესები და ორგანიზატორის გადაწყვეტილებები' }, items: [
        { en: 'Arrive by the published time, follow schedules, scoring rules, safety instructions, venue rules, equipment requirements, and reasonable directions from officials.', ka: 'გამოცხადდით მითითებულ დროს და დაიცავით განრიგი, ანგარიშის წესები, უსაფრთხოების ინსტრუქციები, მოედნის წესები, ინვენტარის მოთხოვნები და ოფიციალური პირების გონივრული მითითებები.' },
        { en: 'The organizer may correct administrative errors, seed or draw teams, appoint judges, adjust courts and times, resolve protests, and disqualify or remove participants for ineligibility, cheating, abuse, dangerous conduct, non-payment, no-show, or material rule breaches.', ka: 'ორგანიზატორს შეუძლია ადმინისტრაციული შეცდომების გასწორება, გუნდების განთესვა/კენჭისყრა, მსაჯების დანიშვნა, კორტებისა და დროის შეცვლა, პროტესტების გადაწყვეტა და მონაწილის დისკვალიფიკაცია ან მოხსნა დაუშვებლობის, თაღლითობის, შეურაცხყოფის, სახიფათო ქცევის, გადაუხდელობის, გამოუცხადებლობის ან არსებითი დარღვევის გამო.' },
        { en: 'Operational decisions made in good faith are final to the extent allowed by law; mandatory consumer rights remain unaffected.', ka: 'კეთილსინდისიერად მიღებული საოპერაციო გადაწყვეტილებები საბოლოოა კანონით დასაშვებ ფარგლებში; მომხმარებლის სავალდებულო უფლებები უცვლელია.' },
      ] },
      { title: { en: '5. Conduct and prohibited use', ka: '5. ქცევა და აკრძალული გამოყენება' }, paragraphs: [{ en: 'Do not harass, threaten, discriminate, impersonate, manipulate results, interfere with matches or systems, scrape protected data, introduce malware, evade security, misuse another person’s data, or use the service unlawfully. We may restrict or suspend access to protect participants and the service.', ka: 'აკრძალულია შევიწროება, მუქარა, დისკრიმინაცია, სხვის სახელად მოქმედება, შედეგების მანიპულირება, მატჩებსა ან სისტემაში ჩარევა, დაცული მონაცემების ავტომატური შეგროვება, მავნე კოდის გავრცელება, უსაფრთხოების გვერდის ავლა, სხვისი მონაცემების ბოროტად გამოყენება ან უკანონო გამოყენება. მონაწილეთა და სერვისის დასაცავად შეგვიძლია წვდომის შეზღუდვა ან შეჩერება.' }] },
      { title: { en: '6. Health, injury, and personal property', ka: '6. ჯანმრთელობა, ტრავმა და პირადი ნივთები' }, paragraphs: [{ en: 'Padel and event attendance involve foreseeable risks, including collision, falls, impact, overexertion, weather, equipment, and travel risks. By entering, you confirm that you are fit to participate, will stop if unsafe, and voluntarily accept ordinary inherent risks. Seek medical advice where appropriate. This clause does not exclude liability that cannot lawfully be excluded, including liability for intentional misconduct or gross negligence where applicable. You remain responsible for your belongings.', ka: 'პადელი და ღონისძიებაზე დასწრება მოიცავს პროგნოზირებად რისკებს, მათ შორის შეჯახებას, დაცემას, დარტყმას, გადაძაბვას, ამინდის, ინვენტარისა და მგზავრობის რისკებს. განაცხადით ადასტურებთ, რომ შეგიძლიათ მონაწილეობა, საფრთხის შემთხვევაში შეჩერდებით და ნებაყოფლობით იღებთ სპორტისთვის ჩვეულებრივ თანდაყოლილ რისკებს. საჭიროებისას მიმართეთ ექიმს. ეს პუნქტი არ გამორიცხავს პასუხისმგებლობას, რომლის გამორიცხვაც კანონით დაუშვებელია. პირად ნივთებზე პასუხისმგებელი თავად ხართ.' }] },
      { title: { en: '7. Public competition information and media', ka: '7. საჯარო შეჯიბრის ინფორმაცია და მედია' }, paragraphs: [{ en: 'Creating an account creates a public player profile: your name, club, club role, and aggregate match record are listed in the public player directory for as long as the account is active. When publication is enabled, your name, club, teammate, bracket position, schedule, opponent, score, result, and ranking may also be public as part of the competition record. Promotional portraits, interviews, or close-up media requiring consent will be handled separately. Crowd and event-overview recording may occur subject to posted notices and applicable law; contact us before the event if you have a safety concern.', ka: 'ანგარიშის შექმნა ქმნის მოთამაშის საჯარო პროფილს: სახელი, კლუბი, კლუბში როლი და მატჩების ჯამური ჩანაწერი ჩამოთვლილია მოთამაშეთა საჯარო კატალოგში ანგარიშის აქტიურობის მანძილზე. გამოქვეყნების ჩართვისას თქვენი სახელი, კლუბი, თანაგუნდელი, ბადეში ადგილი, განრიგი, მეტოქე, ანგარიში, შედეგი და რეიტინგი ასევე შეიძლება საჯაროდ გამოჩნდეს შეჯიბრის ჩანაწერის ფარგლებში. სარეკლამო პორტრეტები, ინტერვიუები ან ახლო კადრები, რომლებიც თანხმობას მოითხოვს, ცალკე დამუშავდება. აუდიტორიისა და ღონისძიების საერთო გადაღება შეიძლება განხორციელდეს განთავსებული შეტყობინებებისა და კანონის შესაბამისად; უსაფრთხოების საკითხზე ღონისძიებამდე დაგვიკავშირდით.' }] },
      { title: { en: '8. Availability and liability', ka: '8. ხელმისაწვდომობა და პასუხისმგებლობა' }, paragraphs: [{ en: 'We aim to keep information accurate and the service available, but maintenance, connectivity, venue, weather, supplier, safety, and force-majeure events may cause changes or interruptions. To the maximum extent permitted by law, we are not responsible for indirect or unforeseeable loss. Nothing limits mandatory consumer rights or liability that law does not permit us to limit.', ka: 'ვცდილობთ ინფორმაციის სიზუსტისა და სერვისის ხელმისაწვდომობის უზრუნველყოფას, თუმცა ტექნიკურმა სამუშაოებმა, კავშირმა, მოედანმა, ამინდმა, მომწოდებელმა, უსაფრთხოებამ ან ფორსმაჟორმა შეიძლება ცვლილება ან შეფერხება გამოიწვიოს. კანონით მაქსიმალურად დასაშვებ ფარგლებში არ ვაგებთ პასუხს არაპირდაპირ ან არაპროგნოზირებად ზიანზე. ეს არ ზღუდავს მომხმარებლის სავალდებულო უფლებებს ან კანონით შეუზღუდავ პასუხისმგებლობას.' }] },
      { title: { en: '9. Changes, termination, law, and complaints', ka: '9. ცვლილებები, შეწყვეტა, სამართალი და საჩივრები' }, paragraphs: [{ en: 'We may update these Terms prospectively and will request renewed acceptance for material changes where appropriate. You may stop using the service and request account closure, subject to records we must retain. Georgian law governs these Terms. Send complaints to the contact below; you may also use any remedy available through the Georgian Competition and Consumer Agency, the State Audit Office of Georgia for data matters, or the courts.', ka: 'შეგვიძლია პირობები სამომავლოდ განვაახლოთ და არსებითი ცვლილებებისას საჭიროებისამებრ ხელახალ თანხმობას მოვითხოვთ. შეგიძლიათ შეწყვიტოთ სერვისის გამოყენება და მოითხოვოთ ანგარიშის დახურვა, იმ ჩანაწერების გარდა, რომელთა შენახვაც გვევალება. პირობებზე ვრცელდება საქართველოს სამართალი. საჩივარი გამოგზავნეთ ქვემოთ მითითებულ კონტაქტზე; ასევე შეგიძლიათ გამოიყენოთ კონკურენციისა და მომხმარებლის დაცვის სააგენტოს, მონაცემთა საკითხებზე სახელმწიფო აუდიტის სამსახურის ან სასამართლოს საშუალებები.' }] },
    ],
  },
  refunds: {
    title: { en: 'Refund & Cancellation Policy', ka: 'თანხის დაბრუნებისა და გაუქმების პოლიტიკა' },
    summary: { en: 'What happens when a team withdraws or an event changes, is postponed, or is cancelled.', ka: 'რა ხდება გუნდის მოხსნისას ან ღონისძიების ცვლილების, გადადების ან გაუქმებისას.' },
    version: REFUND_POLICY_VERSION,
    sections: [
      { title: { en: '1. Before payment', ka: '1. გადახდამდე' }, paragraphs: [{ en: 'Submitting an entry creates an obligation to pay the displayed team fee by the stated deadline, but it does not guarantee acceptance. If an entry is declined before payment, no amount is due. If you transfer funds after being told the entry was declined, contact us promptly with transfer details.', ka: 'განაცხადის გაგზავნა ქმნის მითითებული გუნდის საფასურის დადგენილ ვადაში გადახდის ვალდებულებას, თუმცა მიღებას არ უზრუნველყოფს. თუ განაცხადი გადახდამდე უარყოფილია, თანხა გადასახდელი არ არის. თუ თანხა უარის შეტყობინების შემდეგ გადარიცხეთ, დაუყოვნებლივ მოგვწერეთ გადარიცხვის მონაცემებით.' }] },
      { title: { en: '2. Team withdrawal and no-show', ka: '2. გუნდის მოხსნა და გამოუცხადებლობა' }, items: [
        { en: 'A withdrawal request must be sent from the registered account or email and identify the event and team.', ka: 'მოხსნის მოთხოვნა უნდა გაიგზავნოს რეგისტრირებული ანგარიშიდან ან ელფოსტიდან და მიუთითებდეს ღონისძიებასა და გუნდს.' },
        { en: 'Unless event-specific terms state otherwise, a full refund is available when the organizer receives the request at least 14 calendar days before the event; a 50% refund is available 7–13 days before; and no voluntary-withdrawal refund is due fewer than 7 days before the event.', ka: 'თუ კონკრეტული ღონისძიების პირობები სხვაგვარად არ განსაზღვრავს, სრული დაბრუნება შესაძლებელია ღონისძიებამდე სულ მცირე 14 კალენდარული დღით ადრე მიღებული მოთხოვნისას; 50% — 7–13 დღით ადრე; ხოლო 7 დღეზე ნაკლები ვადისას ნებაყოფლობით მოხსნაზე თანხა არ ბრუნდება.' },
        { en: 'No refund is due for a no-show, late arrival causing forfeiture, disqualification, removal for misconduct, false eligibility information, or breach of tournament rules, except where mandatory law requires otherwise.', ka: 'თანხა არ ბრუნდება გამოუცხადებლობის, დაგვიანებით გამოწვეული ტექნიკური წაგების, დისკვალიფიკაციის, არასათანადო ქცევისთვის მოხსნის, დაშვების შესახებ მცდარი ინფორმაციის ან წესების დარღვევისას, გარდა კანონით სავალდებულო შემთხვევებისა.' },
      ] },
      { title: { en: '3. Cancellation, postponement, and material changes', ka: '3. გაუქმება, გადადება და არსებითი ცვლილება' }, paragraphs: [{ en: 'If the organizer cancels the event and does not provide a replacement date, paid entry fees will be refunded. If the event is postponed or materially changed, we will announce the new arrangement and give affected teams a reasonable deadline to accept it or request a refund. Minor schedule, court, staffing, format, or operational changes made for safety or event delivery do not automatically create a refund right unless they materially deprive the team of the purchased participation.', ka: 'თუ ორგანიზატორი ღონისძიებას გააუქმებს და შემცვლელ თარიღს არ დანიშნავს, გადახდილი საფასური დაბრუნდება. გადადების ან არსებითი ცვლილებისას გამოვაცხადებთ ახალ პირობებს და დაზარალებულ გუნდებს მივცემთ გონივრულ ვადას მისაღებად ან თანხის დასაბრუნებლად. უსაფრთხოების ან ღონისძიების ჩატარებისთვის საჭირო მცირე ცვლილებები განრიგში, კორტში, პერსონალში, ფორმატსა თუ ოპერაციებში ავტომატურად არ წარმოშობს დაბრუნების უფლებას, თუ გუნდი არსებითად არ კარგავს შეძენილ მონაწილეობას.' }] },
      { title: { en: '4. Processing refunds', ka: '4. დაბრუნების დამუშავება' }, paragraphs: [{ en: 'Approved refunds are processed without undue delay after we receive the information reasonably needed to identify the payer and transfer. Because entry fees are paid by bank transfer, we may request the payer name, transfer date, amount, and destination IBAN. We do not ask for online-banking credentials. Bank charges not received by us may be non-refundable. This Policy does not reduce any non-waivable right under Georgian consumer law.', ka: 'დამტკიცებული თანხა ზედმეტი დაყოვნების გარეშე დაბრუნდება მას შემდეგ, რაც გადამხდელისა და გადარიცხვის იდენტიფიცირებისთვის საჭირო გონივრულ ინფორმაციას მივიღებთ. რადგან საფასური საბანკო გადარიცხვით იხდევა, შეიძლება მოვითხოვოთ გადამხდელის სახელი, თარიღი, თანხა და დასაბრუნებელი IBAN. ინტერნეტბანკის მონაცემებს არ ვითხოვთ. ბანკის მიერ დაკავებული და ჩვენთან არჩარიცხული საკომისიო შეიძლება არ დაბრუნდეს. ეს პოლიტიკა არ ამცირებს საქართველოს სამომხმარებლო კანონმდებლობით გაუუქმებელ უფლებებს.' }] },
    ],
  },
  cookies: {
    title: { en: 'Cookie Notice', ka: 'Cookie-ების შესახებ შეტყობინება' },
    summary: { en: 'The small set of cookies used for language, authentication, OAuth, and security.', ka: 'ენისთვის, ავთენტიფიკაციისთვის, OAuth-ისა და უსაფრთხოებისთვის გამოყენებული cookie-ების მცირე ნაკრები.' },
    version: PRIVACY_POLICY_VERSION,
    sections: [
      { title: { en: '1. What cookies are', ka: '1. რა არის cookie' }, paragraphs: [{ en: 'Cookies are small text values stored by a browser. El Padel currently uses only cookies needed to remember language, maintain secure sessions, protect unsafe requests, and complete Google sign-in. We do not currently use advertising cookies or behavioral profiling.', ka: 'Cookie არის ბრაუზერის მიერ შენახული მცირე ტექსტური მნიშვნელობა. El Padel ამჟამად იყენებს მხოლოდ ენის დამახსოვრების, დაცული სესიის, არასაიმედო მოთხოვნების დაცვისა და Google-ით შესვლის დასრულებისთვის საჭირო cookie-ებს. ამჟამად არ ვიყენებთ სარეკლამო cookie-ებს ან ქცევით პროფილირებას.' }] },
      { title: { en: '2. Cookies and local storage we use', ka: '2. გამოყენებული cookie-ები და ლოკალური საცავი' }, items: [
        { en: 'elpadel_session — HTTP-only authentication session; normally up to 7 days.', ka: 'elpadel_session — HTTP-only ავთენტიფიკაციის სესია; ჩვეულებრივ 7 დღემდე.' },
        { en: 'elpadel_oauth_state and elpadel_oauth_legal — short-lived HTTP-only values used to secure Google sign-in and carry sign-up acknowledgement; normally up to 10 minutes.', ka: 'elpadel_oauth_state და elpadel_oauth_legal — Google-ით შესვლის დასაცავად და რეგისტრაციის დადასტურებისთვის გამოყენებული ხანმოკლე HTTP-only მნიშვნელობები; ჩვეულებრივ 10 წუთამდე.' },
        { en: 'elpadel_csrf — a short-lived value used to protect state-changing API requests.', ka: 'elpadel_csrf — მდგომარეობის შემცვლელი API მოთხოვნების დასაცავად გამოყენებული ხანმოკლე მნიშვნელობა.' },
        { en: 'elpadel_locale and matching browser local storage — remembers Georgian or English, normally for up to one year or until cleared.', ka: 'elpadel_locale და შესაბამისი ბრაუზერის ლოკალური საცავი — იმახსოვრებს ქართულ ან ინგლისურ ენას, ჩვეულებრივ ერთ წლამდე ან წაშლამდე.' },
        { en: 'Google may set its own cookies when you choose Google sign-in; Google controls those cookies under its policies.', ka: 'Google-ით შესვლის არჩევისას Google-ს შეუძლია საკუთარი cookie-ების დაყენება; მათ Google თავისი პოლიტიკის შესაბამისად აკონტროლებს.' },
      ] },
      { title: { en: '3. Choices and future analytics', ka: '3. არჩევანი და სამომავლო ანალიტიკა' }, paragraphs: [{ en: 'Essential cookies cannot be disabled through an El Padel preference tool because the requested account and security features depend on them. You can block or clear them in your browser, but sign-in and saved language may stop working. If we add non-essential analytics, advertising, or tracking, we will update this Notice and, where required, ask for consent before activating them.', ka: 'აუცილებელი cookie-ების El Padel-ის პარამეტრებით გამორთვა შეუძლებელია, რადგან მოთხოვნილი ანგარიშისა და უსაფრთხოების ფუნქციები მათზეა დამოკიდებული. მათი დაბლოკვა ან წაშლა შეგიძლიათ ბრაუზერიდან, თუმცა შესვლა და შენახული ენა შეიძლება აღარ იმუშაოს. თუ დავამატებთ არასავალდებულო ანალიტიკას, რეკლამას ან თვალთვალს, განვაახლებთ შეტყობინებას და საჭიროების შემთხვევაში მათ ჩართვამდე თანხმობას მოვითხოვთ.' }] },
    ],
  },
};
