import { useState } from "react";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { Image, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";

export type PaymentSheetCharge = {
  brCode: string;
  /**
   * URL do QR code. Ausente para assinaturas PIX Automático (Woovi) — o
   * `subscribeBilling` só retorna o `emv` (copia-e-cola), sem imagem. Nesse
   * caso o sheet renderiza só o copia-e-cola + o aviso de aprovação no app
   * do banco (em vez do `<Image>`).
   */
  qrCodeImage?: string;
  status: string;
};

export type PaymentSheetProps = {
  visible: boolean;
  onClose: () => void;
  charge: PaymentSheetCharge | null;
};

const PAID_STATUSES = new Set(["paid", "completed"]);

/**
 * Bottom sheet de cobrança PIX (Woovi) — QR code + código copia-e-cola +
 * status. Puramente apresentacional: quem chama decide como obter/atualizar
 * o `charge` (polling de status fica na tela, não aqui).
 */
export function PaymentSheet({ visible, onClose, charge }: PaymentSheetProps) {
  const { t } = useTranslation("payments");
  // Guarda qual código foi copiado: um novo charge (brCode diferente) volta a
  // mostrar "copiar" sem precisar de efeito pra resetar.
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copied = copiedCode !== null && copiedCode === charge?.brCode;

  async function copyCode() {
    if (!charge) return;
    await Clipboard.setStringAsync(charge.brCode);
    setCopiedCode(charge.brCode);
  }

  const statusLabel = charge
    ? PAID_STATUSES.has(charge.status)
      ? t("payment.paid")
      : t("payment.pending")
    : null;

  return (
    <Sheet visible={visible} onClose={onClose} title={t("payment.title")}>
      {charge ? (
        <View className="items-center gap-4">
          {charge.qrCodeImage ? (
            <Image
              source={{ uri: charge.qrCodeImage }}
              accessibilityLabel={t("payment.qrLabel")}
              className="h-56 w-56 rounded-2xl bg-surface-up"
              testID="payment-qr-image"
            />
          ) : (
            <Text className="text-center font-body-medium text-sm text-ink" testID="payment-automatic-notice">
              {t("payment.automaticNotice")}
            </Text>
          )}

          <Text variant="muted" className="text-sm">
            {statusLabel}
          </Text>

          <View className="w-full gap-2 rounded-2xl border border-line bg-surface-up p-4">
            <Text className="font-body-medium text-xs uppercase tracking-wide text-muted">
              {t("payment.copyPasteLabel")}
            </Text>
            <Text className="font-body text-xs text-ink" numberOfLines={3} selectable>
              {charge.brCode}
            </Text>
          </View>

          <Button
            testID="payment-copy"
            variant="secondary"
            onPress={() => void copyCode()}
            className="self-stretch"
          >
            {copied ? t("payment.copied") : t("payment.copy")}
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}
