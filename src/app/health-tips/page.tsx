import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import HealthTipsClient from "./HealthTipsClient";

export const metadata: Metadata = {
  title: "Health Tips & Wellness Guide | Rog Care Hindi",
  description:
    "Evidence-based health tips covering nutrition, fitness, mental health, sleep hygiene, hydration, and disease prevention — sourced from WHO and NIH guidelines.",
  keywords: [
    "health tips", "wellness guide", "nutrition tips", "fitness tips", "mental health tips",
    "sleep hygiene", "disease prevention", "healthy lifestyle", "WHO health guidelines",
    "NIH health tips", "Rog Care Hindi", "rogcarehindi",
    "स्वास्थ्य टिप्स", "स्वस्थ जीवन", "पोषण", "मानसिक स्वास्थ्य", "व्यायाम",
  ],
  alternates: { canonical: "/health-tips" },
  openGraph: {
    title: "Health Tips & Wellness Guide | Rog Care Hindi",
    description:
      "Evidence-based health tips covering nutrition, fitness, mental health, sleep hygiene, hydration, and disease prevention — sourced from WHO and NIH.",
    url: "https://rogcarehindi.vercel.app/health-tips",
    siteName: "Rog Care Hindi",
    type: "website",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "Health Tips & Wellness — Rog Care Hindi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Health Tips & Wellness Guide | Rog Care Hindi",
    description: "Evidence-based health tips on nutrition, fitness, sleep, mental health, and disease prevention.",
    images: ["/logo.png"],
  },
};

const DEFAULT_TIPS = [
  // Nutrition
  {
    category: "nutrition",
    icon: "🥦",
    title: "Fill Half Your Plate with Vegetables",
    body: "At every meal, aim to fill at least half your plate with non-starchy vegetables like broccoli, spinach, kale, and peppers. These are rich in fiber, vitamins, minerals, and antioxidants while being low in calories.",
    tag: "Nutrition",
    tagColor: "#10b981",
  },
  {
    category: "nutrition",
    icon: "🐟",
    title: "Eat Fatty Fish Twice a Week",
    body: "Fatty fish like salmon, mackerel, sardines, and trout are loaded with omega-3 fatty acids, which are essential for heart and brain health. The American Heart Association recommends two 3.5-oz servings per week.",
    tag: "Nutrition",
    tagColor: "#10b981",
  },
  {
    category: "nutrition",
    icon: "🌾",
    title: "Choose Whole Grains Over Refined",
    body: "Switch from white rice, white bread, and refined pasta to brown rice, whole grain bread, oats, and quinoa. Whole grains preserve the fiber-rich bran and nutrient-dense germ, stabilizing blood sugar and supporting digestive health.",
    tag: "Nutrition",
    tagColor: "#10b981",
  },
  {
    category: "nutrition",
    icon: "🧂",
    title: "Reduce Your Sodium Intake",
    body: "High sodium diets are a leading driver of hypertension (high blood pressure). WHO recommends less than 5g of salt per day. Reduce processed foods, read nutrition labels, and flavor your food with herbs and spices instead.",
    tag: "Nutrition",
    tagColor: "#10b981",
  },
  {
    category: "nutrition",
    icon: "🫐",
    title: "Snack Smart with Berries",
    body: "Blueberries, strawberries, and raspberries are among the highest antioxidant-rich foods available. They combat oxidative stress linked to heart disease, diabetes, and cancer. Keep a bowl of mixed berries in the fridge for easy snacking.",
    tag: "Nutrition",
    tagColor: "#10b981",
  },
  {
    category: "nutrition",
    icon: "🥑",
    title: "Include Healthy Fats Daily",
    body: "Not all fats are harmful. Monounsaturated and polyunsaturated fats found in avocados, olive oil, nuts, and seeds support heart health and help absorb fat-soluble vitamins (A, D, E, K). Aim for healthy fats as your primary fat source.",
    tag: "Nutrition",
    tagColor: "#10b981",
  },

  // Fitness
  {
    category: "fitness",
    icon: "🚶",
    title: "Walk at Least 10,000 Steps Daily",
    body: "Walking is one of the most accessible and effective forms of exercise. Aim for 10,000 steps per day to improve cardiovascular health, manage weight, and boost mood. Use a pedometer app on your phone to track your daily steps.",
    tag: "Fitness",
    tagColor: "#0284c7",
  },
  {
    category: "fitness",
    icon: "💪",
    title: "Strength Train Twice a Week",
    body: "Resistance or strength training builds muscle mass, which naturally declines with age (sarcopenia). The WHO recommends muscle-strengthening activities on 2 or more days per week, targeting all major muscle groups.",
    tag: "Fitness",
    tagColor: "#0284c7",
  },
  {
    category: "fitness",
    icon: "🧘",
    title: "Stretch Every Morning",
    body: "A 5-10 minute morning stretching routine improves flexibility, reduces muscle stiffness, increases blood flow to muscles, and helps prevent injury. Focus on major muscle groups: hamstrings, quads, shoulders, and back.",
    tag: "Fitness",
    tagColor: "#0284c7",
  },
  {
    category: "fitness",
    icon: "🚴",
    title: "Get 150 Minutes of Moderate Aerobic Exercise",
    body: "WHO guidelines recommend at least 150 minutes of moderate-intensity aerobic activity (like brisk walking or cycling) or 75 minutes of vigorous-intensity activity per week. Breaking it into 30-minute sessions, 5 days a week is an achievable target.",
    tag: "Fitness",
    tagColor: "#0284c7",
  },
  {
    category: "fitness",
    icon: "🪑",
    title: "Break Up Prolonged Sitting",
    body: "Sitting for hours uninterrupted is linked to increased risks of obesity, type 2 diabetes, and cardiovascular disease even in people who exercise regularly. Set a reminder to stand or walk for 2-5 minutes every hour if you work a desk job.",
    tag: "Fitness",
    tagColor: "#0284c7",
  },

  // Mental Health
  {
    category: "mental",
    icon: "🌿",
    title: "Practice Mindfulness for 10 Minutes Daily",
    body: "Mindfulness meditation — focusing your awareness on the present moment without judgment — has been clinically proven to reduce symptoms of anxiety and depression. Start with just 10 minutes a day using guided meditation apps.",
    tag: "Mental Health",
    tagColor: "#8b5cf6",
  },
  {
    category: "mental",
    icon: "📓",
    title: "Keep a Gratitude Journal",
    body: "Writing down 3 things you are grateful for every day shifts your brain's focus toward positive experiences. Research shows this practice consistently reduces anxiety, improves sleep, and increases general life satisfaction over time.",
    tag: "Mental Health",
    tagColor: "#8b5cf6",
  },
  {
    category: "mental",
    icon: "👥",
    title: "Nurture Social Connections",
    body: "Strong social relationships are one of the most powerful predictors of long-term physical and mental health. Loneliness increases mortality risk by 26%. Invest time in meaningful conversations, community activities, and building your support network.",
    tag: "Mental Health",
    tagColor: "#8b5cf6",
  },
  {
    category: "mental",
    icon: "👥",
    title: "Nurture Social Connections",
    body: "Strong social relationships are one of the most powerful predictors of long-term physical and mental health. Loneliness increases mortality risk by 26%. Invest time in meaningful conversations, community activities, and building your support network.",
    tag: "Mental Health",
    tagColor: "#8b5cf6",
  },
  {
    category: "mental",
    icon: "📵",
    title: "Take Regular Digital Detox Breaks",
    body: "Excessive screen time, especially on social media, is associated with increased anxiety, depression, and poor sleep. Schedule daily phone-free periods (e.g., during meals, one hour before bed) to protect your mental well-being.",
    tag: "Mental Health",
    tagColor: "#8b5cf6",
  },
  {
    category: "mental",
    icon: "🎨",
    title: "Engage in a Creative Hobby",
    body: "Creative activities like painting, writing, gardening, cooking, or playing a musical instrument engage parts of the brain associated with flow states and reduce stress hormone levels. Even 30 minutes of creative engagement can noticeably lift your mood.",
    tag: "Mental Health",
    tagColor: "#8b5cf6",
  },

  // Sleep
  {
    category: "sleep",
    icon: "🕙",
    title: "Maintain a Consistent Sleep Schedule",
    body: "Going to sleep and waking up at the same time every day — even on weekends — regulates your body's internal clock (circadian rhythm). Irregular sleep patterns are linked to metabolic disorders, heart disease, and mood disturbances.",
    tag: "Sleep",
    tagColor: "#f59e0b",
  },
  {
    category: "sleep",
    icon: "🌙",
    title: "Create a Relaxing Pre-Sleep Routine",
    body: "In the 60 minutes before bed, avoid bright screens, heavy meals, and stressful activities. Replace these with calming rituals: reading a physical book, taking a warm shower, light stretching, or herbal tea. This signals your body to prepare for sleep.",
    tag: "Sleep",
    tagColor: "#f59e0b",
  },
  {
    category: "sleep",
    icon: "❄️",
    title: "Keep Your Bedroom Cool and Dark",
    body: "Your core body temperature needs to drop slightly to initiate sleep. The optimal bedroom temperature for sleep is 15–19°C (60–67°F). Use blackout curtains or a sleep mask to block light, and consider a white noise machine to reduce sound disturbances.",
    tag: "Sleep",
    tagColor: "#f59e0b",
  },
  {
    category: "sleep",
    icon: "☕",
    title: "Stop Caffeine by 2 PM",
    body: "Caffeine has a half-life of approximately 5-6 hours in the body. Drinking coffee or caffeinated tea after 2 PM can still be significantly affecting your nervous system at midnight. Switch to herbal tea or decaf after lunch.",
    tag: "Sleep",
    tagColor: "#f59e0b",
  },

  // Prevention
  {
    category: "prevention",
    icon: "💉",
    title: "Stay Up to Date on Vaccinations",
    body: "Vaccines are one of the most effective public health interventions ever developed. Keep your flu shot, COVID-19 boosters, tetanus, and hepatitis B vaccinations up to date. Consult your doctor about age-specific vaccine recommendations.",
    tag: "Prevention",
    tagColor: "#ef4444",
  },
  {
    category: "prevention",
    icon: "🩺",
    title: "Schedule Annual Health Check-Ups",
    body: "Preventive screenings can detect conditions like high blood pressure, high cholesterol, diabetes, and certain cancers before they cause symptoms. Regular check-ups (blood pressure, fasting glucose, cholesterol, BMI, and cancer screenings) are critical for long-term health.",
    tag: "Prevention",
    tagColor: "#ef4444",
  },
  {
    category: "prevention",
    icon: "🚭",
    title: "Quit Smoking — The Single Best Health Choice",
    body: "Smoking is the leading cause of preventable death worldwide, linked to lung cancer, heart disease, COPD, and stroke. Within 20 minutes of quitting, heart rate and blood pressure drop. Within 10 years, lung cancer risk is cut in half. Speak to your doctor about cessation support.",
    tag: "Prevention",
    tagColor: "#ef4444",
  },
  {
    category: "prevention",
    icon: "🧴",
    title: "Wash Your Hands Frequently",
    body: "Handwashing with soap for at least 20 seconds is one of the most effective ways to prevent the spread of respiratory infections, gastrointestinal diseases, and skin infections. Always wash before eating, after using the restroom, and after being in public.",
    tag: "Prevention",
    tagColor: "#ef4444",
  },
  {
    category: "prevention",
    icon: "☀️",
    title: "Apply SPF 30+ Sunscreen Daily",
    body: "UV radiation exposure is the primary cause of melanoma (skin cancer), premature aging, and sunburn. Apply broad-spectrum SPF 30+ sunscreen 15 minutes before sun exposure, and reapply every 2 hours. This habit is important even on cloudy days.",
    tag: "Prevention",
    tagColor: "#ef4444",
  },

  // Hydration
  {
    category: "hydration",
    icon: "💧",
    title: "Drink 8 Glasses of Water Daily",
    body: "Water is essential for virtually every body function — regulating temperature, flushing toxins, lubricating joints, and enabling cellular processes. The general recommendation is eight 8-ounce glasses (about 2 liters) per day, though individual needs vary by climate and activity.",
    tag: "Hydration",
    tagColor: "#0d9488",
  },
  {
    category: "hydration",
    icon: "🍋",
    title: "Start Your Morning with Lemon Water",
    body: "Drinking a glass of warm water with freshly squeezed lemon juice first thing in the morning stimulates digestion, provides a dose of vitamin C, and helps rehydrate your body after overnight water loss. It's a simple ritual with compounding health benefits.",
    tag: "Hydration",
    tagColor: "#0d9488",
  },
  {
    category: "hydration",
    icon: "🍵",
    title: "Count Herbal Teas Toward Daily Fluid Goals",
    body: "Herbal teas (chamomile, peppermint, ginger, hibiscus) are calorie-free and contribute to your daily fluid intake. Many also offer anti-inflammatory and digestive benefits. They are a great caffeine-free alternative to keeping hydrated throughout the day.",
    tag: "Hydration",
    tagColor: "#0d9488",
  },
  {
    category: "hydration",
    icon: "🍉",
    title: "Eat Water-Rich Foods",
    body: "Up to 20% of our daily water intake comes from food. Water-rich foods like watermelon, cucumber, celery, strawberries, oranges, and lettuce contribute significantly to hydration. Including more of these in your diet makes meeting fluid targets much easier.",
    tag: "Hydration",
    tagColor: "#0d9488",
  },
  {
    category: "hydration",
    icon: "⚡",
    title: "Recognize the Signs of Dehydration",
    body: "Mild dehydration — defined as a loss of just 1-2% of body weight in water — can impair cognitive performance, cause headaches, reduce energy, and lead to false hunger signals. Key signs include dark yellow urine, dry mouth, fatigue, and dizziness. Don't wait until you're thirsty.",
    tag: "Hydration",
    tagColor: "#0d9488",
  },
];

export default async function HealthTipsPage() {
  let tips = [];

  try {
    const db = await getDb();
    tips = await db.collection("tips").find({}).toArray();

    if (tips.length === 0) {
      await db.collection("tips").insertMany(DEFAULT_TIPS);
      tips = await db.collection("tips").find({}).toArray();
    }
  } catch (error) {
    console.error("Health Tips DB Query Error:", error);
    tips = DEFAULT_TIPS;
  }

  const serializedTips = tips.map((tip: any, index: number) => ({
    id: tip.id || index + 1,
    category: tip.category,
    icon: tip.icon,
    title: tip.title,
    body: tip.body,
    tag: tip.tag,
    tagColor: tip.tagColor,
  }));

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Health Tips & Wellness Guide",
    "description": "Evidence-based health tips from WHO and NIH guidelines",
    "url": "https://rogcarehindi.vercel.app/health-tips",
    "numberOfItems": serializedTips.length,
    "itemListElement": serializedTips.map((tip, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": tip.title,
      "description": tip.body,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://rogcarehindi.vercel.app" },
      { "@type": "ListItem", "position": 2, "name": "Health Tips", "item": "https://rogcarehindi.vercel.app/health-tips" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <HealthTipsClient tips={serializedTips} />
    </>
  );
}
