/**
 * Medication Engine — smart medication management for TheSeniorGuru.
 *
 * Responsibilities:
 *  - Drug reference database (name, class, side effects, interactions, notes)
 *  - Interaction checking when a new medication is added
 *  - Inventory deduction + refill trigger (7-day lookahead)
 *  - Refill provider connection (pharmacy / mail-order)
 *  - Groq-powered medication Q&A with full resident context
 */

const { slmAvailable, callSLM } = require("./slm-client");
const { callOpenAI } = require("./ai-client");

// ---------------------------------------------------------------------------
// Drug reference database  (top ~120 medications seniors commonly take)
// Extend by seeding the medication_reference table via /api/admin/medications/seed
// ---------------------------------------------------------------------------

const DRUG_REFERENCE = [
  // Cardiovascular
  { generic: "lisinopril",      brand: ["Prinivil","Zestril"],   class: "ACE Inhibitor",       indication: "Hypertension, Heart Failure", sideEffects: ["dry cough","dizziness","hyperkalemia","angioedema"], renalCaution: true },
  { generic: "amlodipine",      brand: ["Norvasc"],              class: "Calcium Channel Blocker", indication: "Hypertension, Angina", sideEffects: ["ankle swelling","flushing","headache","palpitations"] },
  { generic: "metoprolol",      brand: ["Lopressor","Toprol-XL"],class: "Beta Blocker",        indication: "Hypertension, Angina, Heart Failure", sideEffects: ["fatigue","bradycardia","cold extremities","depression"] },
  { generic: "atorvastatin",    brand: ["Lipitor"],              class: "Statin",              indication: "High Cholesterol", sideEffects: ["muscle pain","liver enzyme elevation","headache"], interactions: ["warfarin","cyclosporine","niacin"] },
  { generic: "rosuvastatin",    brand: ["Crestor"],              class: "Statin",              indication: "High Cholesterol", sideEffects: ["muscle pain","myopathy","headache"], interactions: ["warfarin","cyclosporine"] },
  { generic: "warfarin",        brand: ["Coumadin"],             class: "Anticoagulant",       indication: "Blood Clot Prevention, AFib", sideEffects: ["bleeding","bruising","nausea"], interactions: ["aspirin","ibuprofen","naproxen","atorvastatin","rosuvastatin","amiodarone","fluconazole"], narrowTherapeuticIndex: true },
  { generic: "apixaban",        brand: ["Eliquis"],              class: "Anticoagulant",       indication: "AFib, DVT, PE Prevention", sideEffects: ["bleeding","bruising","anemia"], interactions: ["aspirin","ibuprofen","fluconazole","rifampin"] },
  { generic: "rivaroxaban",     brand: ["Xarelto"],              class: "Anticoagulant",       indication: "AFib, DVT", sideEffects: ["bleeding","nausea","back pain"], interactions: ["ketoconazole","ritonavir","aspirin"] },
  { generic: "amiodarone",      brand: ["Cordarone","Pacerone"], class: "Antiarrhythmic",      indication: "AFib, Ventricular Arrhythmia", sideEffects: ["thyroid dysfunction","photosensitivity","pulmonary toxicity","blue-grey skin"], interactions: ["warfarin","digoxin","statins","beta blockers"], narrowTherapeuticIndex: true },
  { generic: "digoxin",         brand: ["Lanoxin"],              class: "Cardiac Glycoside",   indication: "Heart Failure, AFib", sideEffects: ["nausea","visual disturbances","bradycardia","arrhythmia"], interactions: ["amiodarone","clarithromycin","verapamil"], narrowTherapeuticIndex: true, renalCaution: true },
  { generic: "furosemide",      brand: ["Lasix"],                class: "Loop Diuretic",       indication: "Edema, Heart Failure, Hypertension", sideEffects: ["electrolyte imbalance","dehydration","hearing loss at high doses","gout"] },
  { generic: "spironolactone",  brand: ["Aldactone"],            class: "Potassium-Sparing Diuretic", indication: "Heart Failure, Hypertension", sideEffects: ["hyperkalemia","gynecomastia","menstrual irregularities"], interactions: ["ACE inhibitors","potassium supplements"] },
  { generic: "carvedilol",      brand: ["Coreg"],                class: "Alpha/Beta Blocker",  indication: "Heart Failure, Hypertension", sideEffects: ["dizziness","fatigue","hypotension","bradycardia"] },
  { generic: "losartan",        brand: ["Cozaar"],               class: "ARB",                 indication: "Hypertension, Diabetic Nephropathy", sideEffects: ["dizziness","hyperkalemia","back pain"], renalCaution: true },
  { generic: "valsartan",       brand: ["Diovan"],               class: "ARB",                 indication: "Hypertension, Heart Failure", sideEffects: ["dizziness","fatigue","hyperkalemia"] },
  { generic: "hydralazine",     brand: ["Apresoline"],           class: "Vasodilator",         indication: "Hypertension, Heart Failure", sideEffects: ["headache","tachycardia","lupus-like syndrome","fluid retention"] },
  { generic: "isosorbide mononitrate", brand: ["Imdur"],        class: "Nitrate",             indication: "Angina Prevention", sideEffects: ["headache","dizziness","hypotension"], interactions: ["sildenafil","tadalafil","vardenafil"] },
  { generic: "aspirin",         brand: ["Bayer","Ecotrin"],      class: "Antiplatelet/NSAID",  indication: "Heart Attack Prevention, Pain", sideEffects: ["GI bleeding","bruising","tinnitus"], interactions: ["warfarin","ibuprofen","naproxen","clopidogrel"] },
  { generic: "clopidogrel",     brand: ["Plavix"],               class: "Antiplatelet",        indication: "Heart Attack, Stroke Prevention", sideEffects: ["bleeding","bruising","dyspepsia"], interactions: ["aspirin","omeprazole","warfarin"] },

  // Diabetes
  { generic: "metformin",       brand: ["Glucophage"],           class: "Biguanide",           indication: "Type 2 Diabetes", sideEffects: ["nausea","diarrhea","lactic acidosis (rare)","B12 deficiency"], renalCaution: true },
  { generic: "glipizide",       brand: ["Glucotrol"],            class: "Sulfonylurea",        indication: "Type 2 Diabetes", sideEffects: ["hypoglycemia","weight gain","nausea"] },
  { generic: "glimepiride",     brand: ["Amaryl"],               class: "Sulfonylurea",        indication: "Type 2 Diabetes", sideEffects: ["hypoglycemia","weight gain","dizziness"] },
  { generic: "sitagliptin",     brand: ["Januvia"],              class: "DPP-4 Inhibitor",     indication: "Type 2 Diabetes", sideEffects: ["nasopharyngitis","UTI","pancreatitis (rare)"], renalCaution: true },
  { generic: "empagliflozin",   brand: ["Jardiance"],            class: "SGLT2 Inhibitor",     indication: "Type 2 Diabetes, Heart Failure", sideEffects: ["UTI","genital yeast infection","DKA (rare)","increased urination"] },
  { generic: "liraglutide",     brand: ["Victoza"],              class: "GLP-1 Agonist",       indication: "Type 2 Diabetes, Obesity", sideEffects: ["nausea","vomiting","pancreatitis","thyroid tumors"] },
  { generic: "insulin glargine",brand: ["Lantus","Basaglar"],    class: "Long-Acting Insulin", indication: "Type 1 & 2 Diabetes", sideEffects: ["hypoglycemia","weight gain","injection site reactions"] },

  // Neurological / Mental Health
  { generic: "donepezil",       brand: ["Aricept"],              class: "Cholinesterase Inhibitor", indication: "Alzheimer's Disease", sideEffects: ["nausea","diarrhea","insomnia","bradycardia","muscle cramps"] },
  { generic: "memantine",       brand: ["Namenda"],              class: "NMDA Antagonist",     indication: "Moderate-Severe Alzheimer's", sideEffects: ["dizziness","headache","constipation","confusion"], renalCaution: true },
  { generic: "rivastigmine",    brand: ["Exelon"],               class: "Cholinesterase Inhibitor", indication: "Alzheimer's, Parkinson's Dementia", sideEffects: ["nausea","vomiting","weight loss","dizziness"] },
  { generic: "levodopa/carbidopa", brand: ["Sinemet"],           class: "Dopamine Precursor",  indication: "Parkinson's Disease", sideEffects: ["dyskinesia","nausea","hallucinations","orthostatic hypotension","impulse control disorders"] },
  { generic: "sertraline",      brand: ["Zoloft"],               class: "SSRI",                indication: "Depression, Anxiety, PTSD", sideEffects: ["nausea","insomnia","sexual dysfunction","QT prolongation"], interactions: ["MAOIs","tramadol","linezolid","warfarin"] },
  { generic: "escitalopram",    brand: ["Lexapro"],              class: "SSRI",                indication: "Depression, Anxiety", sideEffects: ["nausea","insomnia","QT prolongation","hyponatremia"], interactions: ["MAOIs","cimetidine","tramadol"] },
  { generic: "duloxetine",      brand: ["Cymbalta"],             class: "SNRI",                indication: "Depression, Anxiety, Neuropathic Pain, Fibromyalgia", sideEffects: ["nausea","dry mouth","insomnia","hypertension","liver toxicity"] },
  { generic: "venlafaxine",     brand: ["Effexor"],              class: "SNRI",                indication: "Depression, Anxiety, Hot Flashes", sideEffects: ["nausea","hypertension","sweating","sexual dysfunction","discontinuation syndrome"] },
  { generic: "mirtazapine",     brand: ["Remeron"],              class: "NaSSA",               indication: "Depression, Insomnia, Appetite", sideEffects: ["sedation","weight gain","dry mouth","dizziness"] },
  { generic: "quetiapine",      brand: ["Seroquel"],             class: "Atypical Antipsychotic", indication: "Bipolar, Schizophrenia, Depression augmentation", sideEffects: ["sedation","weight gain","metabolic syndrome","QT prolongation","tardive dyskinesia"] },
  { generic: "gabapentin",      brand: ["Neurontin"],            class: "Anticonvulsant/Neuropathic", indication: "Neuropathic Pain, Seizures, Restless Legs", sideEffects: ["dizziness","sedation","ataxia","edema","cognitive blunting"], renalCaution: true },
  { generic: "pregabalin",      brand: ["Lyrica"],               class: "Anticonvulsant/Neuropathic", indication: "Neuropathic Pain, Fibromyalgia, Seizures", sideEffects: ["dizziness","sedation","weight gain","edema"], renalCaution: true },
  { generic: "lorazepam",       brand: ["Ativan"],               class: "Benzodiazepine",      indication: "Anxiety, Insomnia, Seizure", sideEffects: ["sedation","confusion","fall risk","dependence","respiratory depression"], beersListCaution: true },
  { generic: "alprazolam",      brand: ["Xanax"],                class: "Benzodiazepine",      indication: "Anxiety, Panic Disorder", sideEffects: ["sedation","confusion","fall risk","dependence"], beersListCaution: true },
  { generic: "zolpidem",        brand: ["Ambien"],               class: "Z-Drug/Sedative",     indication: "Insomnia", sideEffects: ["sleepwalking","memory impairment","hallucinations","next-day impairment","fall risk"], beersListCaution: true },

  // Pain / Musculoskeletal
  { generic: "acetaminophen",   brand: ["Tylenol"],              class: "Analgesic/Antipyretic", indication: "Pain, Fever", sideEffects: ["liver toxicity at high doses"], interactions: ["warfarin","alcohol"] },
  { generic: "ibuprofen",       brand: ["Advil","Motrin"],       class: "NSAID",               indication: "Pain, Inflammation, Fever", sideEffects: ["GI bleeding","renal impairment","cardiovascular risk","hypertension"], interactions: ["warfarin","ACE inhibitors","aspirin","lithium"], beersListCaution: true, renalCaution: true },
  { generic: "naproxen",        brand: ["Aleve","Naprosyn"],     class: "NSAID",               indication: "Pain, Inflammation, Arthritis", sideEffects: ["GI bleeding","renal impairment","cardiovascular risk"], interactions: ["warfarin","aspirin","lithium"], beersListCaution: true },
  { generic: "celecoxib",       brand: ["Celebrex"],             class: "COX-2 Inhibitor",     indication: "Arthritis, Pain", sideEffects: ["cardiovascular risk","GI upset","renal impairment"], interactions: ["warfarin","aspirin","fluconazole"] },
  { generic: "tramadol",        brand: ["Ultram"],               class: "Opioid-like Analgesic", indication: "Moderate Pain", sideEffects: ["nausea","dizziness","seizure risk","serotonin syndrome"], interactions: ["SSRIs","SNRIs","MAOIs","opioids"], beersListCaution: true },
  { generic: "oxycodone",       brand: ["OxyContin","Percocet"], class: "Opioid",              indication: "Moderate-Severe Pain", sideEffects: ["constipation","sedation","respiratory depression","dependence"], beersListCaution: true },
  { generic: "allopurinol",     brand: ["Zyloprim"],             class: "Xanthine Oxidase Inhibitor", indication: "Gout Prevention", sideEffects: ["rash","Stevens-Johnson syndrome (rare)","GI upset"], interactions: ["azathioprine","mercaptopurine","warfarin"], renalCaution: true },
  { generic: "colchicine",      brand: ["Colcrys"],              class: "Anti-inflammatory",   indication: "Gout Attack, Pericarditis", sideEffects: ["diarrhea","nausea","muscle toxicity"], interactions: ["clarithromycin","cyclosporine","statins"], renalCaution: true },
  { generic: "alendronate",     brand: ["Fosamax"],              class: "Bisphosphonate",      indication: "Osteoporosis", sideEffects: ["esophageal irritation","jaw osteonecrosis","atypical femur fracture","GI upset"] },

  // Respiratory
  { generic: "albuterol",       brand: ["ProAir","Ventolin"],    class: "Short-Acting Beta-2 Agonist", indication: "Asthma, COPD", sideEffects: ["tremor","tachycardia","palpitations","hypokalemia"] },
  { generic: "tiotropium",      brand: ["Spiriva"],              class: "Long-Acting Anticholinergic", indication: "COPD", sideEffects: ["dry mouth","constipation","urinary retention","blurred vision"] },
  { generic: "fluticasone",     brand: ["Flovent","Flonase"],    class: "Inhaled/Nasal Corticosteroid", indication: "Asthma, Allergic Rhinitis", sideEffects: ["oral thrush","dysphonia","adrenal suppression (high dose)"] },
  { generic: "montelukast",     brand: ["Singulair"],            class: "Leukotriene Modifier", indication: "Asthma, Allergic Rhinitis", sideEffects: ["neuropsychiatric events","headache","insomnia"] },
  { generic: "prednisone",      brand: ["Deltasone"],            class: "Corticosteroid",      indication: "Inflammation, Autoimmune, Asthma", sideEffects: ["hyperglycemia","osteoporosis","immunosuppression","weight gain","mood changes","cataracts"], interactions: ["warfarin","NSAIDs","diabetes medications"] },

  // GI
  { generic: "omeprazole",      brand: ["Prilosec"],             class: "PPI",                 indication: "GERD, Peptic Ulcer, H. pylori", sideEffects: ["headache","diarrhea","hypomagnesemia","C. diff","B12 deficiency"], interactions: ["clopidogrel","methotrexate"] },
  { generic: "pantoprazole",    brand: ["Protonix"],             class: "PPI",                 indication: "GERD, Peptic Ulcer", sideEffects: ["headache","diarrhea","hypomagnesemia","C. diff"] },
  { generic: "famotidine",      brand: ["Pepcid"],               class: "H2 Blocker",          indication: "GERD, Peptic Ulcer", sideEffects: ["headache","constipation","confusion (in elderly)"], renalCaution: true },
  { generic: "ondansetron",     brand: ["Zofran"],               class: "5-HT3 Antagonist",    indication: "Nausea, Vomiting", sideEffects: ["constipation","headache","QT prolongation"], interactions: ["SSRIs","apomorphine"] },
  { generic: "polyethylene glycol", brand: ["MiraLAX"],          class: "Osmotic Laxative",    indication: "Constipation", sideEffects: ["bloating","nausea","diarrhea"] },
  { generic: "lactulose",       brand: ["Enulose"],              class: "Osmotic Laxative",    indication: "Constipation, Hepatic Encephalopathy", sideEffects: ["bloating","diarrhea","flatulence"] },

  // Endocrine / Other
  { generic: "levothyroxine",   brand: ["Synthroid","Levoxyl"],  class: "Thyroid Hormone",     indication: "Hypothyroidism", sideEffects: ["palpitations","tremor","insomnia (if overdosed)","osteoporosis"], interactions: ["calcium","iron","antacids","warfarin"], narrowTherapeuticIndex: true },
  { generic: "vitamin D3",      brand: ["Cholecalciferol"],      class: "Fat-Soluble Vitamin", indication: "Vitamin D Deficiency, Osteoporosis Prevention", sideEffects: ["hypercalcemia at high doses"] },
  { generic: "calcium carbonate", brand: ["Caltrate","Tums"],    class: "Calcium Supplement/Antacid", indication: "Osteoporosis, Heartburn", sideEffects: ["constipation","kidney stones"], interactions: ["levothyroxine","iron","bisphosphonates"] },
  { generic: "ferrous sulfate", brand: ["Feosol"],               class: "Iron Supplement",     indication: "Iron Deficiency Anemia", sideEffects: ["constipation","dark stools","nausea"], interactions: ["levothyroxine","antacids","calcium","fluoroquinolones"] },
  { generic: "folic acid",      brand: ["Folate"],               class: "B-Vitamin",           indication: "Anemia Prevention, Pregnancy", sideEffects: ["rare at therapeutic doses"] },
  { generic: "potassium chloride", brand: ["Klor-Con","K-Dur"],  class: "Electrolyte",         indication: "Hypokalemia", sideEffects: ["GI irritation","hyperkalemia if overdosed","ulceration"], renalCaution: true },
  { generic: "tamsulosin",      brand: ["Flomax"],               class: "Alpha Blocker",       indication: "BPH", sideEffects: ["orthostatic hypotension","dizziness","retrograde ejaculation"], beersListCaution: true },
  { generic: "finasteride",     brand: ["Proscar","Propecia"],   class: "5-Alpha Reductase Inhibitor", indication: "BPH, Male Pattern Baldness", sideEffects: ["decreased libido","erectile dysfunction","decreased PSA"] },
  { generic: "oxybutynin",      brand: ["Ditropan"],             class: "Anticholinergic",     indication: "Overactive Bladder", sideEffects: ["dry mouth","constipation","cognitive impairment","urinary retention"], beersListCaution: true },
  { generic: "mirabegron",      brand: ["Myrbetriq"],            class: "Beta-3 Agonist",      indication: "Overactive Bladder", sideEffects: ["hypertension","UTI","tachycardia"] },
  { generic: "doxazosin",       brand: ["Cardura"],              class: "Alpha Blocker",       indication: "Hypertension, BPH", sideEffects: ["orthostatic hypotension","dizziness","edema"], beersListCaution: true },

  // Antibiotics (short course but commonly seen)
  { generic: "amoxicillin",     brand: ["Amoxil"],               class: "Penicillin Antibiotic", indication: "Bacterial Infections", sideEffects: ["diarrhea","rash","allergic reaction"] },
  { generic: "azithromycin",    brand: ["Zithromax","Z-Pack"],   class: "Macrolide Antibiotic", indication: "Respiratory Infections, STIs", sideEffects: ["GI upset","QT prolongation","hearing loss (rare)"], interactions: ["warfarin","statins"] },
  { generic: "ciprofloxacin",   brand: ["Cipro"],                class: "Fluoroquinolone",     indication: "UTI, Respiratory, GI Infections", sideEffects: ["tendon rupture","QT prolongation","photosensitivity","CNS effects"], interactions: ["warfarin","antacids","NSAIDs"] },
  { generic: "trimethoprim/sulfamethoxazole", brand: ["Bactrim","Septra"], class: "Sulfonamide", indication: "UTI, MRSA Skin Infection", sideEffects: ["rash","photosensitivity","hyperkalemia","renal impairment"], interactions: ["warfarin","ACE inhibitors","methotrexate"], renalCaution: true },

  // Eye drops (seniors)
  { generic: "latanoprost",     brand: ["Xalatan"],              class: "Prostaglandin Analog Eye Drop", indication: "Glaucoma, Ocular Hypertension", sideEffects: ["iris color change","eyelash growth","eye irritation"] },
  { generic: "timolol eye drops", brand: ["Timoptic"],           class: "Beta Blocker Eye Drop", indication: "Glaucoma", sideEffects: ["bradycardia","bronchospasm (systemic absorption)","hypotension"] },
];

// High-risk interaction pairs (bidirectional)
const CRITICAL_INTERACTION_PAIRS = [
  ["warfarin",    "aspirin",          "HIGH",   "Increased bleeding risk — additive anticoagulant effect"],
  ["warfarin",    "ibuprofen",        "HIGH",   "Increased bleeding risk — NSAIDs inhibit platelet function and raise INR"],
  ["warfarin",    "naproxen",         "HIGH",   "Increased bleeding risk — same as ibuprofen"],
  ["warfarin",    "atorvastatin",     "MODERATE","Statins may increase warfarin effect — monitor INR"],
  ["warfarin",    "amiodarone",       "HIGH",   "Amiodarone inhibits warfarin metabolism — INR can double"],
  ["warfarin",    "fluconazole",      "HIGH",   "Fluconazole significantly raises INR — severe bleeding risk"],
  ["warfarin",    "ciprofloxacin",    "MODERATE","Fluoroquinolones can increase warfarin effect"],
  ["warfarin",    "trimethoprim/sulfamethoxazole", "HIGH", "Bactrim significantly raises INR"],
  ["warfarin",    "acetaminophen",    "MODERATE","Regular high-dose acetaminophen raises INR"],
  ["aspirin",     "ibuprofen",        "MODERATE","Ibuprofen blocks aspirin's antiplatelet effect — take aspirin first"],
  ["aspirin",     "clopidogrel",      "MODERATE","Dual antiplatelet therapy — increases bleeding but may be intentional"],
  ["ssri",        "tramadol",         "HIGH",   "Serotonin syndrome risk — potentially fatal"],
  ["sertraline",  "tramadol",         "HIGH",   "Serotonin syndrome risk"],
  ["escitalopram","tramadol",         "HIGH",   "Serotonin syndrome risk"],
  ["duloxetine",  "tramadol",         "HIGH",   "Serotonin syndrome risk"],
  ["amiodarone",  "digoxin",          "HIGH",   "Amiodarone doubles digoxin levels — severe bradycardia, toxicity"],
  ["amiodarone",  "statins",          "MODERATE","Amiodarone raises statin levels — myopathy risk"],
  ["amiodarone",  "metoprolol",       "MODERATE","Additive bradycardia — heart rate may drop dangerously"],
  ["digoxin",     "clarithromycin",   "HIGH",   "Macrolides increase digoxin absorption — toxicity risk"],
  ["lorazepam",   "oxycodone",        "HIGH",   "CNS + respiratory depression — overdose/death risk"],
  ["alprazolam",  "oxycodone",        "HIGH",   "CNS + respiratory depression — overdose/death risk"],
  ["zolpidem",    "lorazepam",        "MODERATE","Additive CNS depression — fall/sedation risk in elderly"],
  ["levodopa/carbidopa","metoclopramide","HIGH", "Metoclopramide blocks dopamine — worsens Parkinson's symptoms"],
  ["sildenafil",  "isosorbide mononitrate","HIGH","Severe hypotension — can be fatal"],
  ["omeprazole",  "clopidogrel",      "MODERATE","PPI reduces clopidogrel activation — less antiplatelet effect"],
  ["metformin",   "contrast dye",     "HIGH",   "Hold metformin 48h before/after iodinated contrast — lactic acidosis risk"],
  ["ciprofloxacin","warfarin",        "MODERATE","Raises INR — monitor closely"],
  ["prednisone",  "nsaids",           "HIGH",   "Additive GI bleeding risk"],
  ["prednisone",  "diabetes medications","MODERATE","Steroids raise blood sugar — adjust diabetes doses"],
  ["potassium chloride","ACE inhibitors","MODERATE","Hyperkalemia risk — monitor potassium levels"],
  ["potassium chloride","spironolactone","MODERATE","Hyperkalemia risk — potassium-sparing diuretic + supplement"],
  ["calcium carbonate","levothyroxine","MODERATE","Calcium reduces levothyroxine absorption — take 4h apart"],
  ["ferrous sulfate","levothyroxine",  "MODERATE","Iron reduces levothyroxine absorption — take 4h apart"],
  ["colchicine",  "clarithromycin",   "HIGH",   "CYP3A4 inhibition raises colchicine to toxic levels"],
  ["allopurinol", "azathioprine",     "HIGH",   "Allopurinol blocks azathioprine metabolism — severe toxicity"],
  ["gabapentin",  "oxycodone",        "MODERATE","Additive CNS depression — respiratory depression risk"],
  ["tramadol",    "ssri",             "HIGH",   "Serotonin syndrome risk — same as above"],
  ["azithromycin","warfarin",         "MODERATE","May increase INR — monitor"],
];

// Beers Criteria meds flagged for seniors (high fall/cognitive risk)
const BEERS_LIST = new Set([
  "lorazepam","alprazolam","diazepam","clonazepam","temazepam","triazolam",
  "zolpidem","zaleplon","eszopiclone",
  "oxybutynin","tolterodine","solifenacin","darifenacin","fesoterodine",
  "diphenhydramine","chlorpheniramine","hydroxyzine",
  "amitriptyline","imipramine","doxepin","nortriptyline",
  "haloperidol","thioridazine","chlorpromazine",
  "indomethacin","ketorolac","naproxen","ibuprofen",
  "meperidine","pentazocine",
  "doxazosin","prazosin","terazosin","tamsulosin",
  "nifedipine","cyclobenzaprine","carisoprodol","methocarbamol","orphenadrine"
]);

// ---------------------------------------------------------------------------
// Public lookup functions
// ---------------------------------------------------------------------------

function normalizeDrugName(name) {
  return String(name || "").toLowerCase().trim()
    .replace(/\s*(tablet|capsule|mg|mcg|ml|hcl|hydrochloride|sodium|er|xr|sr|xl|cr)\b/gi, "")
    .trim();
}

function lookupDrug(name) {
  const n = normalizeDrugName(name);
  return DRUG_REFERENCE.find(d =>
    d.generic.toLowerCase() === n ||
    d.brand.some(b => b.toLowerCase() === n) ||
    d.generic.toLowerCase().includes(n) ||
    n.includes(d.generic.toLowerCase().split(" ")[0])
  ) || null;
}

function checkInteractions(medicationNames) {
  const names = medicationNames.map(normalizeDrugName);
  const warnings = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      // Check direct name pairs
      const pair = CRITICAL_INTERACTION_PAIRS.find(([x, y]) =>
        (x === a && y === b) || (x === b && y === a) ||
        (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x))
      );
      if (pair) {
        warnings.push({
          drugA: medicationNames[i],
          drugB: medicationNames[j],
          severity: pair[2],
          description: pair[3]
        });
      }
      // Check class-based interactions (e.g. "ssri" class)
      const drugA = lookupDrug(a);
      const drugB = lookupDrug(b);
      if (drugA && drugB) {
        const classPair = CRITICAL_INTERACTION_PAIRS.find(([x, y]) =>
          (drugA.class?.toLowerCase().includes(x) && drugB.generic?.toLowerCase().includes(y)) ||
          (drugB.class?.toLowerCase().includes(x) && drugA.generic?.toLowerCase().includes(y)) ||
          (drugA.class?.toLowerCase().includes(x) && drugB.class?.toLowerCase().includes(y))
        );
        if (classPair && !warnings.find(w => w.drugA === medicationNames[i] && w.drugB === medicationNames[j])) {
          warnings.push({
            drugA: medicationNames[i],
            drugB: medicationNames[j],
            severity: classPair[2],
            description: classPair[3]
          });
        }
        // Check interaction lists on individual drug records
        if (drugA.interactions?.some(x => b.includes(x) || (drugB.generic && drugB.generic.includes(x)))) {
          if (!warnings.find(w => w.drugA === medicationNames[i] && w.drugB === medicationNames[j])) {
            warnings.push({
              drugA: medicationNames[i],
              drugB: medicationNames[j],
              severity: "MODERATE",
              description: `${drugA.generic} has a known interaction with ${drugB.generic}. Review with prescriber.`
            });
          }
        }
      }
    }
  }
  return warnings;
}

function getBeersCaution(medicationName) {
  const n = normalizeDrugName(medicationName);
  const inList = BEERS_LIST.has(n) || [...BEERS_LIST].some(b => n.includes(b) || b.includes(n.split(" ")[0]));
  const drug = lookupDrug(medicationName);
  return inList || drug?.beersListCaution === true;
}

// ---------------------------------------------------------------------------
// Inventory / refill logic
// ---------------------------------------------------------------------------

/**
 * Calculate days of supply remaining based on frequency and current count.
 */
function daysOfSupplyRemaining(remainingCount, frequency) {
  const f = String(frequency || "Once daily").toLowerCase();
  let dosesPerDay = 1;
  if (f.includes("twice") || f.includes("2x") || f.includes("bid")) dosesPerDay = 2;
  else if (f.includes("three") || f.includes("3x") || f.includes("tid")) dosesPerDay = 3;
  else if (f.includes("four") || f.includes("4x") || f.includes("qid")) dosesPerDay = 4;
  else if (f.includes("every other") || f.includes("alt")) dosesPerDay = 0.5;
  else if (f.includes("weekly") || f.includes("once a week")) dosesPerDay = 1 / 7;
  return dosesPerDay > 0 ? Math.floor(Number(remainingCount) / dosesPerDay) : 999;
}

function refillNeeded(remainingCount, frequency, refillThresholdDays = 7) {
  return daysOfSupplyRemaining(remainingCount, frequency) <= refillThresholdDays;
}

// ---------------------------------------------------------------------------
// AI-powered medication Q&A
// ---------------------------------------------------------------------------

function buildMedicationSystemPrompt(residentMedications = [], residentName = null) {
  const lines = [
    "You are MedGuru, a knowledgeable senior medication assistant inside TheSeniorGuru.",
    "Answer questions about medications clearly and in plain English.",
    "Always recommend confirming with a doctor or pharmacist before making changes.",
    "Flag serious drug interactions immediately.",
    "Never recommend stopping a prescription without physician guidance.",
    "Keep answers to 2-4 sentences unless a list is clearly needed."
  ];
  if (residentName) lines.push(`You are speaking with ${residentName}.`);
  if (residentMedications.length) {
    const medList = residentMedications.map(m => `${m.name}${m.strength ? " " + m.strength : ""}${m.frequency ? " (" + m.frequency + ")" : ""}`).join(", ");
    lines.push(`Their current medications: ${medList}.`);
    const allNames = residentMedications.map(m => m.name);
    const interactions = checkInteractions(allNames);
    if (interactions.length) {
      lines.push(`KNOWN INTERACTIONS ON FILE: ${interactions.map(w => `${w.drugA} + ${w.drugB}: ${w.severity} — ${w.description}`).join("; ")}`);
    }
  }
  return lines.join("\n");
}

async function askMedicationQuestion(message, residentMedications = [], residentName = null) {
  const system = buildMedicationSystemPrompt(residentMedications, residentName);
  const on = await slmAvailable();
  if (on) {
    try {
      return await callSLM({ system, messages: [{ role: "user", content: String(message).slice(0, 600) }], temperature: 0.3, maxTokens: 250 });
    } catch {}
  }
  // OpenAI fallback
  try {
    return await callOpenAI({ system, messages: [{ role: "user", content: message }], temperature: 0.3 });
  } catch (e) {
    return { provider: "local", text: "I can't answer right now. Please speak with your pharmacist or doctor.", error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  DRUG_REFERENCE,
  lookupDrug,
  checkInteractions,
  getBeersCaution,
  daysOfSupplyRemaining,
  refillNeeded,
  askMedicationQuestion,
  buildMedicationSystemPrompt
};
