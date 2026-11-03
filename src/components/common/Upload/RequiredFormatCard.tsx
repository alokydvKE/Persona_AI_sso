import { FileSpreadsheet, Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useDataFileSchema } from "@/api/Projects/dataFiles";

/**
 * Shows the user what a valid upload looks like: accepted formats, size/count
 * limits, the expected sheets, and a representative (fully synthetic / dummy)
 * set of columns with example values. Sourced from
 * POST /projects/files/data/schema so the guidance never drifts from what the
 * backend actually accepts. No real respondent data is ever shown.
 */
function RequiredFormatCard() {
  const { data, isLoading, isError } = useDataFileSchema();

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Required data format</CardTitle>
        </div>
        <CardDescription>
          Example of the survey data we can process. Values shown are dummy
          samples, not real data.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">
            Couldn't load the example format. You can still upload .xlsx or .sav
            files.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {data.accepted_formats.map((fmt) => (
                <Badge key={fmt} variant="secondary" className="font-mono">
                  {fmt}
                </Badge>
              ))}
              <span className="text-xs text-muted-foreground">
                up to {data.max_file_size_mb} MB · max {data.max_files_per_upload}{" "}
                files
              </span>
            </div>

            {data.sheets.length > 0 && (
              <ul className="space-y-1">
                {data.sheets.map((sheet) => (
                  <li key={sheet.name} className="flex gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {sheet.name}
                    </span>
                    <span className="text-muted-foreground">
                      {sheet.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div
              className="h-56 overflow-auto rounded-md border"
              tabIndex={0}
              aria-label="Required data fields"
            >
              <Table
                className="min-w-[720px]"
                containerClassName="overflow-visible"
              >
                <TableHeader>
                    <TableRow>
                      <TableHead className="w-[28%]">Variable</TableHead>
                      <TableHead className="w-[16%]">Type</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="w-[18%]">Example</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.columns.map((col) => (
                      <TableRow key={col.name}>
                        <TableCell className="font-mono text-xs">
                          {col.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {col.type}
                        </TableCell>
                        <TableCell className="text-xs">{col.label}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {String(col.example)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            {data.total_variables_hint && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {data.total_variables_hint}
              </p>
            )}

            {data.notes.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {data.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default RequiredFormatCard;
