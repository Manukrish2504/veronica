import { Icon } from "@/components/mt/icon";

const MOTIFS: { name: string; x: string; y: string; size: number; dur: number; delay: number }[] = [
  { name: "work", x: "8%", y: "26%", size: 44, dur: 26, delay: 0 },
  { name: "trending_up", x: "18%", y: "62%", size: 40, dur: 30, delay: 3 },
  { name: "description", x: "46%", y: "10%", size: 38, dur: 24, delay: 1 },
  { name: "send", x: "86%", y: "22%", size: 42, dur: 28, delay: 5 },
  { name: "task_alt", x: "78%", y: "68%", size: 40, dur: 32, delay: 2 },
  { name: "chat_bubble", x: "60%", y: "80%", size: 36, dur: 27, delay: 4 },
  { name: "rocket_launch", x: "34%", y: "84%", size: 38, dur: 29, delay: 6 },
  { name: "tag", x: "92%", y: "50%", size: 34, dur: 25, delay: 7 },
];

/** Aurora glow + drifting outline motifs (MT_v2 LandingAmbient / MarketingMotifs, trimmed). */
export function Ambient() {
  return (
    <div className="landing-ambient" aria-hidden="true">
      <div className="landing-ambient__aurora landing-ambient__aurora--a" />
      <div className="landing-ambient__aurora landing-ambient__aurora--b" />
      <div className="landing-ambient__glow" />
      {MOTIFS.map((m) => (
        <span key={m.name} className="marketing-motif" style={{ left: m.x, top: m.y, ["--dur" as string]: `${m.dur}s`, ["--delay" as string]: `${m.delay}s` }}>
          <Icon name={m.name} size={m.size} weight={300} />
        </span>
      ))}
    </div>
  );
}
