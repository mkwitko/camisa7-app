import type { ReactNode } from "react";
import { cssInterop } from "nativewind";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { StadiumBackground } from "@/components/ui/stadium-background";
import { cn } from "@/lib/utils";

// `KeyboardAwareScrollView` é de terceiros — o NativeWind não intercepta
// `className`/`contentContainerClassName` sozinho. Registramos o mapeamento
// pros nomes de estilo que o componente repassa pro ScrollView interno.
cssInterop(KeyboardAwareScrollView, {
  className: "style",
  contentContainerClassName: { target: "contentContainerStyle" },
});

export function ScreenContainer({
  children,
  className,
  scroll = true,
  background,
  footer,
  edges = ["top", "bottom"],
}: {
  children: ReactNode;
  className?: string;
  scroll?: boolean;
  /**
   * Backdrop atrás do conteúdo. Quando omitido, usa o estádio sutil (padrão de
   * TODAS as telas internas). As telas de auth passam `<StadiumBackground />`
   * (intensidade cheia) explicitamente.
   */
  background?: ReactNode;
  /**
   * Slot fixo abaixo do conteúdo rolável, dentro da SafeAreaView. Fica sempre
   * visível (não rola com o resto da tela).
   */
  footer?: ReactNode;
  edges?: Edge[];
}) {
  const backdrop = background ?? <StadiumBackground intensity="subtle" />;

  const content = scroll ? (
    // `KeyboardAwareScrollView` rola o input focado pra cima do teclado
    // automaticamente — funciona sob o edge-to-edge do Android 15/SDK 57, onde
    // o `adjustResize` nativo falha. `bottomOffset` = folga entre input e teclado.
    <KeyboardAwareScrollView
      className="flex-1"
      contentContainerClassName={cn("flex-grow gap-6 p-6", className)}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      {children}
    </KeyboardAwareScrollView>
  ) : (
    // Sem scroll (ex.: telas com FlatList próprio): o padding lateral/topo
    // precisa vir daqui, senão o conteúdo cola nas bordas ("cru").
    <View className={cn("flex-1 p-6", className)}>{children}</View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={edges}>
      <View className="absolute inset-0" pointerEvents="none">
        {backdrop}
      </View>
      {content}
      {footer ? <View className="px-6 py-4">{footer}</View> : null}
    </SafeAreaView>
  );
}
