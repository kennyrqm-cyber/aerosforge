import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ContentStatus } from "../generated/prisma/client";
import { normalizeDatabaseUrl } from "../lib/database-url";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: normalizeDatabaseUrl(connectionString) }) });

const lessons = [
  ["helicopter-fundamentals", "Helicopter Fundamentals", "What makes a helicopter fly?", "Aerodynamics"],
  ["flight-controls", "Flight Controls", "Cyclic, collective, pedals and power controls.", "Controls"],
  ["rotor-systems", "Rotor Systems", "Main rotor, tail rotor and rotor dynamics.", "Systems"],
  ["engines-powerplants", "Engines & Powerplants", "Piston and turbine fundamentals.", "Systems"],
  ["aerodynamics-i", "Aerodynamics I", "Lift, drag, thrust, weight and induced flow.", "Aerodynamics"],
  ["translational-lift", "Translational Lift", "Why effective translational lift changes helicopter performance.", "Aerodynamics"],
  ["retreating-blade-stall", "Retreating Blade Stall", "Recognition, causes and risk management.", "Aerodynamics"],
  ["lte-awareness", "LTE Awareness", "Loss of tail-rotor effectiveness: recognition and prevention.", "Safety"],
  ["autorotation", "Autorotation", "Core concepts, energy management and training context.", "Emergencies"],
  ["weight-balance", "Weight & Balance", "Loading, CG and performance implications.", "Performance"],
  ["performance", "Performance", "Density altitude, power available and power required.", "Performance"],
  ["ground-procedures", "Ground Procedures", "Preflight preparation and disciplined ground operations.", "Operations"],
  ["flight-planning", "Flight Planning", "Mission planning, fuel, alternates and risk controls.", "Planning"],
  ["weather-fundamentals", "Weather Fundamentals", "Wind, pressure, fronts and operational hazards.", "Weather"],
  ["density-altitude", "Density Altitude", "How heat, elevation and humidity affect performance.", "Weather"],
  ["airspace", "Airspace", "Classes, VFR concepts and operating considerations.", "Regulations"],
  ["charts-navigation", "Charts & Navigation", "Reading charts, headings and navigation planning.", "Navigation"],
  ["radio-communications", "Radio Communications", "Clear, concise aviation communication fundamentals.", "Communications"],
  ["human-factors", "Human Factors", "Fatigue, workload, stress and human performance.", "Human Factors"],
  ["adm-risk-management", "ADM & Risk Management", "Identify hazards, assess risk, mitigate and decide.", "Safety"],
  ["emergency-priorities", "Emergency Priorities", "A structured approach to abnormal and emergency situations.", "Emergencies"],
  ["night-operations", "Night Operations", "Planning and risk considerations for night flying.", "Operations"],
  ["mountain-flying", "Mountain Flying", "Terrain, weather and performance considerations.", "Advanced"],
  ["confined-area-operations", "Confined Area Operations", "Performance, escape options and risk assessment.", "Advanced"],
  ["slope-operations", "Slope Operations", "Control considerations and hazard awareness.", "Advanced"],
  ["instrument-fundamentals", "Instrument Fundamentals", "Instrument scan, attitude awareness and training context.", "Instrument"],
  ["professional-pilot-mindset", "Professional Pilot Mindset", "Standards, discipline, communication and judgment.", "Career"],
  ["commercial-pilot-path", "Commercial Pilot Path", "How knowledge, experience and proficiency fit together.", "Career"],
  ["cfi-foundations", "CFI Foundations", "Teaching concepts, briefing structure and student feedback.", "Instructor"],
  ["career-launch", "Career Launch", "Build a professional profile and prepare for the helicopter industry.", "Career"]
] as const;

async function main() {
  for (const [slug, title, summary, category] of lessons) {
    const data = { slug, order: lessons.findIndex((x) => x[0] === slug) + 1, title, summary, category };
    await db.lesson.upsert({
      where: { slug },
      update: data,
      create: {
        ...data,
        status: ContentStatus.DRAFT,
        sourceNotes: "Migrated from the static MVP. Requires qualified aviation-instructor review before publication."
      }
    });
  }

  for (const badge of [
    { key: "first-lesson", name: "First Lift", description: "Complete your first AEROSFORGE lesson.", icon: "🚁" },
    { key: "five-lessons", name: "Rotor Builder", description: "Complete five lessons.", icon: "⚙️" },
    { key: "gauntlet-first", name: "Decision Maker", description: "Complete your first Gauntlet scenario.", icon: "🧭" },
    { key: "academy-complete", name: "Academy 30", description: "Complete all 30 core lessons.", icon: "🏆" }
  ]) await db.badge.upsert({ where: { key: badge.key }, update: badge, create: badge });

  for (const resource of [
    { slug: "helicopter-flying-handbook", title: "Helicopter Flying Handbook", description: "FAA helicopter knowledge foundation.", url: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/helicopter_flying_handbook" },
    { slug: "faa-aviation-handbooks", title: "FAA Aviation Handbooks & Manuals", description: "Official FAA aviation handbook library.", url: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation" },
    { slug: "phak", title: "Pilot's Handbook of Aeronautical Knowledge", description: "Broad pilot knowledge reference.", url: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak" },
    { slug: "wings", title: "FAA WINGS", description: "Official Pilot Proficiency Program.", url: "https://www.faa.gov/newsroom/safety-briefing/wings-pilot-proficiency-program" }
  ]) await db.fAAResource.upsert({ where: { slug: resource.slug }, update: resource, create: resource });

  await db.gauntletScenario.upsert({
    where: { slug: "density-altitude-fuel-escape-options" },
    update: {},
    create: {
      slug: "density-altitude-fuel-escape-options",
      title: "High Density Altitude Decision",
      prompt: "Wind is changing, fuel is nearing your personal minimum, density altitude is high, and the landing area offers limited escape options. What is the strongest risk-management decision?",
      choices: [
        { key: "A", text: "Continue because the destination is close." },
        { key: "B", text: "Reassess margins and discontinue or divert before options narrow further." },
        { key: "C", text: "Land immediately at the original site regardless of escape path." }
      ],
      correctChoiceKey: "B",
      explanation: "Good ADM protects margins before conditions force the decision. A qualified CFI must review this scenario before publication.",
      riskCategory: "ADM",
      difficulty: 2,
      xpValue: 100,
      status: ContentStatus.DRAFT
    }
  });
}

main().then(() => db.$disconnect()).catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });
