import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

export type TrophyBadge = {
  year: number;
  groupId: string;
  groupName: string;
  category: "artilheiro" | "garcom" | "paredao" | "mvp" | "presenca";
};

const CATEGORY_LABEL = {
  artilheiro: "trophy.artilheiro",
  garcom: "trophy.garcom",
  paredao: "trophy.paredao",
  mvp: "trophy.mvp",
  presenca: "trophy.presenca",
} as const;

export function TrophyBadges({ trophies }: { trophies: readonly TrophyBadge[] }) {
  const { t } = useTranslation("player");

  if (trophies.length === 0) return null;

  return (
    <View className="gap-3">
      <Text variant="display" className="text-lg">
        {t("trophy.title", { defaultValue: "Troféus" })}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {trophies.map((trophy, i) => (
          <Badge key={`${trophy.groupId}-${trophy.year}-${trophy.category}-${i}`} variant="ouro">
            {t(CATEGORY_LABEL[trophy.category], { defaultValue: trophy.category })} {trophy.year} · {trophy.groupName}
          </Badge>
        ))}
      </View>
    </View>
  );
}
