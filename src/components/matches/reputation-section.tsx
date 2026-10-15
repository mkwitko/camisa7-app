import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/common/use-toast";
import { useSetReputation } from "@/hooks/reputation/use-set-reputation";
import { useGetReputation } from "@/api/generated/hooks/reputationHooks";

const DIMENSIONS = ["pontualidade", "educacao", "compromisso", "respeito"] as const;
type Dimension = (typeof DIMENSIONS)[number];

export type ReputationTeammate = { id: string; name: string };

export type ReputationSectionProps = {
  matchId: string;
  /** Confirmados da pelada, excluindo o próprio usuário logado (calculado pela tela). */
  teammates: ReputationTeammate[];
  /** `true` enquanto a janela de avaliação (mesma janela de 48h da votação) está aberta. */
  open: boolean;
};

/**
 * Seção "Reputação" pós-jogo — cada confirmado marca tags positivas (por
 * dimensão) pros demais confirmados. Hidrata a seleção a partir do que o
 * usuário logado já enviou (`GET /matches/:id/reputation` devolve só as tags
 * do próprio votante) e no salvar envia o conjunto completo via `PUT`
 * (upsert — substitui, nunca soma). Sem endpoint de "toggle individual": a
 * seleção fica em estado local até o usuário apertar salvar, igual ao padrão
 * da seção "Votação" — mas aqui o envio é em lote, não por toque.
 */
export function ReputationSection({ matchId, teammates, open }: ReputationSectionProps) {
  const { t } = useTranslation("matches");
  const toast = useToast();

  const reputationQuery = useGetReputation(matchId);
  const setReputation = useSetReputation(matchId);

  // Edições do usuário; enquanto null, a seleção vem do que o servidor já tem.
  // Hidratar por derivação (não por efeito) mantém uma seleção em andamento
  // intacta se a query refizer o fetch, ex.: refoco de tela.
  const [edited, setEdited] = useState<Record<string, Set<Dimension>> | null>(null);
  const selected = useMemo(() => {
    if (edited) return edited;
    const fromServer: Record<string, Set<Dimension>> = {};
    for (const tag of reputationQuery.data?.tags ?? []) {
      fromServer[tag.votedPlayerId] = new Set(tag.dimensions as Dimension[]);
    }
    return fromServer;
  }, [edited, reputationQuery.data]);

  const toggle = (teammateId: string, dimension: Dimension) => {
    setEdited(() => {
      const prev = selected;
      const current = new Set(prev[teammateId] ?? []);
      if (current.has(dimension)) current.delete(dimension);
      else current.add(dimension);
      return { ...prev, [teammateId]: current };
    });
  };

  const handleSave = async () => {
    const tags = Object.entries(selected)
      .filter(([, dimensions]) => dimensions.size > 0)
      .map(([votedPlayerId, dimensions]) => ({
        votedPlayerId,
        dimensions: Array.from(dimensions),
      }));

    try {
      await setReputation.mutateAsync({ tags });
      toast.show(t("detail.reputation.saved"));
    } catch {
      toast.show(t("detail.reputation.error"), "danger");
    }
  };

  return (
    <View className="gap-5" testID="reputation-section">
      <Text variant="display" className="text-lg">
        {t("detail.reputation.title")}
      </Text>

      {toast.message ? (
        <Toast variant={toast.variant} onDismiss={toast.dismiss}>
          {toast.message}
        </Toast>
      ) : null}

      {teammates.map((teammate) => (
        <View key={teammate.id} className="gap-2">
          <Text className="font-body-semibold text-sm text-ink">{teammate.name}</Text>
          <View className="flex-row flex-wrap gap-2">
            {DIMENSIONS.map((dimension) => (
              <Chip
                key={dimension}
                testID={`reputation-${dimension}-${teammate.id}`}
                label={t(`detail.reputation.${dimension}`)}
                selected={!!selected[teammate.id]?.has(dimension)}
                disabled={!open}
                onPress={() => toggle(teammate.id, dimension)}
                accessibilityLabel={`${t(`detail.reputation.${dimension}`)}: ${teammate.name}`}
              />
            ))}
          </View>
        </View>
      ))}

      <Button
        onPress={() => void handleSave()}
        loading={setReputation.isPending}
        disabled={!open}
        testID="reputation-save"
      >
        {t("detail.reputation.saveCta")}
      </Button>
    </View>
  );
}
