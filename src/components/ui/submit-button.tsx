"use client";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "./button";

/** Submit button that shows a spinner while its parent <form> action is pending. */
export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
