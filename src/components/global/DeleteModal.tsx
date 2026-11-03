import { AlertTriangleIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type { Dispatch, SetStateAction } from "react";

type Prop = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  title?: string;
  description?: string;
  onClick: () => void;
};

export default function DeleteDialog({
  open,
  setOpen,
  title = "Project",
  description = "Are you sure you want to delete your project? All of your data will be permanently removed. This action cannot be undone.",
  onClick,
}: Prop) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <div className="flex items-start space-x-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangleIcon className="h-6 w-6 text-red-600" />
          </div>
          <DialogHeader>
            <DialogTitle>Delete {title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            data-test-id="DELETE_CONFIRM"
            variant="destructive"
            onClick={() => {
              onClick();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
