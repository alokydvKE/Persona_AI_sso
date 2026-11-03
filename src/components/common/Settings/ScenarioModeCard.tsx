import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ScenarioModeCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenario Mode</CardTitle>
        <CardDescription>
          Choose the default analysis perspective for AI responses
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="optimistic">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="optimistic">
              Optimistic
            </TabsTrigger>

            <TabsTrigger value="realistic">
              Realistic
            </TabsTrigger>

            <TabsTrigger value="pessimistic">
              Pessimistic
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-sm text-muted-foreground">
          Emphasizes growth opportunities, favorable market conditions,
          and potential upsides.
        </p>
      </CardContent>
    </Card>
  );
}