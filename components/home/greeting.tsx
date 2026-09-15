"use client";

/** Time-of-day greeting with the accent word in Playfair italic (MT_v2 Landing.tsx pickGreeting). */
export function Greeting({ firstName }: { firstName: string }) {
  const now = new Date();
  const h = now.getHours();
  const bucket = h < 5 ? "lateNight" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  const pools: Record<string, string[]> = {
    lateNight: [`Still up, ${firstName}?`, `Late-night applications, ${firstName}?`, `One more before bed, ${firstName}?`],
    morning: [`Morning, ${firstName}.`, `Fresh postings, ${firstName}.`, `Let's find the one, ${firstName}.`, `New day, new roles.`],
    afternoon: [`Afternoon, ${firstName}.`, `Back at it, ${firstName}.`, `What are we applying to, ${firstName}?`],
    evening: [`Evening, ${firstName}.`, `One more application, ${firstName}?`, `Still hunting, ${firstName}?`],
  };
  const pool = pools[bucket];
  const greeting = pool[now.getDate() % pool.length];
  const words = greeting.split(" ");
  const accent = words.pop() ?? "";
  const lead = words.join(" ");
  return (
    <h1 className="whitespace-nowrap leading-[1.05] tracking-tight font-medium" style={{ fontSize: "clamp(1.6rem, 4.6vw, 2.9rem)", letterSpacing: "-0.015em" }}>
      <span suppressHydrationWarning>{lead}{lead ? " " : ""}</span>
      <em className="greeting-accent" suppressHydrationWarning>{accent}</em>
    </h1>
  );
}
