import type { ReactNode } from "react";
import { screen, userEvent } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import GroupDetailScreen from "@/app/group/[id]";
import {
  FAKE_MEMBER,
  resetGroupsMocks,
  setGroupReputationMock,
} from "../mocks/handlers";
import { renderWithProviders } from "../utils/render";

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: jest.fn(() => ({ id: "group-1" })),
  };
});

// O organizador (dono do grupo mock, user-1) precisa estar logado pra a
// reputação por membro ser buscada.
jest.mock("@/hooks/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Alice", email: "alice@futebol.app" },
    isLoading: false,
    isAuthenticated: true,
  }),
  AuthProvider: function AuthProvider({ children }: { children: ReactNode }) {
    return children;
  },
}));

describe("Reputação por membro (visão do organizador)", () => {
  beforeEach(() => {
    resetGroupsMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: "group-1" });
  });

  it("shows pontualidade/compromisso counts for a member with reputation tags", async () => {
    setGroupReputationMock("group-1", [
      {
        playerId: FAKE_MEMBER.player.id,
        name: FAKE_MEMBER.player.name,
        reputation: {
          pontualidade: 12,
          educacao: 0,
          compromisso: 9,
          respeito: 0,
        },
      },
    ]);

    const user = userEvent.setup();
    renderWithProviders(<GroupDetailScreen />);

    await user.press(screen.getByText("Jogadores"));

    expect(await screen.findByText("Zico")).toBeOnTheScreen();
    expect(await screen.findByText("Pontual 12×")).toBeOnTheScreen();
    expect(screen.getByText("Comprometido 9×")).toBeOnTheScreen();
  });

  it("renders nothing extra for a member with no reputation tags yet", async () => {
    setGroupReputationMock("group-1", []);

    const user = userEvent.setup();
    renderWithProviders(<GroupDetailScreen />);

    await user.press(screen.getByText("Jogadores"));

    expect(await screen.findByText("Zico")).toBeOnTheScreen();
    expect(screen.queryByText(/Pontual/)).not.toBeOnTheScreen();
  });
});
