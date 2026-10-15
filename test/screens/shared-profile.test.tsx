import { screen } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import SharedProfileScreen from "@/app/j/[slug]";
import { resetGroupsMocks, setPublicProfileMock } from "../mocks/handlers";
import { renderWithProviders } from "../utils/render";

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: jest.fn(() => ({ slug: "romario-abc123" })),
    useRouter: jest.fn(() => ({ back: jest.fn(), canGoBack: jest.fn(() => false), push: jest.fn(), replace: jest.fn() })),
  };
});

describe("Landing pública de /j/:slug (deep link, sem login)", () => {
  beforeEach(() => {
    resetGroupsMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ slug: "romario-abc123" });
  });

  it("renders the shared player's public card by slug, no auth required", async () => {
    setPublicProfileMock("romario-abc123", {
      playerId: "player-2",
      name: "Romário",
      level: "ouro",
      overallByPosition: { campo_goleiro: 88 },
      bestOverall: 88,
      bestPosition: "campo_goleiro",
      matchesPlayed: 20,
      wins: 15,
      draws: 2,
      losses: 3,
      winRate: 0.75,
      goals: 0,
      assists: 1,
      cleanSheets: 10,
      mvpCount: 5,
      currentStreak: 6,
      bestStreak: 8,
      achievements: [],
      reputation: {},
      trophies: [],
    });

    renderWithProviders(<SharedProfileScreen />);

    // "Romário" aparece 2x: título do `ScreenHeader` (vem do `profile.name`
    // carregado, já que — ao contrário de `player/[playerId]`, que recebe o
    // nome via query param — essa tela só conhece o `slug`) + nome no hero
    // do `PlayerCard`.
    expect(await screen.findAllByText("Romário")).toHaveLength(2);
    expect(await screen.findByText("Ouro")).toBeOnTheScreen();
    expect(screen.getAllByText("88")).toHaveLength(2);
    expect(screen.getByText("Goleiro")).toBeOnTheScreen();
    expect(screen.getByText("Sem sofrer gol")).toBeOnTheScreen();
    expect(screen.getByText("10")).toBeOnTheScreen();
  });

  it("shows the load-error state (with retry) for a slug that resolves to nothing", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ slug: "does-not-exist" });

    renderWithProviders(<SharedProfileScreen />);

    expect(await screen.findByText("Não foi possível carregar este jogador.")).toBeOnTheScreen();
  });
});
