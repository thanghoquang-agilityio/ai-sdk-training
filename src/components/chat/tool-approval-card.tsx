import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

type ToolApprovalCardProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ToolApprovalCard({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ToolApprovalCardProps) {
  return (
    <Card className="w-fit max-w-full px-4 py-3 shadow-[0_10px_26px_rgba(7,12,30,0.25)]">
      <Text as="p" variant="sectionTitle">
        {title}
      </Text>
      <Text variant="helper" className="mt-1 block text-white/70">
        {description}
      </Text>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="border border-white/12 font-dm-sans text-white/60 hover:bg-white/8" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </Card>
  );
}
