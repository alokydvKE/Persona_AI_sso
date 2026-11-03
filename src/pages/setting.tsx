import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CircularLoader } from "@/components/ui/loader";
import { Plus, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

import { useSettings } from "@/api/Settings/query";
import { useSaveSettings, useResetSettings } from "@/api/Settings/mutation";

/** Like AppSettings but with text fields kept as strings for inputs. */
type SettingsForm = Omit<AppSettings, "industry" | "domain"> & {
  industry: string;
  domain: string;
};

const SCENARIO_MODES: { value: AppSettings["scenario_mode"]; label: string; description: string }[] = [
  {
    value: "optimistic",
    label: "Optimistic",
    description:
      "Emphasizes growth opportunities, favorable market conditions, and potential upsides.",
  },
  {
    value: "realistic",
    label: "Realistic",
    description:
      "Balances opportunities and risks for a grounded, most-likely outlook.",
  },
  {
    value: "pessimistic",
    label: "Pessimistic",
    description:
      "Stresses risks, headwinds, and downside scenarios to pressure-test ideas.",
  },
];

const TIME_HORIZONS: { value: AppSettings["time_horizon"]; label: string }[] = [
  { value: "1_year", label: "1 Year" },
  { value: "3_years", label: "3 Years" },
  { value: "5_years", label: "5 Years" },
  { value: "10_years", label: "10 Years" },
];

function toForm(s: AppSettings): SettingsForm {
  return { ...s, industry: s.industry ?? "", domain: s.domain ?? "" };
}

export default function SettingsPage() {
  const { data: settings, isLoading, isError } = useSettings();
  const saveMut = useSaveSettings();
  const resetMut = useResetSettings();

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [newAssumption, setNewAssumption] = useState("");

  // Seed the form once settings load.
  useEffect(() => {
    if (settings && !form) setForm(toForm(settings));
  }, [settings, form]);

  if (isLoading || !form) {
    if (isError) {
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Couldn't load your settings. Please try again.
          </p>
        </div>
      );
    }
    return (
      <div className="min-h-screen">
        <div className="container mx-auto max-w-4xl px-4 py-4">
          <div className="mb-8 space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-3 w-72" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isDirty =
    !!settings && JSON.stringify(form) !== JSON.stringify(toForm(settings));

  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const addAssumption = () => {
    const value = newAssumption.trim();
    if (!value) return;
    update("assumptions", [...form.assumptions, value]);
    setNewAssumption("");
  };

  const removeAssumption = (index: number) =>
    update(
      "assumptions",
      form.assumptions.filter((_, i) => i !== index),
    );

  const handleSave = () => {
    saveMut.mutate(form, {
      onSuccess: () => toast.success("Settings saved"),
    });
  };

  const handleReset = () => {
    resetMut.mutate(undefined, {
      onSuccess: (defaults) => {
        setForm(toForm(defaults));
        toast.success("Settings reset to defaults");
      },
    });
  };

  const activeScenario = SCENARIO_MODES.find((m) => m.value === form.scenario_mode);

  return (
    <div className="min-h-screen duration-300 animate-in fade-in slide-in-from-bottom-1">
      <div className="container mx-auto max-w-4xl px-4 py-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-gradient-brand w-fit text-4xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="mt-2 text-muted-foreground">
            Configure your analysis context and display preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Scenario Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Scenario Mode</CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose the default analysis perspective for AI responses
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={form.scenario_mode}
                onValueChange={(v) =>
                  update("scenario_mode", v as AppSettings["scenario_mode"])
                }
              >
                <TabsList className="grid w-full grid-cols-3">
                  {SCENARIO_MODES.map((m) => (
                    <TabsTrigger key={m.value} value={m.value}>
                      {m.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <p className="text-sm text-muted-foreground">
                {activeScenario?.description}
              </p>
            </CardContent>
          </Card>

          {/* Time Horizon */}
          <Card>
            <CardHeader>
              <CardTitle>Time Horizon</CardTitle>
              <p className="text-sm text-muted-foreground">
                Set the default planning timeframe for predictions
              </p>
            </CardHeader>
            <CardContent>
              <Select
                value={form.time_horizon}
                onValueChange={(v) =>
                  update("time_horizon", v as AppSettings["time_horizon"])
                }
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select horizon" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_HORIZONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Industry Context */}
          <Card>
            <CardHeader>
              <CardTitle>Industry Context</CardTitle>
              <p className="text-sm text-muted-foreground">
                Provide context about your industry and domain for more relevant
                insights
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2.5">
                  <label className="block text-sm font-medium">Industry</label>
                  <Input
                    value={form.industry}
                    onChange={(e) => update("industry", e.target.value)}
                    placeholder="e.g. Technology"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2.5">
                  <label className="block text-sm font-medium">Domain</label>
                  <Input
                    value={form.domain}
                    onChange={(e) => update("domain", e.target.value)}
                    placeholder="e.g. B2B SaaS"
                    maxLength={100}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Assumptions */}
          <Card>
            <CardHeader>
              <CardTitle>Current Assumptions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define base assumptions the AI should consider in all analyses
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.assumptions.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No assumptions added yet.
                </p>
              )}
              {form.assumptions.map((assumption, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <span className="flex-1 text-sm leading-relaxed break-words">
                    {assumption}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeAssumption(index)}
                    aria-label="Remove assumption"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newAssumption}
                  onChange={(e) => setNewAssumption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAssumption();
                    }
                  }}
                  placeholder="Add a new assumption..."
                  className="flex-1"
                />
                <Button
                  onClick={addAssumption}
                  disabled={!newAssumption.trim()}
                  className="shrink-0"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Display Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <p className="text-sm text-muted-foreground">
                Customize how AI responses are displayed
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Show Confidence Scores</h4>
                  <p className="text-sm text-muted-foreground">
                    Display confidence percentages on AI responses
                  </p>
                </div>
                <Switch
                  checked={form.show_confidence_scores}
                  onCheckedChange={(v) => update("show_confidence_scores", v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Show Data Badges</h4>
                  <p className="text-sm text-muted-foreground">
                    Display data range badges on responses
                  </p>
                </div>
                <Switch
                  checked={form.show_data_badges}
                  onCheckedChange={(v) => update("show_data_badges", v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Auto-expand Details</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically show assumptions and data signals
                  </p>
                </div>
                <Switch
                  checked={form.auto_expand_details}
                  onCheckedChange={(v) => update("auto_expand_details", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetMut.isPending || saveMut.isPending}
            >
              {resetMut.isPending ? (
                <CircularLoader size="sm" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reset to Defaults
            </Button>

            <Button
              onClick={handleSave}
              disabled={!isDirty || saveMut.isPending || resetMut.isPending}
            >
              {saveMut.isPending ? (
                <CircularLoader size="sm" className="border-white" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
