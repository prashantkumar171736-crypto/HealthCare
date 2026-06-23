import HealthTipsClient from "./HealthTipsClient";

export const metadata = {
  title: "Health Tips & Wellness Guide | HealthEdu",
  description:
    "Evidence-based health tips covering nutrition, fitness, mental health, sleep hygiene, hydration, and disease prevention — sourced from WHO and NIH guidelines.",
};

export default function HealthTipsPage() {
  return <HealthTipsClient />;
}
