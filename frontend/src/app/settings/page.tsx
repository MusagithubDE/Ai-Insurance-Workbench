import { Settings2Icon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-16 text-center">
      <Settings2Icon className="size-8 text-muted-foreground" />
      <h1 className="font-heading text-lg font-semibold">Settings</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        A settings screen for the model tag, timeout, max tool calls and a model health check lands in Stage 5.
      </p>
    </div>
  );
}
