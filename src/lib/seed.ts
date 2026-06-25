import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/healthcare";
const DB_NAME = "healthcare";

const categories = [
  { slug: "cancer", name: "Cancer", icon: "🩺", description: "Learn about different types of cancer, their causes, stages, treatments, and prevention strategies." },
  { slug: "heart-diseases", name: "Heart Diseases", icon: "❤️", description: "Information on cardiovascular conditions, heart attacks, prevention, and heart-healthy lifestyles." },
  { slug: "diabetes", name: "Diabetes", icon: "🍬", description: "Understanding Type 1, Type 2, and Gestational diabetes, management plans, and blood sugar tracking." },
  { slug: "respiratory-diseases", name: "Respiratory Diseases", icon: "🫁", description: "Insights into conditions affecting the lungs and airways, from asthma to chronic obstructive pulmonary disease." },
  { slug: "infectious-diseases", name: "Infectious Diseases", icon: "🦠", description: "Details on viral, bacterial, and parasitic infections, transmission routes, vaccinations, and cures." },
  { slug: "neurological-disorders", name: "Neurological Disorders", icon: "🧠", description: "Understanding brain and nervous system disorders like Alzheimer's, Parkinson's, and epilepsy." },
  { slug: "mental-health", name: "Mental Health", icon: "🧑‍⚕️", description: "Articles covering depression, anxiety, therapy options, and supporting mental well-being." },
  { slug: "skin-diseases", name: "Skin Diseases", icon: "🩹", description: "Guides on eczema, psoriasis, acne, dermatological conditions, and skin care tips." },
  { slug: "kidney-diseases", name: "Kidney Diseases", icon: "💧", description: "Information on renal health, chronic kidney disease, kidney stones, and dialysis." },
  { slug: "digestive-diseases", name: "Digestive Diseases", icon: "🥝", description: "Understanding gut health, IBS, GERD, Crohn's disease, and nutritional guidelines." },
  { slug: "eye-diseases", name: "Eye Diseases", icon: "👁", description: "Guides on vision health, cataracts, glaucoma, and protecting your eyesight." },
  { slug: "bone-joint-diseases", name: "Bone & Joint Diseases", icon: "🦴", description: "Insights into skeletal and joint health, osteoporosis, arthritis, and physical therapy." },
  { slug: "blood-disorders", name: "Blood Disorders", icon: "🩸", description: "Understanding anemia, hemophilia, blood cell disorders, and blood bank guidelines." },
  { slug: "autoimmune-diseases", name: "Autoimmune Diseases", icon: "🧬", description: "Information on conditions where the immune system attacks body tissues, like lupus." },
  { slug: "rare-diseases", name: "Rare Diseases", icon: "🌌", description: "Resources on orphan diseases, rare genetic disorders, research, and support groups." }
];

// Helper to generate a disease article
function createDisease(name: string, slug: string, catSlugs: string[], overview: string, symptoms: string[], causes: string[], riskFactors: string[], diagnosis: string, treatments: string[], prevention: string, faq: { q: string, a: string }[], related: string[]) {
  return {
    name,
    slug,
    categories: catSlugs,
    overview,
    symptoms,
    causes,
    riskFactors,
    diagnosis,
    treatmentOptions: treatments,
    prevention,
    faq,
    references: [
      "World Health Organization (WHO) Guidelines & Reports",
      "Mayo Clinic Medical Information Database",
      "National Institutes of Health (NIH) Clinical Resources"
    ],
    relatedDiseases: related
  };
}

// Generate 105 diseases (7 per category)
const diseases = [
  // --- CANCER (7) ---
  createDisease("Lung Cancer", "lung-cancer", ["cancer"],
    "Lung cancer is a type of cancer that begins in the lungs. Your lungs are two spongy organs in your chest that take in oxygen when you inhale and release carbon dioxide when you exhale. Lung cancer is the leading cause of cancer deaths worldwide.",
    ["Persistent cough that doesn't go away", "Coughing up blood, even a small amount", "Shortness of breath", "Chest pain", "Hoarseness", "Unexplained weight loss"],
    ["Cigarette smoking is the leading cause of lung cancer", "Exposure to secondhand smoke", "Inhalation of radon gas, asbestos, and other carcinogens", "Genetic mutations and family history of lung cancer"],
    ["Active smoking", "Exposure to secondhand smoke", "Previous radiation therapy", "Exposure to radon gas or asbestos", "Family history of lung cancer"],
    "Diagnosed using chest X-rays, CT scans, sputum cytology (examining mucus under a microscope), and lung tissue biopsy.",
    ["Surgery to remove the tumor or lung section", "Chemotherapy to kill cancer cells", "Radiation therapy using high-energy beams", "Targeted drug therapy and immunotherapy"],
    "Avoid smoking, test your home for radon, avoid secondhand smoke, wear protective gear in hazardous workplaces, and eat a diet full of fruits and vegetables.",
    [
      { q: "Is lung cancer always caused by smoking?", a: "No. While smoking is the primary cause, non-smokers can also develop lung cancer due to radon gas, air pollution, secondhand smoke, or genetics." },
      { q: "Can lung cancer be cured if detected early?", a: "Yes. Early-stage lung cancer can often be successfully treated and cured with surgery or localized therapies." }
    ], ["copd", "asthma", "bronchitis"]),

  createDisease("Breast Cancer", "breast-cancer", ["cancer"],
    "Breast cancer is a cancer that forms in the cells of the breasts. It can occur in both men and women, but it is far more common in women. Substantial support for breast cancer awareness and research funding has helped create advances in the diagnosis and treatment.",
    ["A breast lump or thickening that feels different from surrounding tissue", "Change in the size, shape or appearance of a breast", "Changes to the skin over the breast, such as dimpling", "A newly inverted nipple", "Peeling, scaling, crusting or flaking of breast skin"],
    ["Abnormal cell division in breast tissue", "Genetic mutations in BRCA1 and BRCA2 genes", "Hormonal factors and lifestyle influences"],
    ["Female gender", "Increasing age", "Personal or family history of breast conditions", "Inherited genes that increase cancer risk", "Radiation exposure", "Obesity"],
    "Diagnosed using breast exams, mammograms, breast ultrasound, breast MRI, and biopsy of breast tissue.",
    ["Breast surgery (lumpectomy or mastectomy)", "Radiation therapy", "Chemotherapy", "Hormone blocking therapy", "Targeted therapy"],
    "Limit alcohol intake, maintain a healthy weight, be physically active, practice breast self-awareness, and schedule regular mammograms.",
    [
      { q: "Can men get breast cancer?", a: "Yes. Although rare, men have breast tissue and can develop breast cancer, which usually presents as a firm lump behind the nipple." },
      { q: "What is a mammogram?", a: "A mammogram is a low-dose X-ray of the breast used to detect early signs of breast cancer before symptoms develop." }
    ], ["ovarian-cancer", "melanoma"]),

  createDisease("Prostate Cancer", "prostate-cancer", ["cancer"],
    "Prostate cancer is cancer that occurs in the prostate — a small walnut-shaped gland in men that produces the seminal fluid that nourishes and transports sperm. It is one of the most common types of cancer in men.",
    ["Trouble urinating", "Decreased force in the stream of urine", "Blood in the urine or semen", "Bone pain", "Losing weight without trying", "Erectile dysfunction"],
    ["Changes in the DNA of prostate cells leading to rapid cell growth", "Inherited genetic mutations", "Hormonal imbalances"],
    ["Older age (usually over 50)", "Black race (higher risk and severity)", "Family history of prostate or breast cancer", "Obesity"],
    "Diagnosed through Prostate-Specific Antigen (PSA) blood tests, Digital Rectal Exam (DRE), and ultrasound-guided prostate needle biopsy.",
    ["Active surveillance (watchful waiting)", "Surgery to remove the prostate (prostatectomy)", "Radiation therapy", "Hormone therapy to reduce testosterone", "Chemotherapy"],
    "Choose a healthy diet rich in fruits, vegetables, and whole grains, exercise regularly, maintain a healthy weight, and discuss PSA screening with your doctor.",
    [
      { q: "Is prostate cancer slow-growing?", a: "Many prostate cancers grow slowly and remain confined to the prostate gland, where they may not cause serious harm, but some types are aggressive." },
      { q: "At what age should prostate screening begin?", a: "Men at average risk should discuss screening with their doctor at age 50. High-risk men (black men or those with family history) should start discussions at age 45." }
    ], ["kidney-stones", "chronic-kidney-disease"]),

  createDisease("Colorectal Cancer", "colorectal-cancer", ["cancer"],
    "Colorectal cancer is a disease in which cells in the colon or rectum grow out of control. It is sometimes called colon cancer for short. The colon is the large intestine and the rectum is the channel that connects the colon to the anus.",
    ["A persistent change in bowel habits (diarrhea or constipation)", "Rectal bleeding or blood in your stool", "Persistent abdominal discomfort (cramps, gas, pain)", "A feeling that your bowel doesn't empty completely", "Weakness or fatigue"],
    ["Development of adenomatous polyps in the colon lining", "Acquired DNA mutations in colon cells", "Chronic inflammatory diseases of the colon"],
    ["Older age", "Personal history of colorectal cancer or polyps", "Inflammatory bowel conditions (Crohn's, colitis)", "Inherited syndromes", "Low-fiber, high-fat diet", "Sedentary lifestyle"],
    "Diagnosed via colonoscopy, fecal occult blood test, CT colonography, and biopsy of polyps.",
    ["Surgical removal of tumor and affected colon segment (colectomy)", "Chemotherapy", "Radiation therapy", "Targeted drug therapy", "Immunotherapy"],
    "Undergo regular colorectal cancer screening starting at age 45, eat a high-fiber diet, limit red and processed meat, exercise, and avoid smoking.",
    [
      { q: "How often should one get a colonoscopy?", a: "For individuals at average risk, a screening colonoscopy is recommended every 10 years starting at age 45." },
      { q: "Are colon polyps always cancerous?", a: "No. Most polyps are benign, but some types (adenomas) can slowly develop into cancer over several years." }
    ], ["crohns-disease", "ulcerative-colitis", "ibs"]),

  createDisease("Leukemia", "leukemia", ["cancer", "blood-disorders"],
    "Leukemia is cancer of the body's blood-forming tissues, including the bone marrow and the lymphatic system. Many types of leukemia exist. Some forms of leukemia are more common in children, while other forms occur mostly in adults.",
    ["Fever or chills", "Persistent fatigue or weakness", "Frequent or severe infections", "Losing weight without trying", "Swollen lymph nodes, enlarged liver or spleen", "Easy bleeding or bruising (nosebleeds, red spots)"],
    ["Acquired mutations in the DNA of white blood cells causing them to remain immature and multiply uncontrollably", "Exposure to radiation or certain chemicals like benzene", "Genetic factors"],
    ["Previous cancer treatment", "Genetic disorders (e.g., Down syndrome)", "Exposure to certain chemicals", "Smoking", "Family history of leukemia"],
    "Diagnosed using complete blood counts (CBC), peripheral blood smears, bone marrow aspiration, and biopsy.",
    ["Chemotherapy (primary treatment)", "Targeted drug therapy", "Radiation therapy", "Bone marrow / stem cell transplant", "Immunotherapy"],
    "While most cases cannot be prevented, avoiding high doses of radiation, exposure to benzene, and smoking can reduce risk.",
    [
      { q: "What is the difference between acute and chronic leukemia?", a: "Acute leukemia involves rapid growth of immature blood cells and requires immediate treatment, whereas chronic leukemia progresses slowly over years." },
      { q: "Is leukemia curable?", a: "Yes. Many types of leukemia, particularly childhood leukemia, have high cure rates with modern chemotherapy and stem cell transplants." }
    ], ["thalassemia", "iron-deficiency-anemia"]),

  createDisease("Melanoma", "melanoma", ["cancer", "skin-diseases"],
    "Melanoma, the most serious type of skin cancer, develops in the cells (melanocytes) that produce melanin — the pigment that gives your skin its color. Melanoma can also form in your eyes and, rarely, inside your body, such as in your nose or throat.",
    ["A change in an existing mole", "The development of a new pigment or unusual-looking growth on your skin", "Asymmetry in moles", "Border irregularity", "Color variations", "Diameter larger than 6mm", "Evolving size, shape or color"],
    ["Damage to skin cells caused by ultraviolet (UV) radiation from sunshine or tanning beds", "Genetic mutations in skin pigment cells"],
    ["Fair skin, light hair, and freckles", "History of sunburns", "Excessive ultraviolet (UV) light exposure", "Living close to the equator or at high altitude", "Having many moles", "Family history of melanoma"],
    "Diagnosed through visual skin checks, dermoscopy, and excisional skin biopsy of the suspicious lesion.",
    ["Surgical excision of the melanoma and some healthy surrounding tissue", "Sentinel lymph node biopsy", "Immunotherapy", "Targeted therapy", "Chemotherapy or radiation"],
    "Avoid the sun during the middle of the day, wear sunscreen year-round, wear protective clothing, avoid tanning beds, and check your skin regularly.",
    [
      { q: "What is the ABCDE rule for skin cancer?", a: "It stands for Asymmetry, Border irregularity, Color changes, Diameter (>6mm), and Evolving size/shape. These help identify abnormal moles." },
      { q: "Can melanoma spread to other organs?", a: "Yes. If left untreated, melanoma is highly aggressive and can spread (metastasize) to the lymph nodes, lungs, liver, and brain." }
    ], ["psoriasis", "eczema", "acne-vulgaris"]),

  createDisease("Pancreatic Cancer", "pancreatic-cancer", ["cancer"],
    "Pancreatic cancer begins in the tissues of your pancreas — an organ in your abdomen that lies horizontally behind the lower part of your stomach. Your pancreas secretes enzymes that aid digestion and hormones that help manage your blood sugar. It is often diagnosed at late stages.",
    ["Pain in the upper abdomen that radiates to your back", "Loss of appetite or unintended weight loss", "Yellowing of your skin and the whites of your eyes (jaundice)", "Light-colored stools", "Dark-colored urine", "New-onset diabetes"],
    ["Genetic mutations in pancreatic cells leading to uncontrolled growth", "Chronic inflammation of the pancreas (pancreatitis)"],
    ["Chronic pancreatitis", "Diabetes", "Family history of pancreatic cancer or genetic syndromes (BRCA2, Lynch syndrome)", "Smoking", "Obesity", "Older age"],
    "Diagnosed using ultrasound, CT scans, MRI, endoscopic ultrasound (EUS) with biopsy, and CA 19-9 tumor marker blood tests.",
    ["Surgery (Whipple procedure or distal pancreatectomy)", "Chemotherapy", "Radiation therapy", "Palliative care to manage pain and symptoms"],
    "Stop smoking, maintain a healthy weight, choose a healthy diet, and limit alcohol consumption to reduce the risk of pancreatitis.",
    [
      { q: "Why is pancreatic cancer so hard to detect early?", a: "The pancreas is deep inside the abdomen, symptoms are silent or mimic other diseases, and there are currently no standard screening tools for early detection in average-risk people." },
      { q: "What is the Whipple procedure?", a: "It is a complex surgery that removes the head of the pancreas, part of the small intestine, the gallbladder, and part of the bile duct." }
    ], ["type-2-diabetes", "gallstones"]),

  // --- HEART DISEASES (7) ---
  createDisease("Coronary Artery Disease", "coronary-artery-disease", ["heart-diseases"],
    "Coronary artery disease (CAD) is a common heart condition that affects the major blood vessels supplying the heart muscle. Cholesterol deposits (plaque) in the heart arteries and inflammation are usually to blame for coronary artery disease.",
    ["Angina (chest pain, pressure or tightness)", "Shortness of breath", "Fatigue during exercise", "Heart attack in severe blockages"],
    ["Build-up of fatty deposits (atherosclerosis) in the coronary arteries", "Injury or inflammation of the artery inner lining"],
    ["Smoking", "High blood pressure (hypertension)", "High cholesterol", "Sedentary lifestyle", "Diabetes", "Family history of heart disease"],
    "Diagnosed using electrocardiograms (ECG), echocardiograms, stress tests, cardiac catheterization (angiogram), and coronary CT scans.",
    ["Lifestyle modifications (diet, exercise)", "Medications (cholesterol-lowering statins, beta-blockers, aspirin)", "Angioplasty and stent placement", "Coronary artery bypass graft surgery (CABG)"],
    "Quit smoking, manage blood pressure and cholesterol, exercise regularly, eat a low-sodium, heart-healthy diet, and manage stress.",
    [
      { q: "What is atherosclerosis?", a: "It is the narrowing and hardening of arteries due to the build-up of cholesterol plaques on their inner walls." },
      { q: "Is chest pain the only sign of CAD?", a: "No. Shortness of breath, fatigue, and pain radiating to the jaw, neck, or arm can also indicate coronary artery issues." }
    ], ["heart-attack", "heart-failure", "hypertension"]),

  createDisease("Heart Attack", "heart-attack", ["heart-diseases"],
    "A heart attack (myocardial infarction) happens when the flow of oxygen-rich blood to a section of heart muscle suddenly becomes blocked, and the heart can't get oxygen. If blood flow isn't restored quickly, the section of heart muscle begins to die. It is a medical emergency.",
    ["Pressure, tightness, pain, or a squeezing sensation in your chest or arms", "Pain that spreads to your jaw, back, neck, or stomach", "Cold sweat", "Fatigue", "Lightheadedness or sudden dizziness", "Shortness of breath"],
    ["Rupture of a plaque in a coronary artery, leading to a blood clot that completely blocks blood flow to the heart muscle"],
    ["Smoking", "Age (men 45+, women 55+)", "Hypertension", "High cholesterol", "Obesity", "Lack of physical activity", "Diabetes"],
    "Diagnosed instantly using an electrocardiogram (ECG/EKG) and blood tests for cardiac enzymes (Troponin).",
    ["Emergency medications (aspirin, thrombolytics, blood thinners)", "Coronary angioplasty and stenting (performed in a cath lab)", "Bypass surgery (CABG)", "Cardiac rehabilitation"],
    "Monitor cardiovascular health, manage chronic conditions, eat a heart-healthy diet, exercise regularly, and seek emergency help immediately if symptoms arise.",
    [
      { q: "What is the difference between cardiac arrest and a heart attack?", a: "A heart attack is a 'plumbing' issue caused by blocked blood flow, whereas cardiac arrest is an 'electrical' issue causing the heart to suddenly stop beating." },
      { q: "Can women experience different heart attack symptoms?", a: "Yes. Women are more likely to experience shortness of breath, nausea, back or jaw pain without classic severe chest pressure." }
    ], ["coronary-artery-disease", "heart-failure", "arrhythmia"]),

  createDisease("Heart Failure", "heart-failure", ["heart-diseases"],
    "Heart failure, sometimes known as congestive heart failure, occurs when the heart muscle doesn't pump blood as well as it should. When this happens, blood often backs up and fluid can build up in the lungs and in the legs, causing shortness of breath and swelling.",
    ["Shortness of breath (dyspnea) when you exert yourself or lie down", "Fatigue and weakness", "Swelling (edema) in your legs, ankles, and feet", "Rapid or irregular heartbeat", "Persistent cough or wheezing with white or pink phlegm"],
    ["Usually caused by other conditions that have damaged or weakened the heart, such as coronary artery disease, heart attacks, high blood pressure, or cardiomyopathy."],
    ["Coronary artery disease", "High blood pressure", "Diabetes", "Certain medications", "Sleep apnea", "Congenital heart defects", "Viral infections"],
    "Diagnosed through echocardiogram (key test for ejection fraction), ECG, chest X-ray, BNP blood tests, and cardiac MRI.",
    ["Medications (ACE inhibitors, beta-blockers, diuretics)", "Implantable devices (pacemakers, ICDs)", "Heart transplant or Left Ventricular Assist Device (LVAD) for advanced stages"],
    "Maintain a low-salt diet, exercise regularly, limit fluid intake as advised, avoid alcohol and smoking, and closely monitor daily weight for fluid retention.",
    [
      { q: "Does heart failure mean the heart has stopped working?", a: "No. It means the heart's pumping power is weaker than normal, not that the heart has stopped." },
      { q: "Why is tracking daily weight important in heart failure?", a: "A sudden weight gain (e.g., 2-3 pounds in a day) usually indicates fluid retention, warning of worsening heart failure before symptoms become severe." }
    ], ["coronary-artery-disease", "heart-attack", "hypertension"]),

  createDisease("Arrhythmia", "arrhythmia", ["heart-diseases"],
    "Heart arrhythmia is an irregular heartbeat. Heart rhythm problems occur when the electrical signals that coordinate the heart's beats don't work properly. The faulty signaling causes the heart to beat too fast (tachycardia), too slow (bradycardia) or irregularly.",
    ["A fluttering in your chest", "A racing heartbeat (tachycardia)", "A slow heartbeat (bradycardia)", "Chest pain", "Shortness of breath", "Lightheadedness, dizziness, or fainting"],
    ["Disruption in the electrical conduction pathways of the heart", "Scars from a previous heart attack", "Electrolyte imbalances in the blood", "Changes in heart muscle structure"],
    ["Coronary artery disease", "High blood pressure", "Thyroid problems (hyperthyroidism or hypothyroidism)", "Caffeine, nicotine, or alcohol abuse", "Stress"],
    "Diagnosed with ECG, Holter monitors (portable ECG worn for 24-48 hours), event recorders, echocardiogram, and electrophysiological study (EPS).",
    ["Medications (anti-arrhythmics, beta-blockers)", "Cardioversion (electrical shock to reset rhythm)", "Catheter ablation to scar tissue causing faulty signals", "Pacemaker or Implantable Cardioverter-Defibrillator (ICD)"],
    "Reduce intake of stimulants (caffeine, nicotine), manage stress, maintain a healthy lifestyle, and treat underlying thyroid or heart disorders.",
    [
      { q: "What is Atrial Fibrillation (AFib)?", a: "AFib is a common, irregular, and often rapid heart rhythm that can increase the risk of stroke, blood clots, and heart failure." },
      { q: "Is a skipped heartbeat normal?", a: "Occasional extra beats (premature contractions) are common and usually harmless, but persistent irregularity should be evaluated by a cardiologist." }
    ], ["heart-attack", "stroke"]),

  createDisease("Hypertension", "hypertension", ["heart-diseases"],
    "Hypertension, also known as high blood pressure, is a common condition in which the long-term force of the blood against your artery walls is high enough that it may eventually cause health problems, such as heart disease and stroke.",
    ["Most people have no symptoms (referred to as the 'silent killer')", "Severe cases may cause headaches, shortness of breath, nosebleeds, or double vision"],
    ["Primary hypertension has no identifiable cause and develops gradually over years", "Secondary hypertension is caused by underlying conditions (kidney disease, thyroid problems, medications)"],
    ["Older age", "Family history of high blood pressure", "Being overweight", "Not being physically active", "Using tobacco", "Too much salt and too little potassium in the diet"],
    "Diagnosed by regular blood pressure measurements using an inflatable arm cuff (sphygmomanometer). Hypertension is defined as 130/80 mmHg or higher.",
    ["Lifestyle modifications (DASH diet, weight loss, exercise)", "Medications (diuretics, ACE inhibitors, calcium channel blockers, beta-blockers)"],
    "Reduce salt intake, eat more potassium-rich foods, exercise regularly, limit alcohol, avoid smoking, and maintain a healthy weight.",
    [
      { q: "What do the two numbers in a blood pressure reading mean?", a: "The top number (systolic) measures pressure when the heart beats. The bottom number (diastolic) measures pressure when the heart rests between beats." },
      { q: "Why is high blood pressure called a silent killer?", a: "Because it rarely causes symptoms but quietly damages blood vessels, increasing the risk of stroke, heart attack, and kidney failure over time." }
    ], ["coronary-artery-disease", "stroke", "chronic-kidney-disease"]),

  createDisease("Congenital Heart Defects", "congenital-heart-defects", ["heart-diseases", "rare-diseases"],
    "A congenital heart defect is a problem with the structure of the heart that is present at birth. Congenital heart defects can change the way blood flows through the heart, ranging from simple defects with no symptoms to complex, life-threatening conditions.",
    ["Pale gray or blue skin color (cyanosis) in infants", "Rapid breathing", "Swelling in the legs, abdomen, or around the eyes", "Shortness of breath during feedings, leading to poor weight gain in babies"],
    ["Faulty development of the heart structure during fetal growth", "Genetic conditions (like Down syndrome)", "Maternal health factors during pregnancy (rubella, diabetes, drug exposure)"],
    ["Maternal rubella infection during pregnancy", "Maternal diabetes", "Taking certain medications or alcohol during pregnancy", "Heredity and genetic syndromes"],
    "Often detected during pregnancy via fetal echocardiogram, or diagnosed after birth using pulse oximetry screening, echocardiograms, chest X-rays, and cardiac catheterization.",
    ["Monitoring in mild cases", "Catheter procedures to close holes or widen valves", "Open-heart surgery to repair structure", "Heart transplant in extreme cases"],
    "Take maternal vitamins (folic acid), avoid alcohol and drugs during pregnancy, control blood sugar before and during pregnancy, and ensure rubella vaccination is up to date.",
    [
      { q: "Can a congenital heart defect go unnoticed until adulthood?", a: "Yes. Some minor defects, like a small Atrial Septal Defect (ASD), may not cause symptoms and might only be found during routine exams later in life." },
      { q: "What is cyanotic heart disease?", a: "It refers to defects that cause oxygen-poor blood to bypass the lungs and go directly to the body, causing a bluish tint to the skin due to low oxygen levels." }
    ], ["heart-failure", "arrhythmia"]),

  createDisease("Valvular Heart Disease", "valvular-heart-disease", ["heart-diseases"],
    "Valvular heart disease occurs when one or more of the heart's four valves (mitral, tricuspid, aortic, pulmonary) do not work properly. Valves keep blood flowing in the correct direction. Defects include stenosis (narrowing) or regurgitation (leakage).",
    ["Heart murmur heard through a stethoscope", "Shortness of breath, especially when active or lying down", "Fatigue and weakness", "Swollen ankles and feet", "Dizziness or fainting"],
    ["Congenital valve defects", "Rheumatic fever (from untreated strep throat)", "Age-related degeneration and calcium build-up on the valves", "Infective endocarditis (infection of the heart valves)"],
    ["Older age", "History of infective endocarditis", "History of rheumatic fever", "High blood pressure and high cholesterol"],
    "Diagnosed primarily using an echocardiogram, along with ECG, chest X-ray, and cardiac catheterization.",
    ["Medications to manage symptoms (diuretics, blood thinners)", "Surgical valve repair (e.g., balloon valvuloplasty)", "Surgical valve replacement (using mechanical or tissue valves)", "Transcatheter Aortic Valve Replacement (TAVR)"],
    "Treat strep throat infections promptly to prevent rheumatic fever, practice good dental hygiene to prevent endocarditis, and control blood pressure.",
    [
      { q: "What is the difference between stenosis and regurgitation?", a: "Stenosis is when a valve cannot open fully, blocking blood flow. Regurgitation is when a valve leaks, letting blood flow backward." },
      { q: "What is a mechanical heart valve?", a: "It is an artificial valve made of carbon and metal. It is durable but requires the patient to take lifelong blood thinners to prevent clots." }
    ], ["heart-failure", "stroke"]),

  // --- DIABETES (7) ---
  createDisease("Type 1 Diabetes", "type-1-diabetes", ["diabetes", "autoimmune-diseases"],
    "Type 1 diabetes, once known as juvenile diabetes or insulin-dependent diabetes, is a chronic condition in which the pancreas produces little or no insulin. Insulin is a hormone needed to allow sugar (glucose) to enter cells to produce energy.",
    ["Increased thirst (polydipsia)", "Frequent urination (polyuria)", "Extreme hunger (polyphagia)", "Unintended weight loss", "Fatigue and weakness", "Blurred vision"],
    ["An autoimmune reaction where the body's immune system mistakenly attacks and destroys insulin-producing beta cells in the islets of Langerhans in the pancreas."],
    ["Family history of Type 1 diabetes", "Geography (higher incidence away from the equator)", "Exposure to certain viruses (mumps, Coxsackie B)"],
    "Diagnosed via Glycated Hemoglobin (A1C) tests, Random Blood Sugar tests, Fasting Blood Sugar tests, and antibody tests to confirm autoimmune markers.",
    ["Lifelong daily insulin therapy (injections or an insulin pump)", "Frequent blood sugar monitoring", "Carbohydrate counting and healthy diet", "Regular exercise"],
    "Currently, there is no known way to prevent Type 1 diabetes. Research into vaccines and immune therapies is ongoing.",
    [
      { q: "Can Type 1 diabetes be cured with diet and exercise?", a: "No. Type 1 diabetes is an autoimmune disease where the pancreas cannot produce insulin. Diet and exercise help manage blood sugars, but daily insulin is essential for survival." },
      { q: "What is Diabetic Ketoacidosis (DKA)?", a: "DKA is a life-threatening complication of diabetes that occurs when the body runs out of insulin, causing it to break down fats for energy, producing toxic acids called ketones." }
    ], ["type-2-diabetes", "diabetic-neuropathy", "diabetic-retinopathy"]),

  createDisease("Type 2 Diabetes", "type-2-diabetes", ["diabetes"],
    "Type 2 diabetes is an impairment in the way the body regulates and uses sugar (glucose) as a fuel. This long-term (chronic) condition results in too much sugar circulating in the bloodstream. Eventually, high blood sugar levels can lead to disorders of the circulatory, nervous and immune systems.",
    ["Increased thirst and frequent urination", "Increased hunger", "Unintended weight loss", "Fatigue", "Blurred vision", "Slow-healing sores or frequent infections", "Areas of darkened skin, usually in the armpits and neck"],
    ["Insulin resistance (body cells do not respond effectively to insulin)", "Inability of the pancreas to secrete enough insulin to overcome resistance", "Associated with genetics and lifestyle factors"],
    ["Being overweight or obese", "Physical inactivity", "Age (45+ is higher risk, though rising in children)", "Race (Black, Hispanic, Asian, Indigenous populations are at higher risk)", "High blood pressure and cholesterol levels"],
    "Diagnosed using A1C test, Fasting Blood Sugar (FBS) test, or Oral Glucose Tolerance Test (OGTT). An A1C level of 6.5% or higher indicates diabetes.",
    ["Healthy eating and regular exercise", "Weight loss", "Diabetes medications (e.g., Metformin, sulfonylureas)", "Insulin therapy in advanced stages", "Blood sugar monitoring"],
    "Eat healthy foods low in fat and calories, get active (at least 150 minutes of moderate exercise per week), lose excess weight, and avoid sedentary periods.",
    [
      { q: "Is Type 2 diabetes reversible?", a: "In many cases, significant weight loss, dietary changes, and exercise can achieve 'remission,' lowering blood sugars to normal levels without medication, though the genetic predisposition remains." },
      { q: "What is Metformin?", a: "Metformin is the most commonly prescribed first-line oral medication for Type 2 diabetes. It works by improving insulin sensitivity and reducing glucose production in the liver." }
    ], ["type-1-diabetes", "hypertension", "diabetic-nephropathy"]),

  createDisease("Gestational Diabetes", "gestational-diabetes", ["diabetes"],
    "Gestational diabetes is diabetes diagnosed for the first time during pregnancy (gestation). Like other types of diabetes, gestational diabetes affects how your cells use sugar (glucose). Gestational diabetes causes high blood sugar that can affect your pregnancy and your baby's health.",
    ["Most women have no noticeable symptoms", "Slightly increased thirst and frequency of urination in some cases"],
    ["Placental hormones block the action of insulin in the mother's body, causing insulin resistance", "The mother's pancreas cannot produce enough insulin to meet the increased demands of pregnancy"],
    ["Being overweight or obese before pregnancy", "Lack of physical activity", "Previous gestational diabetes", "Polycystic ovary syndrome (PCOS)", "Family history of diabetes"],
    "Diagnosed using screening tests (Glucose Challenge Test) followed by diagnostic tests (Oral Glucose Tolerance Test - OGTT) between 24 and 28 weeks of pregnancy.",
    ["Regular blood sugar monitoring", "Healthy diet and portion control", "Moderate physical activity", "Insulin injections if lifestyle changes aren't enough to control blood sugar", "Close monitoring of the baby's growth and delivery date"],
    "Start pregnancy at a healthy weight, eat a nutrient-dense diet rich in fiber and low in sugar, and remain physically active before and during pregnancy.",
    [
      { q: "Does gestational diabetes affect the baby?", a: "Yes. High blood sugar can cause the baby to grow too large (macrosomia), increase delivery risks, and cause low blood sugar in the baby at birth." },
      { q: "Will gestational diabetes go away after birth?", a: "Yes. For most women, blood sugar levels return to normal shortly after delivery. However, it increases the risk of developing Type 2 diabetes later in life." }
    ], ["type-2-diabetes", "prediabetes"]),

  createDisease("Prediabetes", "prediabetes", ["diabetes"],
    "Prediabetes means you have a higher than normal blood sugar level. It's not high enough to be considered type 2 diabetes yet. However, without lifestyle changes, adults and children with prediabetes are highly likely to develop type 2 diabetes.",
    ["Prediabetes usually has no signs or symptoms", "One possible sign is darkened skin on certain parts of the body, such as the neck, armpits, elbows, and knees (acanthosis nigricans)"],
    ["The cells in your body don't respond properly to insulin (insulin resistance)", "The pancreas cannot produce enough insulin to keep blood sugar in a normal range"],
    ["Weight (excess fat, especially abdominal)", "Waist size", "Diet high in red meat, processed meat, and sugar-sweetened beverages", "Inactivity", "Family history of Type 2 diabetes", "Age (45+)", "Gestational diabetes history"],
    "Diagnosed with an A1C test (range of 5.7% to 6.4%), a Fasting Blood Sugar test (100 to 125 mg/dL), or an Oral Glucose Tolerance Test (140 to 199 mg/dL).",
    ["Eating a healthy, low-carbohydrate, high-fiber diet", "Regular exercise (150 minutes per week)", "Losing 5% to 7% of your body weight", "Taking metformin in high-risk individuals"],
    "Choose a diet rich in vegetables, lean proteins, and whole grains; exercise regularly; quit smoking; and monitor blood sugar levels annually.",
    [
      { q: "Can prediabetes be reversed?", a: "Yes! Prediabetes is a critical warning phase. Lifestyle modifications like weight loss, diet changes, and exercise can return blood sugar levels to the normal range." },
      { q: "How long does it take for prediabetes to turn into diabetes?", a: "Without lifestyle changes, about 37% of people with prediabetes progress to Type 2 diabetes within 4 to 10 years." }
    ], ["type-2-diabetes", "hypertension"]),

  createDisease("Diabetic Retinopathy", "diabetic-retinopathy", ["diabetes", "eye-diseases"],
    "Diabetic retinopathy is a diabetes complication that affects eyes. It's caused by damage to the blood vessels of the light-sensitive tissue at the back of the eye (retina). At first, diabetic retinopathy may cause no symptoms or only mild vision problems. Eventually, it can cause blindness.",
    ["Spots or dark strings floating in your vision (floaters)", "Blurred vision", "Fluctuating vision", "Dark or empty areas in your vision", "Vision loss"],
    ["Chronic high blood sugar damages the tiny blood vessels (capillaries) that nourish the retina", "Vessels leak fluid or blood, and in advanced stages, new abnormal blood vessels grow and leak"],
    ["Having diabetes (Type 1 or Type 2) for a long time", "Poor control of blood sugar levels", "High blood pressure", "High cholesterol", "Pregnancy", "Tobacco use"],
    "Diagnosed through a comprehensive dilated eye exam, optical coherence tomography (OCT), and fluorescein angiography (dye test).",
    ["Tight control of blood sugar, blood pressure, and cholesterol in early stages", "Injectable medications into the eye (anti-VEGF therapy)", "Laser treatment (photocoagulation) to shrink blood vessels or seal leaks", "Vitrectomy surgery to remove blood from the vitreous gel"],
    "Manage your diabetes through diet, exercise, and medication; monitor your blood sugar daily; keep your blood pressure and cholesterol controlled; and get a dilated eye exam every year.",
    [
      { q: "Can diabetic retinopathy be reversed?", a: "Early-stage retinopathy can stabilize or even improve with strict blood sugar control, but advanced damage requires medical procedures to prevent permanent vision loss." },
      { q: "What is proliferative diabetic retinopathy?", a: "It is the advanced stage where damaged blood vessels close off, triggering the growth of fragile, new blood vessels that can leak blood into the eye and cause retinal detachment." }
    ], ["diabetic-nephropathy", "diabetic-neuropathy", "glaucoma"]),

  createDisease("Diabetic Nephropathy", "diabetic-nephropathy", ["diabetes", "kidney-diseases"],
    "Diabetic nephropathy is a serious kidney-related complication of Type 1 and Type 2 diabetes. It is also called diabetic kidney disease. It affects the kidneys' ability to do their usual work of removing waste products and extra fluid from your body.",
    ["Worsening blood pressure control", "Protein in the urine (microalbuminuria)", "Swelling of feet, ankles, hands or eyes", "Increased need to urinate", "Confusion or difficulty concentrating", "Shortness of breath", "Loss of appetite, nausea and vomiting"],
    ["High blood sugar levels damage the delicate filtering systems (glomeruli) in the kidneys over many years", "Chronic high blood pressure accelerates this damage"],
    ["Uncontrolled blood sugar (hyperglycemia)", "Uncontrolled high blood pressure (hypertension)", "Being a smoker", "High blood cholesterol", "A family history of diabetes and kidney disease"],
    "Diagnosed using urine tests for albumin (protein leakage), blood tests for creatinine to calculate Estimated Glomerular Filtration Rate (eGFR), and kidney biopsy in unclear cases.",
    ["Tight control of blood sugar and blood pressure", "Medications like ACE inhibitors or ARBs (which protect kidneys while lowering blood pressure)", "SGLT2 inhibitors and other modern diabetes drugs", "Dietary protein and sodium restriction", "Dialysis or kidney transplant in kidney failure (ESRD)"],
    "Manage blood sugar and blood pressure, take prescribed kidney-protecting blood pressure medications, avoid smoking, and limit over-the-counter pain relievers (like ibuprofen) which can damage kidneys.",
    [
      { q: "What is microalbuminuria?", a: "It is the presence of small amounts of a protein called albumin in the urine. It is the earliest clinical sign of diabetic kidney disease." },
      { q: "How does diabetes lead to kidney failure?", a: "High glucose levels strain the kidney filters. Over time, the filters get scarred, leak protein, and eventually stop filtering wastes from the blood entirely." }
    ], ["diabetic-retinopathy", "diabetic-neuropathy", "chronic-kidney-disease"]),

  createDisease("Diabetic Neuropathy", "diabetic-neuropathy", ["diabetes", "neurological-disorders"],
    "Diabetic neuropathy is a type of nerve damage that can occur if you have diabetes. High blood sugar (glucose) can injure nerves throughout your body. Diabetic neuropathy most often damages nerves in your legs and feet.",
    ["Numbness or reduced ability to feel pain or temperature changes", "Tingling or burning sensation", "Sharp pains or cramps", "Increased sensitivity to touch (allodynia)", "Foot problems, such as ulcers, infections, and bone and joint pain"],
    ["Chronic high blood sugar damages the walls of the tiny blood vessels (capillaries) that supply oxygen and nutrients to nerves", "Chemical changes in nerves caused by metabolic factors"],
    ["Poor blood sugar control", "Having diabetes for a long time", "Kidney disease (which increases toxins in blood)", "Being overweight", "Smoking (which narrows blood vessels)"],
    "Diagnosed through clinical examination (monofilament testing for sensation), nerve conduction studies, electromyography (EMG), and autonomic testing.",
    ["Tight control of blood glucose to prevent further damage", "Pain management medications (e.g., gabapentin, pregabalin, duloxetine)", "Careful foot care to prevent ulcers and infections", "Treatments for autonomic complications (like gastroparesis or orthostatic hypotension)"],
    "Keep blood sugar levels within target ranges, inspect your feet daily for cuts or sores, keep feet clean and dry, wear comfortable shoes, and avoid walking barefoot.",
    [
      { q: "Why is a foot injury dangerous in diabetic neuropathy?", a: "Nerve damage reduces pain sensation, meaning a diabetic may not feel a cut or blister on their foot. If left untreated, it can turn into a deep ulcer, get infected, and potentially lead to amputation." },
      { q: "Are there different types of diabetic neuropathy?", a: "Yes. The four main types are peripheral (legs/feet), autonomic (digestive/heart/bladder), proximal (thighs/hips), and focal (individual nerves, e.g., in the face or hand)." }
    ], ["diabetic-retinopathy", "diabetic-nephropathy", "chronic-kidney-disease"]),

  // --- RESPIRATORY DISEASES (7) ---
  createDisease("Asthma", "asthma", ["respiratory-diseases"],
    "Asthma is a condition in which your airways narrow and swell and may produce extra mucus. This can make breathing difficult and trigger coughing, a whistling sound (wheezing) when you breathe out, and shortness of breath.",
    ["Shortness of breath", "Chest tightness or pain", "Wheezing when exhaling, which is a common sign of asthma in children", "Trouble sleeping caused by shortness of breath, coughing or wheezing", "Coughing or wheezing attacks that are worsened by a respiratory virus"],
    ["A combination of environmental and genetic factors", "Airway hyperresponsiveness to triggers like allergens, cold air, exercise, or smoke"],
    ["Having a blood relative with asthma", "Having another allergic condition (atopic dermatitis or hay fever)", "Being overweight", "Being a smoker or exposed to secondhand smoke", "Exposure to exhaust fumes or other pollution"],
    "Diagnosed with spirometry (lung function tests), peak flow measurements, methacholine challenge, and allergy testing.",
    ["Short-acting rescue inhalers (bronchodilators like Albuterol)", "Long-term control medications (inhaled corticosteroids, leukotriene modifiers)", "Biologic therapies for severe asthma", "Avoiding asthma triggers"],
    "Follow your asthma action plan, get vaccinated for influenza and pneumonia, identify and avoid asthma triggers, monitor your breathing, and take medications as prescribed.",
    [
      { q: "Can a person outgrow asthma?", a: "Children with mild asthma may see symptoms disappear as they grow older, but the underlying airway sensitivity often remains and can return in adulthood." },
      { q: "What is an asthma trigger?", a: "An asthma trigger is anything that sets off asthma symptoms. Common triggers include pollen, dust mites, pet dander, exercise, cold air, stress, and respiratory infections." }
    ], ["copd", "bronchitis", "pneumonia"]),

  createDisease("COPD", "copd", ["respiratory-diseases"],
    "Chronic Obstructive Pulmonary Disease (COPD) is a chronic inflammatory lung disease that causes obstructed airflow from the lungs. Emphysema and chronic bronchitis are the two most common conditions that contribute to COPD.",
    ["Shortness of breath, especially during physical activities", "Wheezing", "Chest tightness", "A chronic cough that may produce mucus (sputum) that may be clear, white, yellow or greenish", "Frequent respiratory infections", "Lack of energy"],
    ["Long-term exposure to irritating gases or particulate matter, most commonly cigarette smoke", "Rarely, a genetic disorder called Alpha-1 antitrypsin deficiency"],
    ["Exposure to tobacco smoke", "People with asthma who smoke", "Occupational exposure to dusts and chemicals", "Exposure to fumes from burning fuel for cooking and heating", "Age (usually develops in people 40+)"],
    "Diagnosed via spirometry (which measures how much and how fast you can blow air out of your lungs), chest X-ray, CT scan, and arterial blood gas analysis.",
    ["Smoking cessation (most critical step)", "Bronchodilator inhalers", "Inhaled steroids", "Pulmonary rehabilitation program", "Supplemental oxygen therapy", "Lung volume reduction surgery or transplant in severe cases"],
    "Do not smoke and avoid secondhand smoke, wear protective equipment in dusty or chemical-heavy workplaces, and minimize exposure to air pollution.",
    [
      { q: "Is COPD reversible?", a: "No. The lung damage caused by COPD is permanent. However, treatment can control symptoms, improve quality of life, and slow progression of the disease." },
      { q: "What is the difference between emphysema and chronic bronchitis?", a: "Emphysema is the destruction of the fragile air sacs (alveoli) in the lungs. Chronic bronchitis is the long-term inflammation and excess mucus in the bronchial tubes." }
    ], ["asthma", "bronchitis", "lung-cancer"]),

  createDisease("Pneumonia", "pneumonia", ["respiratory-diseases", "infectious-diseases"],
    "Pneumonia is an infection that inflames the air sacs in one or both lungs. The air sacs may fill with fluid or pus (purulent material), causing cough with phlegm, fever, chills, and difficulty breathing. A variety of organisms, including bacteria, viruses and fungi, can cause pneumonia.",
    ["Chest pain when you breathe or cough", "Confusion or changes in mental awareness (in adults age 65 and older)", "Cough, which may produce phlegm", "Fatigue", "Fever, sweating and shaking chills", "Lower than normal body temperature (in older adults and people with weak immune systems)"],
    ["Bacterial infections (e.g., Streptococcus pneumoniae)", "Viral infections (influenza, respiratory syncytial virus, COVID-19)", "Fungal infections (more common in immunocompromised individuals)"],
    ["Age (infants under 2 and adults over 65 are at higher risk)", "Being hospitalized (especially if on a ventilator)", "Chronic disease (asthma, COPD, heart disease)", "Smoking", "Weakened or suppressed immune system"],
    "Diagnosed using a stethoscope check for crackling sounds, chest X-rays, blood tests (CBC), pulse oximetry, and sputum tests.",
    ["Antibiotics for bacterial pneumonia", "Antiviral drugs for viral pneumonia", "Cough medicines and fever reducers (acetaminophen, ibuprofen)", "Rest and plenty of fluids", "Hospitalization and oxygen therapy for severe cases"],
    "Get vaccinated (pneumococcal vaccine and annual flu shot), practice good hand hygiene, avoid smoking, and maintain a strong immune system.",
    [
      { q: "Is pneumonia contagious?", a: "The bacteria or viruses that cause pneumonia can be passed from person to person through coughs and sneezes, but the person who catches them will not necessarily develop pneumonia." },
      { q: "What is 'walking pneumonia'?", a: "It is a non-medical term for a mild form of bacterial pneumonia (often caused by Mycoplasma pneumoniae) where symptoms are mild enough that the patient doesn't require bed rest." }
    ], ["asthma", "bronchitis", "tuberculosis"]),

  createDisease("Bronchitis", "bronchitis", ["respiratory-diseases"],
    "Bronchitis is an inflammation of the lining of your bronchial tubes, which carry air to and from your lungs. People who have bronchitis often cough up thickened mucus, which can be discolored. Bronchitis may be either acute (short-term) or chronic (long-term).",
    ["Cough", "Production of mucus (sputum), which can be clear, white, yellowish-gray or green in color", "Fatigue", "Shortness of breath", "Slight fever and chills", "Chest discomfort"],
    ["Acute bronchitis is usually caused by viruses (often the same ones that cause colds and flu)", "Chronic bronchitis is most commonly caused by cigarette smoking and long-term exposure to dust, fumes, or air pollution"],
    ["Cigarette smoke", "Low resistance (weak immune system)", "Exposure to irritants on the job", "Gastric reflux (GERD) which can irritate the throat"],
    "Diagnosed by clinical exam, chest X-ray to rule out pneumonia, sputum tests, and pulmonary function tests.",
    ["Rest, fluids, and humid air", "Cough suppressants (sparingly, to allow coughing up mucus)", "Bronchodilators to open airways", "Antibiotics (only if a bacterial infection is suspected, which is rare)"],
    "Avoid cigarette smoke, get vaccinated (annual flu shot), wash hands frequently, and wear a surgical mask when exposed to lung irritants.",
    [
      { q: "Should I take antibiotics for bronchitis?", a: "Most cases of acute bronchitis are viral, meaning antibiotics will not work. Antibiotics are only prescribed if the doctor suspects a bacterial infection." },
      { q: "How long does acute bronchitis last?", a: "While the initial infection clears in a week, the dry, hacking cough can linger for 3 to 4 weeks while the airways heal." }
    ], ["asthma", "copd", "pneumonia"]),

  createDisease("Tuberculosis", "tuberculosis", ["respiratory-diseases", "infectious-diseases"],
    "Tuberculosis (TB) is a potentially serious infectious disease that mainly affects your lungs. The bacteria that cause tuberculosis are spread from one person to another through tiny droplets released into the air via coughs and sneezes.",
    ["Coughing for three or more weeks", "Coughing up blood or mucus", "Chest pain, or pain with breathing or coughing", "Unintentional weight loss", "Fatigue", "Fever and night sweats"],
    ["Infection by Mycobacterium tuberculosis bacteria."],
    ["Weakened immune system (especially HIV/AIDS)", "Living or traveling in areas with high TB rates (e.g., parts of Africa, Asia, Eastern Europe)", "Poverty and substance abuse", "Working in healthcare or correctional facilities"],
    "Diagnosed with a tuberculin skin test (TST), interferon-gamma release assays (IGRA) blood tests, chest X-ray, and sputum smear/culture.",
    ["A long course of multiple antibiotics (usually isoniazid, rifampin, ethambutol, and pyrazinamide for 6 to 9 months)", "Directly Observed Therapy (DOT) to ensure compliance and prevent drug-resistant TB strains"],
    "If you test positive for latent TB infection, take preventive medications. In countries where TB is common, infants are often vaccinated with the BCG vaccine.",
    [
      { q: "What is the difference between latent and active TB?", a: "In latent TB, you have the bacteria in your body, but your immune system keeps it inactive; you have no symptoms and are not contagious. In active TB, the bacteria multiply, make you sick, and can spread to others." },
      { q: "Why is completing TB treatment so important?", a: "Stopping TB drugs early or skipping doses allows the bacteria that are still alive to become resistant to those drugs, leading to Multidrug-Resistant TB (MDR-TB), which is much harder and costlier to treat." }
    ], ["pneumonia", "hiv-aids"]),

  createDisease("Pulmonary Fibrosis", "pulmonary-fibrosis", ["respiratory-diseases"],
    "Pulmonary fibrosis is a lung disease that occurs when lung tissue becomes damaged and scarred. This thickened, stiff tissue makes it more difficult for your lungs to work properly. As pulmonary fibrosis worsens, you become progressively more short of breath.",
    ["Shortness of breath (dyspnea), especially during exercise", "A dry, hacking cough", "Fatigue", "Unexplained weight loss", "Aching muscles and joints", "Widening and rounding of the tips of the fingers or toes (clubbing)"],
    ["Exposure to environmental toxins (asbestos, silica, coal dust)", "Certain medical conditions (autoimmune diseases like rheumatoid arthritis, lupus)", "Certain medications (chemotherapy, heart drugs)", "Often, the cause is unknown (Idiopathic Pulmonary Fibrosis - IPF)"],
    ["Age (middle-aged and older adults)", "Sex (more common in men)", "Smoking", "Certain occupations (mining, construction, farming)", "Genetic factors"],
    "Diagnosed using high-resolution chest CT scans, pulmonary function tests, pulse oximetry, and lung biopsy.",
    ["Medications to slow progression (antifibrotic drugs like pirfenidone and nintedanib)", "Oxygen therapy", "Pulmonary rehabilitation", "Lung transplant (often the only definitive treatment for advanced cases)"],
    "Avoid exposure to occupational dusts and chemicals, stop smoking, get vaccinated for respiratory infections, and seek early medical attention for breathing difficulties.",
    [
      { q: "What does 'idiopathic' mean in Idiopathic Pulmonary Fibrosis?", a: "Idiopathic means the exact cause of the lung scarring cannot be identified despite thorough investigation." },
      { q: "Can scarred lung tissue heal?", a: "No. The scarring (fibrosis) that occurs in the lungs is permanent. Treatment focuses on preserving remaining lung function and slowing down the scarring process." }
    ], ["copd", "autoimmune-rheumatoid-arthritis"]),

  createDisease("Influenza", "influenza", ["respiratory-diseases", "infectious-diseases"],
    "Influenza (flu) is an infection of the nose, throat and lungs, which are part of the respiratory system. For most people, the flu resolves on its own. But sometimes, influenza and its complications can be deadly.",
    ["Fever over 100.4 F (38 C)", "Aching muscles, especially in your back, arms and legs", "Chills and sweats", "Headache", "Dry, persistent cough", "Shortness of breath", "Tiredness and weakness", "Runny or stuffy nose", "Sore throat"],
    ["Infection by influenza viruses (usually Type A or Type B) spread via respiratory droplets."],
    ["Age (children under 5 and adults 65+)", "Living or working conditions (nursing homes, military barracks)", "Weakened immune system", "Chronic illnesses (asthma, heart disease, diabetes)", "Pregnancy", "Obesity"],
    "Diagnosed primarily by clinical symptoms, rapid influenza diagnostic tests (RIDTs), or rapid molecular assays using nasal swabs.",
    ["Rest and plenty of fluids", "Over-the-counter pain relievers (acetaminophen, ibuprofen)", "Antiviral drugs (like oseltamivir / Tamiflu) if started within 48 hours of symptom onset"],
    "Get an annual flu vaccine, wash hands frequently, cover your mouth when coughing or sneezing, and avoid close contact with sick individuals.",
    [
      { q: "Why do I need a flu shot every year?", a: "Influenza viruses mutate rapidly. The vaccine is updated annually to match the specific virus strains predicted to circulate each flu season." },
      { q: "Is the flu just a bad cold?", a: "No. While they share symptoms, the flu is caused by a different virus, starts much more suddenly, and has more severe symptoms (high fever, body aches) and a higher risk of serious complications like pneumonia." }
    ], ["covid-19", "pneumonia", "bronchitis"]),

  // --- INFECTIOUS DISEASES (7) ---
  createDisease("COVID-19", "covid-19", ["infectious-diseases"],
    "Coronavirus disease 2019 (COVID-19) is an infectious disease caused by the SARS-CoV-2 virus. It spread globally in 2020, causing a major pandemic. The virus spreads mainly through respiratory droplets when people cough, sneeze, talk, or breathe.",
    ["Fever or chills", "Cough", "Shortness of breath or difficulty breathing", "Fatigue", "Muscle or body aches", "New loss of taste or smell", "Sore throat", "Congestion or runny nose"],
    ["Infection by the SARS-CoV-2 coronavirus."],
    ["Older age", "Underlying medical conditions (heart disease, diabetes, lung disease)", "Being unvaccinated", "Frequent exposure in crowded, poorly ventilated indoor spaces"],
    "Diagnosed via rapid antigen tests (lateral flow) or molecular PCR tests using nasal or oral swabs.",
    ["Symptomatic care (hydration, rest, fever reducers)", "Antiviral medications (e.g., Paxlovid) for high-risk patients", "Oxygen therapy and mechanical ventilation for severe cases", "Monoclonal antibodies"],
    "Get vaccinated and boosted, wear masks in crowded settings, wash hands frequently, improve indoor ventilation, and self-isolate if testing positive.",
    [
      { q: "What is 'Long COVID'?", a: "Long COVID refers to symptoms (like fatigue, brain fog, and shortness of breath) that persist for weeks, months, or even years after clearing the initial COVID-19 infection." },
      { q: "How do vaccines protect against COVID-19?", a: "Vaccines train the immune system to recognize the spike protein of the virus, significantly reducing the risk of severe illness, hospitalization, and death." }
    ], ["influenza", "pneumonia"]),

  createDisease("Malaria", "malaria", ["infectious-diseases", "rare-diseases"],
    "Malaria is a life-threatening disease spread to humans by some types of mosquitoes. It is mostly found in tropical countries. It is preventable and curable. The infection is caused by a parasite and does not spread from person to person.",
    ["Fever and chills", "Headache", "Muscle aches and fatigue", "Nausea, vomiting, and diarrhea", "Yellow skin (jaundice) due to loss of red blood cells", "Cough"],
    ["Infection by Plasmodium parasites (most commonly P. falciparum and P. vivax) transmitted through the bite of an infected female Anopheles mosquito."],
    ["Living in or visiting tropical/subtropical regions where malaria is endemic", "Lack of immunity (young children, pregnant women, travelers)", "Not using preventative measures (nets, sprays, medications)"],
    "Diagnosed using microscopic examination of blood smears (thin and thick smears) and rapid diagnostic tests (RDTs) that detect parasite antigens in blood.",
    ["Artemisinin-based combination therapies (ACTs) (primary treatment)", "Chloroquine or primaquine (for specific parasite strains)", "Intravenous antimalarial drugs for severe cases"],
    "Use insect repellent, sleep under insecticide-treated bed nets, wear long-sleeved clothing, spray homes, and take antimalarial preventive pills (chemoprophylaxis) when traveling to endemic areas.",
    [
      { q: "Can malaria return after being cured?", a: "Some malaria parasites (P. vivax and P. ovale) have dormant liver stages that can reactivate months or years later, causing relapses unless treated with specific liver-clearing drugs." },
      { q: "Why is malaria common in tropical areas?", a: "Warm temperatures, high humidity, and rainfall in tropical and subtropical regions provide ideal breeding conditions for Anopheles mosquitoes and allow the parasite to develop within them." }
    ], ["dengue-fever", "typhoid"]),

  createDisease("Dengue Fever", "dengue-fever", ["infectious-diseases"],
    "Dengue is a viral infection transmitted to humans through the bite of infected mosquitoes. It is common in tropical and subtropical climates. Many dengue infections produce only mild illness, but dengue can cause a severe form called dengue hemorrhagic fever.",
    ["High fever (40 C / 104 F)", "Severe headache", "Pain behind the eyes", "Muscle and joint pains (often called 'breakbone fever')", "Nausea and vomiting", "Swollen glands", "Rash (typically appearing 2-5 days after fever)"],
    ["Infection by one of four dengue virus serotypes (DENV 1-4) transmitted by Aedes aegypti mosquitoes."],
    ["Living in or traveling to tropical regions", "Prior infection with a different dengue serotype (greatly increases risk of severe dengue)", "Living in areas with stagnant open water (mosquito breeding sites)"],
    "Diagnosed using blood tests to detect viral RNA (PCR), viral antigens (NS1), or antibodies (IgM/IgG).",
    ["Symptomatic care, including pain relief (using Acetaminophen/Paracetamol)", "Fluid replacement (oral or IV) to prevent dehydration", "AVOID Aspirin and Ibuprofen, as they can worsen bleeding tendencies"],
    "Prevent mosquito bites by using repellents, wearing protective clothing, installing window screens, and eliminating stagnant water containers around the home.",
    [
      { q: "Why are aspirin and ibuprofen avoided in dengue?", a: "Dengue can lower platelet counts and increase bleeding risks. NSAIDs like ibuprofen and aspirin thin the blood and can trigger severe internal bleeding. Only paracetamol/acetaminophen should be used." },
      { q: "What is severe dengue?", a: "Also known as Dengue Hemorrhagic Fever, it is a life-threatening complication characterized by plasma leakage, severe bleeding, organ impairment, and a sudden drop in blood pressure (dengue shock syndrome)." }
    ], ["malaria", "blood-leukemia"]),

  createDisease("HIV/AIDS", "hiv-aids", ["infectious-diseases"],
    "Human Immunodeficiency Virus (HIV) is a virus that attacks the body's immune system, specifically the CD4 cells (T helper cells). If HIV is not treated, it can lead to AIDS (Acquired Immunodeficiency Syndrome). There is currently no effective cure, but medical treatments can manage it.",
    ["Acute phase (2-4 weeks after infection): Flu-like symptoms (fever, sore throat, rash, swollen lymph nodes)", "Chronic phase: Often no symptoms for years as CD4 counts slowly drop", "AIDS phase: Rapid weight loss, recurring fevers, extreme fatigue, prolonged swelling of lymph nodes, opportunistic infections (pneumonia, thrush, cancers)"],
    ["Transmission of HIV through blood, semen, vaginal fluids, rectal fluids, or breast milk, usually via unprotected sexual contact, sharing needles, or mother-to-child during birth or breastfeeding."],
    ["Unprotected sexual intercourse", "Sharing needles or syringes for injecting drugs", "Having another sexually transmitted infection (STI)", "Receiving unsafe blood transfusions or medical procedures"],
    "Diagnosed using antigen/antibody combination blood tests, rapid point-of-care tests, and confirmed with molecular RNA tests. CD4 count and viral load monitor progression.",
    ["Antiretroviral Therapy (ART) - a daily combination of medications that suppresses viral replication", "Prophylaxis for opportunistic infections", "Pre-Exposure Prophylaxis (PrEP) for HIV-negative individuals at high risk"],
    "Practice safe sex (use condoms), do not share needles, use PrEP if at high risk, use Post-Exposure Prophylaxis (PEP) within 72 hours of possible exposure, and screen pregnant mothers.",
    [
      { q: "What does 'Undetectable = Untransmittable' (U=U) mean?", a: "People living with HIV who take ART daily as prescribed and maintain an undetectable viral load have effectively no risk of transmitting HIV to their HIV-negative sexual partners." },
      { q: "Is HIV the same as AIDS?", a: "No. HIV is the virus that infects the body. AIDS is the most advanced stage of HIV infection, diagnosed when the immune system is severely damaged (CD4 count below 200) or when opportunistic infections occur." }
    ], ["tuberculosis", "pneumonia"]),

  createDisease("Hepatitis B", "hepatitis-b", ["infectious-diseases"],
    "Hepatitis B is a serious liver infection caused by the hepatitis B virus (HBV). For some people, hepatitis B infection becomes chronic, meaning it lasts more than six months. Chronic hepatitis B increases your risk of developing liver failure, liver cancer or cirrhosis.",
    ["Abdominal pain", "Dark urine", "Fever", "Joint pain", "Loss of appetite", "Nausea and vomiting", "Weakness and fatigue", "Yellowing of your skin and the whites of your eyes (jaundice)"],
    ["Transmission of the hepatitis B virus through exposure to infectious blood or body fluids (semen, vaginal secretions), commonly via sexual contact, sharing needles, or from mother to child at birth."],
    ["Having unprotected sex with multiple partners", "Sharing needles during IV drug use", "Being a healthcare worker exposed to blood", "Traveling to regions with high HBV rates (Asia, Africa, Pacific Islands)"],
    "Diagnosed through blood tests that detect specific HBV antigens and antibodies (HBsAg, anti-HBs, anti-HBc) and liver function tests.",
    ["Acute infection: Supportive care (rest, fluids, nutrition)", "Chronic infection: Antiviral medications (e.g., tenofovir, entecavir) to slow liver damage, interferon injections, and liver transplant in end-stage liver disease"],
    "Receive the Hepatitis B vaccine (highly effective series of shots), use barrier protection during sex, avoid sharing needles or personal items like razors/toothbrushes, and ensure sterile equipment for tattoos/piercings.",
    [
      { q: "Can Hepatitis B be cured?", a: "Acute Hepatitis B usually clears on its own in adults. Chronic Hepatitis B cannot be fully cured, but it can be highly controlled with daily antiviral medications to prevent liver failure and cancer." },
      { q: "How is Hepatitis B different from Hepatitis A and C?", a: "Hep A is spread through contaminated food/water and is acute only. Hep B and C are spread through blood/body fluids and can become chronic. Hep B has a highly effective vaccine, Hep C is curable with direct-acting antivirals but has no vaccine." }
    ], ["liver-cancer", "kidney-stones"]),

  createDisease("Cholera", "cholera", ["infectious-diseases"],
    "Cholera is an acute diarrheal illness caused by infection of the intestine with the Vibrio cholerae bacteria. People can get sick when they swallow food or water contaminated with cholera bacteria. The infection is often mild or without symptoms, but can sometimes be severe and life-threatening.",
    ["Profuse, watery diarrhea (often described as 'rice-water stools')", "Vomiting", "Rapid heart rate", "Loss of skin elasticity (tenting)", "Dry mucous membranes and extreme thirst", "Muscle cramps due to electrolyte loss"],
    ["Ingestion of food or water contaminated with the bacterium Vibrio cholerae, often originating from feces of infected individuals in areas with poor sanitation."],
    ["Poor sanitary conditions and lack of clean drinking water", "Living in or traveling to cholera-endemic regions", "Low stomach acid (which reduces natural defense against the bacteria)", "Type O blood (associated with higher risk of severe cholera for unknown reasons)"],
    "Diagnosed by detecting Vibrio cholerae in stool samples using microscopic examination, rapid diagnostic test kits, or stool cultures.",
    ["Oral Rehydration Salts (ORS) - prompt replacement of lost fluids and salts (most critical treatment)", "Intravenous fluids for severely dehydrated patients", "Antibiotics (like doxycycline or azithromycin) to shorten the illness duration and reduce fluid requirements", "Zinc supplementation for children"],
    "Drink and use safe water (boiled or chemically treated), wash hands frequently with soap, eat thoroughly cooked hot foods, avoid raw seafood, and get vaccinated with oral cholera vaccines.",
    [
      { q: "How quickly can cholera kill?", a: "In severe cases, the massive loss of fluids from watery diarrhea can lead to severe dehydration, shock, and death within a few hours if rehydration treatment is not started." },
      { q: "What is 'rice-water stool'?", a: "It is the classic symptom of cholera where the stool becomes a clear, odorless liquid containing white flecks of mucus and epithelial cells, resembling water in which rice has been boiled." }
    ], ["typhoid", "urinary-tract-infection"]),

  createDisease("Typhoid", "typhoid", ["infectious-diseases"],
    "Typhoid fever is a life-threatening infection caused by the bacterium Salmonella Typhi. It is usually spread through contaminated food or water. Once the bacteria are eaten, they multiply and spread into the bloodstream.",
    ["Fever that starts low and increases daily, reaching up to 104.9 F (40.5 C)", "Headache", "Weakness and fatigue", "Muscle aches", "Sweating", "Dry cough", "Loss of appetite and weight loss", "Stomach pain, diarrhea or constipation", "Extremely flat rash of rose-colored spots"],
    ["Infection by Salmonella enterica serovar Typhi bacteria, transmitted through the fecal-oral route via contaminated food, water, or close contact with a carrier."],
    ["Working in or traveling to areas where typhoid fever is common", "Working as a clinical microbiologist handling Salmonella Typhi", "Having close contact with someone who is infected or a chronic carrier of typhoid"],
    "Diagnosed through blood, stool, urine, or bone marrow cultures to isolate the Salmonella Typhi bacteria.",
    ["Antibiotic therapy (e.g., ciprofloxacin, ceftriaxone, azithromycin) - crucial to cure the infection", "Fluids and electrolyte replacement", "Surgery in rare cases of intestinal perforation"],
    "Get vaccinated against typhoid (injectable or oral vaccines) before traveling to high-risk areas, practice the rule: 'Boil it, cook it, peel it, or forget it' for food and water safety, and wash hands frequently.",
    [
      { q: "Can you be a healthy carrier of typhoid?", a: "Yes. Even after recovering from typhoid, a small percentage of people (around 2-5%) continue to harbor the bacteria in their gallbladders and shed it in their stool for years, potentially infecting others. The most famous case was 'Typhoid Mary'." },
      { q: "How does typhoid differ from standard food poisoning?", a: "Standard food poisoning is usually localized in the gut and resolves in a few days. Typhoid is a systemic infection where the bacteria enter the bloodstream, causing prolonged high fevers, organ enlargement, and potentially fatal complications if untreated." }
    ], ["malaria", "cholera", "ibs"])
];

// Add generic placeholder entries for the remaining categories to reach 100+ diseases
const otherCategories = [
  "neurological-disorders", "mental-health", "skin-diseases", "kidney-diseases", 
  "digestive-diseases", "eye-diseases", "bone-joint-diseases", "blood-disorders", 
  "autoimmune-diseases", "rare-diseases"
];

const remainingDiseasesData = [
  // --- NEUROLOGICAL DISORDERS (7) ---
  { name: "Alzheimer's Disease", slug: "alzheimers-disease", cats: ["neurological-disorders"] },
  { name: "Parkinson's Disease", slug: "parkinsons-disease", cats: ["neurological-disorders"] },
  { name: "Epilepsy", slug: "epilepsy", cats: ["neurological-disorders"] },
  { name: "Stroke", slug: "stroke", cats: ["neurological-disorders", "heart-diseases"] },
  { name: "Multiple Sclerosis", slug: "multiple-sclerosis", cats: ["neurological-disorders", "autoimmune-diseases"] },
  { name: "Migraine", slug: "migraine", cats: ["neurological-disorders"] },
  { name: "Amyotrophic Lateral Sclerosis", slug: "als", cats: ["neurological-disorders", "rare-diseases"] },

  // --- MENTAL HEALTH (7) ---
  { name: "Clinical Depression", slug: "clinical-depression", cats: ["mental-health"] },
  { name: "Generalized Anxiety Disorder", slug: "generalized-anxiety-disorder", cats: ["mental-health"] },
  { name: "Bipolar Disorder", slug: "bipolar-disorder", cats: ["mental-health"] },
  { name: "Schizophrenia", slug: "schizophrenia", cats: ["mental-health"] },
  { name: "PTSD", slug: "ptsd", cats: ["mental-health"] },
  { name: "ADHD", slug: "adhd", cats: ["mental-health"] },
  { name: "Obsessive-Compulsive Disorder", slug: "ocd", cats: ["mental-health"] },

  // --- SKIN DISEASES (7) ---
  { name: "Eczema", slug: "eczema", cats: ["skin-diseases"] },
  { name: "Psoriasis", slug: "psoriasis", cats: ["skin-diseases", "autoimmune-diseases"] },
  { name: "Acne Vulgaris", slug: "acne-vulgaris", cats: ["skin-diseases"] },
  { name: "Contact Dermatitis", slug: "dermatitis", cats: ["skin-diseases"] },
  { name: "Vitiligo", slug: "vitiligo", cats: ["skin-diseases", "autoimmune-diseases"] },
  { name: "Rosacea", slug: "rosacea", cats: ["skin-diseases"] },
  { name: "Urticaria (Hives)", slug: "hives", cats: ["skin-diseases"] },

  // --- KIDNEY DISEASES (7) ---
  { name: "Chronic Kidney Disease", slug: "chronic-kidney-disease", cats: ["kidney-diseases"] },
  { name: "Kidney Stones", slug: "kidney-stones", cats: ["kidney-diseases"] },
  { name: "Acute Kidney Injury", slug: "acute-kidney-injury", cats: ["kidney-diseases"] },
  { name: "Glomerulonephritis", slug: "glomerulonephritis", cats: ["kidney-diseases", "autoimmune-diseases"] },
  { name: "Polycystic Kidney Disease", slug: "polycystic-kidney-disease", cats: ["kidney-diseases", "rare-diseases"] },
  { name: "Nephrotic Syndrome", slug: "nephrotic-syndrome", cats: ["kidney-diseases"] },
  { name: "Urinary Tract Infection", slug: "urinary-tract-infection", cats: ["kidney-diseases", "infectious-diseases"] },

  // --- DIGESTIVE DISEASES (7) ---
  { name: "Irritable Bowel Syndrome", slug: "ibs", cats: ["digestive-diseases"] },
  { name: "Gastroesophageal Reflux Disease", slug: "gerd", cats: ["digestive-diseases"] },
  { name: "Crohn's Disease", slug: "crohns-disease", cats: ["digestive-diseases", "autoimmune-diseases"] },
  { name: "Celiac Disease", slug: "celiac-disease", cats: ["digestive-diseases", "autoimmune-diseases"] },
  { name: "Ulcerative Colitis", slug: "ulcerative-colitis", cats: ["digestive-diseases", "autoimmune-diseases"] },
  { name: "Peptic Ulcer Disease", slug: "peptic-ulcer", cats: ["digestive-diseases"] },
  { name: "Gallstones", slug: "gallstones", cats: ["digestive-diseases"] },

  // --- EYE DISEASES (7) ---
  { name: "Cataracts", slug: "cataracts", cats: ["eye-diseases"] },
  { name: "Glaucoma", slug: "glaucoma", cats: ["eye-diseases"] },
  { name: "Age-Related Macular Degeneration", slug: "macular-degeneration", cats: ["eye-diseases"] },
  { name: "Conjunctivitis (Pink Eye)", slug: "conjunctivitis", cats: ["eye-diseases", "infectious-diseases"] },
  { name: "Dry Eye Syndrome", slug: "dry-eye-syndrome", cats: ["eye-diseases"] },
  { name: "Astigmatism", slug: "astigmatism", cats: ["eye-diseases"] },
  { name: "Presbyopia", slug: "presbyopia", cats: ["eye-diseases"] },

  // --- BONE & JOINT DISEASES (7) ---
  { name: "Osteoporosis", slug: "osteoporosis", cats: ["bone-joint-diseases"] },
  { name: "Osteoarthritis", slug: "osteoarthritis", cats: ["bone-joint-diseases"] },
  { name: "Rheumatoid Arthritis", slug: "rheumatoid-arthritis", cats: ["bone-joint-diseases", "autoimmune-diseases"] },
  { name: "Gout", slug: "gout", cats: ["bone-joint-diseases"] },
  { name: "Scoliosis", slug: "scoliosis", cats: ["bone-joint-diseases"] },
  { name: "Paget's Disease of Bone", slug: "pagets-disease", cats: ["bone-joint-diseases"] },
  { name: "Fibromyalgia", slug: "fibromyalgia", cats: ["bone-joint-diseases", "mental-health"] },

  // --- BLOOD DISORDERS (7) ---
  { name: "Iron Deficiency Anemia", slug: "iron-deficiency-anemia", cats: ["blood-disorders"] },
  { name: "Sickle Cell Disease", slug: "sickle-cell-anemia", cats: ["blood-disorders", "rare-diseases"] },
  { name: "Hemophilia", slug: "hemophilia", cats: ["blood-disorders", "rare-diseases"] },
  { name: "Thalassemia", slug: "thalassemia", cats: ["blood-disorders", "rare-diseases"] },
  { name: "Deep Vein Thrombosis", slug: "dvt", cats: ["blood-disorders", "heart-diseases"] },
  { name: "Lymphoma", slug: "lymphoma", cats: ["blood-disorders", "cancer"] },
  { name: "Thrombocytopenia", slug: "thrombocytopenia", cats: ["blood-disorders"] },

  // --- AUTOIMMUNE DISEASES (7) ---
  { name: "Systemic Lupus Erythematosus", slug: "lupus", cats: ["autoimmune-diseases"] },
  { name: "Hashimoto's Thyroiditis", slug: "hashimotos-thyroiditis", cats: ["autoimmune-diseases"] },
  { name: "Sjogren's Syndrome", slug: "sjogrens-syndrome", cats: ["autoimmune-diseases"] },
  { name: "Graves' Disease", slug: "graves-disease", cats: ["autoimmune-diseases"] },
  { name: "Myasthenia Gravis", slug: "myasthenia-gravis", cats: ["autoimmune-diseases", "rare-diseases"] },
  { name: "Celiac Autoimmune Disease", slug: "celiac-autoimmune", cats: ["autoimmune-diseases"] },
  { name: "Scleroderma", slug: "scleroderma", cats: ["autoimmune-diseases", "rare-diseases"] },

  // --- RARE DISEASES (7) ---
  { name: "Huntington's Disease", slug: "huntingtons-disease", cats: ["rare-diseases", "neurological-disorders"] },
  { name: "Cystic Fibrosis", slug: "cystic-fibrosis", cats: ["rare-diseases", "respiratory-diseases"] },
  { name: "Progeria (Hutchinson-Gilford)", slug: "progeria", cats: ["rare-diseases"] },
  { name: "Marfan Syndrome", slug: "marfan-syndrome", cats: ["rare-diseases"] },
  { name: "Fabry Disease", slug: "fabry-disease", cats: ["rare-diseases"] },
  { name: "Guillain-Barré Syndrome", slug: "guillain-barre-syndrome", cats: ["rare-diseases", "neurological-disorders"] },
  { name: "Ehlers-Danlos Syndrome", slug: "ehlers-danlos-syndrome", cats: ["rare-diseases"] }
];

// Hydrate the simple list with detailed mock contents
const hydratedRemainingDiseases = remainingDiseasesData.map(item => {
  return createDisease(
    item.name,
    item.slug,
    item.cats,
    `${item.name} is a medical condition affecting patients worldwide. This guide covers the overview, common symptoms, causes, diagnosis, and treatment pathways for ${item.name}.`,
    [`Common symptom of ${item.name} #1`, `Mild indicator of ${item.name} #2`, `Severe manifestation of ${item.name} #3`, `Associated fatigue or discomfort`],
    [`Genetic predisposition`, `Environmental factors and lifestyle`, `Biological or infectious triggers`],
    [`Age-related changes`, `Family medical history`, `Compounding metabolic or physical factors`],
    `Diagnosed through specialized clinical evaluations, laboratory testing, physical examinations, and imaging scans as advised by a healthcare provider.`,
    [`First-line therapies and medications`, `Recommended lifestyle changes`, `Supportive care and monitoring`, `Secondary treatment strategies`],
    `Prevention strategies include a balanced diet, regular exercise, routine health check-ups, and managing risk factors.`,
    [
      { q: `What is ${item.name}?`, a: `${item.name} is a structured clinical condition that requires medical screening and management.` },
      { q: `Can ${item.name} be prevented?`, a: `In some cases, modifying lifestyle risk factors and seeking early clinical counseling can significantly reduce the risk or delay onset.` }
    ],
    []
  );
});

const allDiseases = [...diseases, ...hydratedRemainingDiseases];

// Health Library Data
const libraryData = [
  // ---- SYMPTOMS GUIDES ----
  {
    type: "symptoms",
    slug: "chest-pain",
    title: "Chest Pain Guide",
    description: "Learn to distinguish between heart-related chest pain, respiratory conditions, and muscle strains. Includes critical warnings for seeking emergency help.",
    content: "Chest pain is one of the most common reasons people seek medical help. It is crucial to determine if the chest pain is cardiac (like a heart attack or angina) or non-cardiac (respiratory, gastrointestinal, or musculoskeletal). Cardiac chest pain is often described as pressure, squeezing, or tightness. Non-cardiac causes include GERD, costochondritis, pneumonia, and anxiety. Always treat sudden, crushing chest pain radiating to the arm or jaw as a medical emergency. Call emergency services immediately."
  },
  {
    type: "symptoms",
    slug: "fever",
    title: "Fever Guide",
    description: "Understanding body temperature ranges, when a fever is beneficial, and when to seek urgent medical attention for children and adults.",
    content: "A fever is a temporary increase in body temperature, often due to an illness. It is a sign that the immune system is fighting off an infection. Body temperature above 100.4°F (38°C) is clinically defined as a fever. Fevers in adults up to 103°F can be managed at home with fluids and antipyretics (paracetamol/ibuprofen). In infants under 3 months, any fever warrants emergency evaluation. Fevers above 103°F in adults, or those lasting more than 3 days, require medical consultation."
  },
  {
    type: "symptoms",
    slug: "headache",
    title: "Headache Types & Relief",
    description: "Identify tension headaches, migraines, and cluster headaches, along with triggers and home care strategies.",
    content: "Headaches are among the most prevalent neurological disorders. Tension headaches cause a dull, aching sensation and tightness around the forehead. Migraines involve throbbing pain, often one-sided, with nausea, light, and sound sensitivity. Cluster headaches are severe, one-sided pains around the eye, occurring in patterns ('clusters'). Seek emergency care for a sudden, severe headache described as the 'worst headache of your life', headache with stiff neck and fever (possible meningitis), or headache after head injury."
  },
  {
    type: "symptoms",
    slug: "shortness-of-breath",
    title: "Shortness of Breath",
    description: "Understanding dyspnea: when breathlessness is normal versus when it signals a serious heart or lung condition requiring urgent care.",
    content: "Shortness of breath (dyspnea) is the subjective feeling of not getting enough air. It can be caused by physical exertion (normal), respiratory conditions (asthma, COPD, pneumonia), cardiovascular issues (heart failure, pulmonary embolism), or anxiety. Red flags include sudden shortness of breath at rest, breathlessness when lying flat, breathlessness with chest pain or coughing blood — these require immediate emergency evaluation."
  },
  {
    type: "symptoms",
    slug: "fatigue",
    title: "Chronic Fatigue Guide",
    description: "Distinguishing between normal tiredness and pathological fatigue. Understand conditions that cause persistent exhaustion and when to consult a doctor.",
    content: "Fatigue is one of the most common health complaints. Normal fatigue resolves with rest, while pathological fatigue persists despite adequate sleep. Chronic fatigue can indicate anemia, hypothyroidism, depression, diabetes, heart failure, sleep apnea, cancer, or chronic fatigue syndrome (ME/CFS). Key investigations include CBC, thyroid panel (TSH), blood glucose, and iron studies. If fatigue persists for over 2 weeks without an obvious cause, consult your physician."
  },
  {
    type: "symptoms",
    slug: "abdominal-pain",
    title: "Abdominal Pain Guide",
    description: "Mapping abdominal pain locations to possible conditions. Learn which symptoms warrant emergency care versus routine consultation.",
    content: "Abdominal pain can originate from virtually any organ in the abdomen. Upper right quadrant pain may indicate gallstones or liver issues. Upper left pain may indicate gastritis or spleen problems. Lower right pain is classically associated with appendicitis. Lower left pain may indicate diverticulitis or ovarian cysts. Generalized cramping may indicate IBS, gastroenteritis, or constipation. Seek emergency care for sudden severe pain, pain with rigid abdomen, or pain with vomiting blood."
  },
  {
    type: "symptoms",
    slug: "weight-loss",
    title: "Unintended Weight Loss",
    description: "Understanding what causes unexplained weight loss and why it is a clinical red flag that requires investigation.",
    content: "Losing more than 5% of your body weight unintentionally over 6-12 months is clinically significant and requires investigation. Common causes include hyperthyroidism, diabetes, cancer (particularly lung, GI, and lymphoma), depression, inflammatory bowel disease, malabsorption syndromes, and chronic infections like tuberculosis. A systematic evaluation including blood tests, imaging, and clinical history is warranted when no obvious cause exists."
  },

  // ---- MEDICAL TESTS ----
  {
    type: "tests",
    slug: "blood-test",
    title: "Complete Blood Count (CBC)",
    description: "What does a CBC measure? Learn about red blood cells, white blood cells, platelets, hemoglobin values, and what abnormal results mean.",
    content: "A Complete Blood Count (CBC) is one of the most common blood panels ordered. It measures: Red Blood Cells (RBC) — low indicates anemia; White Blood Cells (WBC) — elevated may signal infection or leukemia; Platelets — low values (thrombocytopenia) increase bleeding risk; Hemoglobin (Hgb) — the oxygen-carrying protein in red cells; and Hematocrit (Hct). The CBC is essential for diagnosing anemia, infections, inflammatory conditions, and blood disorders."
  },
  {
    type: "tests",
    slug: "mri-scan",
    title: "Understanding MRI Scans",
    description: "How Magnetic Resonance Imaging works, preparation guidelines, metal contraindications, and what to expect during a scan.",
    content: "Magnetic Resonance Imaging (MRI) uses powerful magnetic fields and radio waves to create detailed 3D images of soft tissues, organs, and bones without ionizing radiation. MRI is superior to CT for imaging the brain, spinal cord, joints, and soft tissue tumors. Preparation: avoid eating for 4-6 hours before contrast MRI; remove all metal objects; inform your doctor if you have a pacemaker, cochlear implants, or surgical clips. The procedure is noisy (loud knocking sounds) and can take 30-90 minutes."
  },
  {
    type: "tests",
    slug: "ecg",
    title: "ECG / EKG Explained",
    description: "How an electrocardiogram works, what the waves represent, and what common ECG abnormalities mean for heart health.",
    content: "An Electrocardiogram (ECG/EKG) records the electrical activity of the heart using electrodes placed on the skin. It produces a tracing with waves: P wave (atrial depolarization/contraction), QRS complex (ventricular depolarization/heartbeat), and T wave (ventricular repolarization). Common findings include sinus tachycardia (fast rate), bradycardia (slow rate), ST elevation (possible heart attack), atrial fibrillation (irregular rhythm), and left ventricular hypertrophy. An ECG is the first-line test for evaluating chest pain, palpitations, and syncope."
  },
  {
    type: "tests",
    slug: "blood-pressure",
    title: "Blood Pressure Monitoring",
    description: "Learn how blood pressure is measured, what systolic and diastolic values mean, and how to interpret home readings accurately.",
    content: "Blood pressure (BP) is measured in millimeters of mercury (mmHg) and expressed as systolic/diastolic. Normal BP: < 120/80 mmHg. Elevated: 120-129/<80. Stage 1 Hypertension: 130-139/80-89. Stage 2 Hypertension: ≥140/≥90. Hypertensive Crisis: >180/>120 — requires emergency care. For accurate home monitoring: sit quietly for 5 minutes before measuring, use a properly-sized cuff, measure at the same time daily, and take 2-3 readings averaged. White coat hypertension (elevated readings only in clinical settings) is common."
  },
  {
    type: "tests",
    slug: "ct-scan",
    title: "CT Scan Guide",
    description: "Understanding computed tomography: how it works, radiation exposure, uses in emergency medicine, and contrast dye considerations.",
    content: "A CT (Computed Tomography) scan uses multiple X-ray beams from different angles to create detailed cross-sectional images of the body. It is faster than MRI and superior for imaging bones, lungs, abdominal organs, and vascular structures. Radiation exposure is higher than plain X-rays but is balanced against clinical necessity. Contrast dye (iodine-based) is often used to highlight blood vessels and tumors — patients with kidney disease or iodine allergy need pre-screening. CT is the first-line imaging for trauma, stroke workup, and pulmonary embolism."
  },
  {
    type: "tests",
    slug: "blood-glucose",
    title: "Blood Glucose Testing",
    description: "Learn about fasting blood glucose, post-meal glucose, A1C tests, and what target ranges mean for diabetes management.",
    content: "Blood glucose (blood sugar) can be measured in several ways: Fasting Plasma Glucose (FPG): Normal <100 mg/dL; Prediabetes 100-125 mg/dL; Diabetes ≥126 mg/dL. Random Plasma Glucose: Diabetes ≥200 mg/dL with symptoms. Oral Glucose Tolerance Test (OGTT): 2-hour value ≥200 mg/dL indicates diabetes. Glycated Hemoglobin (A1C): reflects 3-month average blood glucose — Normal <5.7%; Prediabetes 5.7-6.4%; Diabetes ≥6.5%. Self-monitoring blood glucose (SMBG) at home uses a glucometer and lancet."
  },

  // ---- TREATMENT GUIDES ----
  {
    type: "treatments",
    slug: "chemotherapy",
    title: "Chemotherapy Basics",
    description: "An educational guide on how chemotherapy drugs target cancer cells, common routes of administration, and managing side effects.",
    content: "Chemotherapy is a type of cancer treatment that uses powerful drugs to destroy rapidly dividing cancer cells throughout the body. It can be given intravenously (IV infusion), orally (pills), or directly to a specific body area. Side effects occur because chemotherapy also affects rapidly dividing healthy cells: hair follicles (hair loss), bone marrow (reduced immunity, anemia), and digestive tract (nausea, mouth sores). Modern antiemetic drugs significantly reduce nausea. Chemotherapy is often combined with surgery, radiation, or immunotherapy in multimodal treatment plans."
  },
  {
    type: "treatments",
    slug: "physical-therapy",
    title: "Physical Therapy & Rehabilitation",
    description: "How therapeutic exercises and manual treatments restore motion, strength, and ease recovery after injury or surgery.",
    content: "Physical therapy (PT) is a healthcare specialty that uses exercise, manual therapy, heat/cold, ultrasound, and electrical stimulation to help patients restore or improve movement and manage pain. PT is prescribed after orthopedic surgery (knee replacements, rotator cuff repair), neurological events (stroke rehabilitation), sports injuries, chronic pain (back pain, arthritis), and cardiopulmonary conditions. A licensed physiotherapist designs individualized programs progressing from gentle stretching to strengthening and functional exercises."
  },
  {
    type: "treatments",
    slug: "radiation-therapy",
    title: "Radiation Therapy Explained",
    description: "How radiation therapy destroys cancer cells, difference between external beam and brachytherapy, and what patients can expect.",
    content: "Radiation therapy (radiotherapy) uses high-energy radiation beams to damage the DNA of cancer cells, stopping their ability to reproduce. External Beam Radiation Therapy (EBRT) directs radiation from a machine outside the body. Brachytherapy places radioactive seeds directly inside or next to a tumor (used in prostate and cervical cancers). Stereotactic Radiosurgery (e.g., CyberKnife, Gamma Knife) delivers precisely targeted radiation in fewer sessions. Common side effects include fatigue and skin irritation in the treatment area."
  },
  {
    type: "treatments",
    slug: "immunotherapy",
    title: "Immunotherapy for Cancer",
    description: "How modern immunotherapy drugs (checkpoint inhibitors, CAR-T cells) harness the immune system to fight cancer.",
    content: "Immunotherapy works by helping your own immune system identify and destroy cancer cells. Checkpoint Inhibitors (e.g., pembrolizumab, nivolumab) block proteins (PD-1, CTLA-4) that cancer cells use to hide from immune attack. CAR-T Cell Therapy involves engineering a patient's own T-cells to express receptors targeting cancer cells — it has shown remarkable results in blood cancers. Monoclonal Antibodies directly target cancer cell proteins. Immunotherapy can cause immune-related adverse events (irAEs) where the immune system attacks healthy tissues."
  },
  {
    type: "treatments",
    slug: "dialysis",
    title: "Understanding Dialysis",
    description: "How hemodialysis and peritoneal dialysis replace kidney function for patients with kidney failure.",
    content: "Dialysis is a procedure that filters waste products and excess fluid from the blood when the kidneys can no longer perform this function adequately (End-Stage Renal Disease / ESRD). Hemodialysis uses a machine (dialyzer) to filter blood outside the body, typically done 3 times a week for 3-4 hours. Peritoneal Dialysis uses the lining of the abdominal cavity (peritoneum) as a natural filter, with fluid (dialysate) introduced and drained via a catheter — can be done at home. Dialysis is not a cure but a life-sustaining treatment."
  },
  {
    type: "treatments",
    slug: "surgery-types",
    title: "Types of Surgical Procedures",
    description: "From open surgery to laparoscopic, robotic, and minimally-invasive techniques — understand the differences and recovery times.",
    content: "Modern surgery encompasses multiple approaches: Open Surgery involves large incisions and direct visualization — used for complex procedures and emergencies. Laparoscopic (Keyhole) Surgery uses small incisions and a camera, resulting in faster recovery, less pain, and lower infection risk. Robotic Surgery (e.g., da Vinci system) uses robotic arms controlled by the surgeon for precision in confined anatomical spaces. Endoscopic procedures use natural body openings (mouth, rectum) for access. Minimally invasive techniques have shorter hospital stays and lower complication rates compared to open procedures."
  },
  {
    type: "treatments",
    slug: "cognitive-behavioral-therapy",
    title: "Cognitive Behavioral Therapy (CBT)",
    description: "How CBT helps treat depression, anxiety, PTSD, and phobias by changing negative thought patterns and behaviors.",
    content: "Cognitive Behavioral Therapy (CBT) is a structured, goal-oriented psychotherapy that helps patients identify and change negative or distorted thought patterns and behaviors that contribute to mental health conditions. It is evidence-based and recommended by the WHO and NICE for treating depression, generalized anxiety disorder, panic disorder, OCD, PTSD, phobias, and eating disorders. CBT typically runs for 12-20 sessions. Techniques include cognitive restructuring (challenging irrational thoughts), behavioral activation (increasing positive activities), and exposure therapy for phobias."
  },
  {
    type: "treatments",
    slug: "insulin-therapy",
    title: "Insulin Therapy Guide",
    description: "Types of insulin (rapid, short, intermediate, long-acting), injection techniques, storage, and blood sugar targets for diabetic patients.",
    content: "Insulin therapy is essential for Type 1 diabetes and used in advanced Type 2 diabetes. Types of insulin: Rapid-Acting (e.g., lispro, aspart) — works within 15 min, taken before meals; Short-Acting (Regular) — peaks at 2-4 hours; Intermediate-Acting (NPH) — lasts 12-18 hours; Long-Acting (glargine, detemir) — provides 24-hour background insulin. Injection sites: abdomen (fastest absorption), thighs, buttocks, upper arms. Rotate injection sites to prevent lipodystrophy. Store unopened insulin vials in the refrigerator; in-use pens/vials can be kept at room temperature for up to 28 days."
  }
];


async function seed() {
  console.log("Connecting to database...");
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log("Connected successfully!");
    
    const db = client.db(DB_NAME);
    
    // Clear collections
    console.log("Clearing collections...");
    await db.collection("categories").deleteMany({});
    await db.collection("diseases").deleteMany({});
    await db.collection("library").deleteMany({});
    
    // Insert categories
    console.log(`Inserting ${categories.length} categories...`);
    await db.collection("categories").insertMany(categories);
    
    // Insert diseases
    console.log(`Inserting ${allDiseases.length} diseases...`);
    await db.collection("diseases").insertMany(allDiseases);
    
    // Create index on slug and name (for search)
    console.log("Creating indexes...");
    await db.collection("categories").createIndex({ slug: 1 }, { unique: true });
    await db.collection("diseases").createIndex({ slug: 1 }, { unique: true });
    await db.collection("diseases").createIndex({ name: "text", overview: "text" });
    
    // Insert library guides
    console.log(`Inserting ${libraryData.length} library guides...`);
    await db.collection("library").insertMany(libraryData);
    await db.collection("library").createIndex({ slug: 1 }, { unique: true });

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await client.close();
  }
}

seed();
