import { render, screen } from "@testing-library/react-native";
import { ProgressCard } from "@/components/home/progress-card";
import type { GetPlayerCareer200 } from "@/api/generated/types/GetPlayerCareer";

const career = {
  overall: { campo_atacante: 84 },
  level: "ouro",
  matchesPlayed: 10,
  wins: 6,
  goals: 12,
  mvpCount: 3,
  currentStreak: 2,
  achievements: [],
} as unknown as GetPlayerCareer200;

describe("ProgressCard", () => {
  it("shows the Vitórias stat with win rate", () => {
    render(<ProgressCard career={career} />);
    expect(screen.getByText("% Vitórias")).toBeOnTheScreen();
    expect(screen.getByText("6")).toBeOnTheScreen(); // wins
    expect(screen.getByText("60%")).toBeOnTheScreen(); // 6/10
  });
});
