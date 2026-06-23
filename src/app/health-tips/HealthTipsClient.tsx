"use client";

import { useState } from "react";

export default function HealthTipsClient() {
  const [activeCategory, setActiveCategory] = useState("all");

  const categories = [
    { id: "all", label: "All Tips", icon: "💡" },
    { id: "nutrition", label: "Nutrition", icon: "🥗" },
    { id: "fitness", label: "Fitness", icon: "🏃" },
    { id: "mental", label: "Mental Health", icon: "🧠" },
    { id: "sleep", label: "Sleep", icon: "😴" },
    { id: "prevention", label: "Prevention", icon: "🛡️" },
    { id: "hydration", label: "Hydration", icon: "💧" },
  ];

  const tips = [
    // Nutrition
    {
      id: 1,
      category: "nutrition",
      icon: "🥦",
      title: "Fill Half Your Plate with Vegetables",
      body: "At every meal, aim to fill at least half your plate with non-starchy vegetables like broccoli, spinach, kale, and peppers. These are rich in fiber, vitamins, minerals, and antioxidants while being low in calories.",
      tag: "Nutrition",
      tagColor: "#10b981",
    },
    {
      id: 2,
      category: "nutrition",
      icon: "🐟",
      title: "Eat Fatty Fish Twice a Week",
      body: "Fatty fish like salmon, mackerel, sardines, and trout are loaded with omega-3 fatty acids, which are essential for heart and brain health. The American Heart Association recommends two 3.5-oz servings per week.",
      tag: "Nutrition",
      tagColor: "#10b981",
    },
    {
      id: 3,
      category: "nutrition",
      icon: "🌾",
      title: "Choose Whole Grains Over Refined",
      body: "Switch from white rice, white bread, and refined pasta to brown rice, whole grain bread, oats, and quinoa. Whole grains preserve the fiber-rich bran and nutrient-dense germ, stabilizing blood sugar and supporting digestive health.",
      tag: "Nutrition",
      tagColor: "#10b981",
    },
    {
      id: 4,
      category: "nutrition",
      icon: "🧂",
      title: "Reduce Your Sodium Intake",
      body: "High sodium diets are a leading driver of hypertension (high blood pressure). WHO recommends less than 5g of salt per day. Reduce processed foods, read nutrition labels, and flavor your food with herbs and spices instead.",
      tag: "Nutrition",
      tagColor: "#10b981",
    },
    {
      id: 5,
      category: "nutrition",
      icon: "🫐",
      title: "Snack Smart with Berries",
      body: "Blueberries, strawberries, and raspberries are among the highest antioxidant-rich foods available. They combat oxidative stress linked to heart disease, diabetes, and cancer. Keep a bowl of mixed berries in the fridge for easy snacking.",
      tag: "Nutrition",
      tagColor: "#10b981",
    },
    {
      id: 6,
      category: "nutrition",
      icon: "🥑",
      title: "Include Healthy Fats Daily",
      body: "Not all fats are harmful. Monounsaturated and polyunsaturated fats found in avocados, olive oil, nuts, and seeds support heart health and help absorb fat-soluble vitamins (A, D, E, K). Aim for healthy fats as your primary fat source.",
      tag: "Nutrition",
      tagColor: "#10b981",
    },

    // Fitness
    {
      id: 7,
      category: "fitness",
      icon: "🚶",
      title: "Walk at Least 10,000 Steps Daily",
      body: "Walking is one of the most accessible and effective forms of exercise. Aim for 10,000 steps per day to improve cardiovascular health, manage weight, and boost mood. Use a pedometer app on your phone to track your daily steps.",
      tag: "Fitness",
      tagColor: "#0284c7",
    },
    {
      id: 8,
      category: "fitness",
      icon: "💪",
      title: "Strength Train Twice a Week",
      body: "Resistance or strength training builds muscle mass, which naturally declines with age (sarcopenia). The WHO recommends muscle-strengthening activities on 2 or more days per week, targeting all major muscle groups.",
      tag: "Fitness",
      tagColor: "#0284c7",
    },
    {
      id: 9,
      category: "fitness",
      icon: "🧘",
      title: "Stretch Every Morning",
      body: "A 5-10 minute morning stretching routine improves flexibility, reduces muscle stiffness, increases blood flow to muscles, and helps prevent injury. Focus on major muscle groups: hamstrings, quads, shoulders, and back.",
      tag: "Fitness",
      tagColor: "#0284c7",
    },
    {
      id: 10,
      category: "fitness",
      icon: "🚴",
      title: "Get 150 Minutes of Moderate Aerobic Exercise",
      body: "WHO guidelines recommend at least 150 minutes of moderate-intensity aerobic activity (like brisk walking or cycling) or 75 minutes of vigorous-intensity activity per week. Breaking it into 30-minute sessions, 5 days a week is an achievable target.",
      tag: "Fitness",
      tagColor: "#0284c7",
    },
    {
      id: 11,
      category: "fitness",
      icon: "🪑",
      title: "Break Up Prolonged Sitting",
      body: "Sitting for hours uninterrupted is linked to increased risks of obesity, type 2 diabetes, and cardiovascular disease even in people who exercise regularly. Set a reminder to stand or walk for 2-5 minutes every hour if you work a desk job.",
      tag: "Fitness",
      tagColor: "#0284c7",
    },

    // Mental Health
    {
      id: 12,
      category: "mental",
      icon: "🌿",
      title: "Practice Mindfulness for 10 Minutes Daily",
      body: "Mindfulness meditation — focusing your awareness on the present moment without judgment — has been clinically proven to reduce symptoms of anxiety and depression. Start with just 10 minutes a day using guided meditation apps.",
      tag: "Mental Health",
      tagColor: "#8b5cf6",
    },
    {
      id: 13,
      category: "mental",
      icon: "📓",
      title: "Keep a Gratitude Journal",
      body: "Writing down 3 things you are grateful for every day shifts your brain's focus toward positive experiences. Research shows this practice consistently reduces anxiety, improves sleep, and increases general life satisfaction over time.",
      tag: "Mental Health",
      tagColor: "#8b5cf6",
    },
    {
      id: 14,
      category: "mental",
      icon: "👥",
      title: "Nurture Social Connections",
      body: "Strong social relationships are one of the most powerful predictors of long-term physical and mental health. Loneliness increases mortality risk by 26%. Invest time in meaningful conversations, community activities, and building your support network.",
      tag: "Mental Health",
      tagColor: "#8b5cf6",
    },
    {
      id: 15,
      category: "mental",
      icon: "📵",
      title: "Take Regular Digital Detox Breaks",
      body: "Excessive screen time, especially on social media, is associated with increased anxiety, depression, and poor sleep. Schedule daily phone-free periods (e.g., during meals, one hour before bed) to protect your mental well-being.",
      tag: "Mental Health",
      tagColor: "#8b5cf6",
    },
    {
      id: 16,
      category: "mental",
      icon: "🎨",
      title: "Engage in a Creative Hobby",
      body: "Creative activities like painting, writing, gardening, cooking, or playing a musical instrument engage parts of the brain associated with flow states and reduce stress hormone levels. Even 30 minutes of creative engagement can noticeably lift your mood.",
      tag: "Mental Health",
      tagColor: "#8b5cf6",
    },

    // Sleep
    {
      id: 17,
      category: "sleep",
      icon: "🕙",
      title: "Maintain a Consistent Sleep Schedule",
      body: "Going to sleep and waking up at the same time every day — even on weekends — regulates your body's internal clock (circadian rhythm). Irregular sleep patterns are linked to metabolic disorders, heart disease, and mood disturbances.",
      tag: "Sleep",
      tagColor: "#f59e0b",
    },
    {
      id: 18,
      category: "sleep",
      icon: "🌙",
      title: "Create a Relaxing Pre-Sleep Routine",
      body: "In the 60 minutes before bed, avoid bright screens, heavy meals, and stressful activities. Replace these with calming rituals: reading a physical book, taking a warm shower, light stretching, or herbal tea. This signals your body to prepare for sleep.",
      tag: "Sleep",
      tagColor: "#f59e0b",
    },
    {
      id: 19,
      category: "sleep",
      icon: "❄️",
      title: "Keep Your Bedroom Cool and Dark",
      body: "Your core body temperature needs to drop slightly to initiate sleep. The optimal bedroom temperature for sleep is 15–19°C (60–67°F). Use blackout curtains or a sleep mask to block light, and consider a white noise machine to reduce sound disturbances.",
      tag: "Sleep",
      tagColor: "#f59e0b",
    },
    {
      id: 20,
      category: "sleep",
      icon: "☕",
      title: "Stop Caffeine by 2 PM",
      body: "Caffeine has a half-life of approximately 5-6 hours in the body. Drinking coffee or caffeinated tea after 2 PM can still be significantly affecting your nervous system at midnight. Switch to herbal tea or decaf after lunch.",
      tag: "Sleep",
      tagColor: "#f59e0b",
    },

    // Prevention
    {
      id: 21,
      category: "prevention",
      icon: "💉",
      title: "Stay Up to Date on Vaccinations",
      body: "Vaccines are one of the most effective public health interventions ever developed. Keep your flu shot, COVID-19 boosters, tetanus, and hepatitis B vaccinations up to date. Consult your doctor about age-specific vaccine recommendations.",
      tag: "Prevention",
      tagColor: "#ef4444",
    },
    {
      id: 22,
      category: "prevention",
      icon: "🩺",
      title: "Schedule Annual Health Check-Ups",
      body: "Preventive screenings can detect conditions like high blood pressure, high cholesterol, diabetes, and certain cancers before they cause symptoms. Regular check-ups (blood pressure, fasting glucose, cholesterol, BMI, and cancer screenings) are critical for long-term health.",
      tag: "Prevention",
      tagColor: "#ef4444",
    },
    {
      id: 23,
      category: "prevention",
      icon: "🚭",
      title: "Quit Smoking — The Single Best Health Choice",
      body: "Smoking is the leading cause of preventable death worldwide, linked to lung cancer, heart disease, COPD, and stroke. Within 20 minutes of quitting, heart rate and blood pressure drop. Within 10 years, lung cancer risk is cut in half. Speak to your doctor about cessation support.",
      tag: "Prevention",
      tagColor: "#ef4444",
    },
    {
      id: 24,
      category: "prevention",
      icon: "🧴",
      title: "Wash Your Hands Frequently",
      body: "Handwashing with soap for at least 20 seconds is one of the most effective ways to prevent the spread of respiratory infections, gastrointestinal diseases, and skin infections. Always wash before eating, after using the restroom, and after being in public.",
      tag: "Prevention",
      tagColor: "#ef4444",
    },
    {
      id: 25,
      category: "prevention",
      icon: "☀️",
      title: "Apply SPF 30+ Sunscreen Daily",
      body: "UV radiation exposure is the primary cause of melanoma (skin cancer), premature aging, and sunburn. Apply broad-spectrum SPF 30+ sunscreen 15 minutes before sun exposure, and reapply every 2 hours. This habit is important even on cloudy days.",
      tag: "Prevention",
      tagColor: "#ef4444",
    },

    // Hydration
    {
      id: 26,
      category: "hydration",
      icon: "💧",
      title: "Drink 8 Glasses of Water Daily",
      body: "Water is essential for virtually every body function — regulating temperature, flushing toxins, lubricating joints, and enabling cellular processes. The general recommendation is eight 8-ounce glasses (about 2 liters) per day, though individual needs vary by climate and activity.",
      tag: "Hydration",
      tagColor: "#0d9488",
    },
    {
      id: 27,
      category: "hydration",
      icon: "🍋",
      title: "Start Your Morning with Lemon Water",
      body: "Drinking a glass of warm water with freshly squeezed lemon juice first thing in the morning stimulates digestion, provides a dose of vitamin C, and helps rehydrate your body after overnight water loss. It's a simple ritual with compounding health benefits.",
      tag: "Hydration",
      tagColor: "#0d9488",
    },
    {
      id: 28,
      category: "hydration",
      icon: "🍵",
      title: "Count Herbal Teas Toward Daily Fluid Goals",
      body: "Herbal teas (chamomile, peppermint, ginger, hibiscus) are calorie-free and contribute to your daily fluid intake. Many also offer anti-inflammatory and digestive benefits. They are a great caffeine-free alternative to keeping hydrated throughout the day.",
      tag: "Hydration",
      tagColor: "#0d9488",
    },
    {
      id: 29,
      category: "hydration",
      icon: "🍉",
      title: "Eat Water-Rich Foods",
      body: "Up to 20% of our daily water intake comes from food. Water-rich foods like watermelon, cucumber, celery, strawberries, oranges, and lettuce contribute significantly to hydration. Including more of these in your diet makes meeting fluid targets much easier.",
      tag: "Hydration",
      tagColor: "#0d9488",
    },
    {
      id: 30,
      category: "hydration",
      icon: "⚡",
      title: "Recognize the Signs of Dehydration",
      body: "Mild dehydration — defined as a loss of just 1-2% of body weight in water — can impair cognitive performance, cause headaches, reduce energy, and lead to false hunger signals. Key signs include dark yellow urine, dry mouth, fatigue, and dizziness. Don't wait until you're thirsty.",
      tag: "Hydration",
      tagColor: "#0d9488",
    },
  ];

  const filteredTips =
    activeCategory === "all"
      ? tips
      : tips.filter((t) => t.category === activeCategory);

  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "80vh" }}>
      {/* Hero Banner */}
      <section
        style={{
          background:
            "linear-gradient(135deg, var(--primary-light) 0%, transparent 60%)",
          padding: "4rem 0 3rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container text-center">
          <span className="disease-badge">Wellness Guide</span>
          <h1
            style={{
              marginTop: "0.75rem",
              fontSize: "3rem",
              marginBottom: "1rem",
            }}
          >
            Health Tips & Wellness
          </h1>
          <p
            className="text-muted"
            style={{ maxWidth: "600px", margin: "0 auto", fontSize: "1.15rem" }}
          >
            Evidence-based lifestyle tips to improve nutrition, fitness, mental
            health, sleep, and disease prevention — curated from WHO, NIH, and
            Mayo Clinic guidelines.
          </p>
        </div>
      </section>

      {/* Category Filter Tabs */}
      <section
        style={{
          padding: "2.5rem 0",
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: "70px",
          zIndex: 10,
        }}
      >
        <div
          className="container flex-center"
          style={{ flexWrap: "wrap", gap: "0.75rem" }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="btn btn-secondary btn-sm"
              style={{
                backgroundColor:
                  activeCategory === cat.id ? "var(--primary)" : "",
                color: activeCategory === cat.id ? "#fff" : "",
                borderColor: activeCategory === cat.id ? "var(--primary)" : "",
                padding: "0.6rem 1.25rem",
                borderRadius: "var(--radius-full)",
                fontWeight: 600,
                transition: "all 0.25s ease",
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tips Grid */}
      <section style={{ padding: "4rem 0" }}>
        <div className="container">
          <p
            className="text-muted"
            style={{ marginBottom: "2.5rem", textAlign: "center" }}
          >
            Showing{" "}
            <strong style={{ color: "var(--text-main)" }}>
              {filteredTips.length}
            </strong>{" "}
            health tips
            {activeCategory !== "all" ? (
              <>
                {" "}
                in{" "}
                <strong style={{ color: "var(--primary)" }}>
                  {categories.find((c) => c.id === activeCategory)?.label}
                </strong>
              </>
            ) : (
              ""
            )}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {filteredTips.map((tip) => (
              <div
                key={tip.id}
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-xl)",
                  padding: "2rem",
                  boxShadow: "var(--shadow-sm)",
                  transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                  cursor: "default",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  borderTop: `4px solid ${tip.tagColor}`,
                }}
                className="health-tip-card"
              >
                {/* Icon & Tag Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "2.5rem" }}>{tip.icon}</span>
                  <span
                    style={{
                      padding: "0.3rem 0.8rem",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      backgroundColor: `${tip.tagColor}18`,
                      color: tip.tagColor,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {tip.tag}
                  </span>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                    margin: 0,
                  }}
                >
                  {tip.title}
                </h3>

                {/* Body */}
                <p
                  style={{
                    fontSize: "0.92rem",
                    color: "var(--text-muted)",
                    lineHeight: "1.7",
                    margin: 0,
                    flexGrow: 1,
                  }}
                >
                  {tip.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          padding: "5rem 0",
          backgroundColor: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="container text-center" style={{ maxWidth: "700px" }}>
          <span style={{ fontSize: "3rem" }}>❤️</span>
          <h2 style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            Good Health Starts With Small Habits
          </h2>
          <p
            className="text-muted"
            style={{ fontSize: "1.1rem", marginBottom: "2rem" }}
          >
            HealthEdu is committed to providing free, evidence-based health
            education so everyone can make informed choices for a healthier life.
            Support our mission by donating today.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/diseases" className="btn btn-secondary">
              Explore Disease Directory
            </a>
            <a href="/donate" className="btn btn-accent btn-accent-glow">
              Support Us ❤️
            </a>
          </div>
        </div>
      </section>

      <style>{`
        .health-tip-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }
        @media (max-width: 768px) {
          [style*="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))"] {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
