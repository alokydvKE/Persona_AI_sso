import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface Props {
  role: RoleT;
  isSelected: boolean;
  setSelected: () => void;
}

const RoleCard = ({ role, isSelected, setSelected }: Props) => {
  const { icon: Icon, ...rest } = role;
  return (
    <Card
      data-test-id={`project_type_${rest.id}`}
      key={rest.id}
      className={cn(
        "relative cursor-pointer transition-all duration-200 hover:border-foreground/20 w-full",
        isSelected && "ring-2 ring-primary border-primary",
      )}
      onClick={() => setSelected()}
    >
      <CardHeader className="flex flex-row gap-2 md:gap-2 md:flex-col items-center md:items-start">
        <div
          className={cn(
            "md:mb-3 flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <CardTitle className="">{rest.title}</CardTitle>
        <CardDescription className="leading-tight hidden md:block">
          {rest.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="md:space-y-1">
          {rest.features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default memo(RoleCard);
