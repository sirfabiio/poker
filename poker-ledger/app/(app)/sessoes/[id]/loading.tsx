import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="A carregar sessão" className="space-y-4">
      <Skeleton className="h-11 w-24" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mx-auto aspect-[2.1/1] w-full max-w-[360px] rounded-[50%]" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full rounded-[24px]" />
      <Skeleton className="h-40 w-full rounded-[24px]" />
    </div>
  );
}
